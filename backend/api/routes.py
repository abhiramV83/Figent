import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.db.database import get_db
from backend.db import crud
from backend.graph import build_graph
from backend.agents.chat_agent import ChatAgent

router = APIRouter()

# In-memory store for active chat agents
# (review_id → ChatAgent instance)
active_chat_agents = {}

# ── Request Models ───────────────────────────────────────

class ReviewRequest(BaseModel):
    repo_url: str

class ChatRequest(BaseModel):
    message: str
    session_id: int

# ── Review Routes ────────────────────────────────────────

@router.post("/review")
async def start_review(request: ReviewRequest, db: Session = Depends(get_db)):
    """Start a new code review — returns review_id immediately"""
    review = crud.create_review(db, request.repo_url)
    return {"review_id": review.id, "status": "started"}


@router.get("/review/{review_id}")
def get_review(review_id: int, db: Session = Depends(get_db)):
    """Get review results by ID"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return {
        "id": review.id,
        "repo_url": review.repo_url,
        "status": review.status,
        "created_at": review.created_at,
        "completed_at": review.completed_at,
        "total_findings": review.total_findings,
        "pr_count": review.pr_count,
        "issue_count": review.issue_count,
        "error": review.error,
        "findings": [
            {
                "id": f.id,
                "file": f.file,
                "line": f.line,
                "issue": f.issue,
                "severity": f.severity,
                "fix": f.fix,
                "confidence": f.confidence,
                "agents": f.agents,
                "pr_eligible": f.pr_eligible,
                "action_taken": f.action_taken,
                "github_url": f.github_url
            }
            for f in review.findings
        ]
    }


@router.get("/reviews")
def get_all_reviews(db: Session = Depends(get_db)):
    """Get all past reviews — for history view"""
    reviews = crud.get_all_reviews(db)
    return [
        {
            "id": r.id,
            "repo_url": r.repo_url,
            "status": r.status,
            "created_at": r.created_at,
            "total_findings": r.total_findings,
            "pr_count": r.pr_count,
            "issue_count": r.issue_count
        }
        for r in reviews
    ]

# ── WebSocket — Live Streaming ───────────────────────────

@router.websocket("/ws/review")
async def review_websocket(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for streaming review results.
    Client sends: {"repo_url": "https://github.com/..."}
    Server streams: agent completion events as they happen
    """
    await websocket.accept()

    try:
        # Receive repo URL from client
        data = await websocket.receive_json()
        repo_url = data.get("repo_url")

        if not repo_url:
            await websocket.send_json({"type": "error", "message": "repo_url required"})
            return

        # Create review record
        review = crud.create_review(db, repo_url)
        await websocket.send_json({
            "type": "started",
            "review_id": review.id,
            "message": "Review started"
        })

        # Build and stream the graph
        app = build_graph()
        initial_state = {
            "repo_url": repo_url,
            "repo_path": "",
            "files": [],
            "quality_findings": [],
            "security_findings": [],
            "performance_findings": [],
            "all_findings": [],
            "final_report": {},
            "pr_urls": [],
            "error": None
        }

        # Stream events as each node completes
        final_result = None
        for event in app.stream(initial_state):
            node_name = list(event.keys())[0]
            node_output = event[node_name]
            final_result = node_output

            if node_name == "orchestrator":
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "orchestrator",
                    "message": f"Repository cloned — {len(node_output.get('files', []))} files ready",
                    "files_count": len(node_output.get("files", []))
                })

            elif node_name == "quality_agent":
                findings = node_output.get("quality_findings", [])
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "quality_agent",
                    "message": f"Quality analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "security_agent":
                findings = node_output.get("security_findings", [])
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "security_agent",
                    "message": f"Security analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "performance_agent":
                findings = node_output.get("performance_findings", [])
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "performance_agent",
                    "message": f"Performance analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "synthesizer":
                report = node_output.get("final_report", {})
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "synthesizer",
                    "message": f"Synthesis done — {report.get('total', 0)} unique findings",
                    "report": report,
                    "all_findings": node_output.get("all_findings", [])
                })

            elif node_name == "pr_agent":
                pr_urls = node_output.get("pr_urls", [])
                await websocket.send_json({
                    "type": "agent_complete",
                    "agent": "pr_agent",
                    "message": f"GitHub actions done",
                    "pr_urls": pr_urls
                })

        # Save to DB
        if final_result:
            crud.complete_review(db, review.id, final_result)

            # Initialize chat agent for this review
            active_chat_agents[review.id] = ChatAgent(final_result)

        await websocket.send_json({
            "type": "complete",
            "review_id": review.id,
            "message": "Review complete"
        })

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
        if review:
            crud.fail_review(db, review.id, str(e))

# ── Chat Routes ──────────────────────────────────────────

@router.post("/chat/{review_id}")
def chat(review_id: int, request: ChatRequest, db: Session = Depends(get_db)):
    """Send a chat message about a review"""

    # Get or create chat agent
    if review_id not in active_chat_agents:
        # Load from DB if not in memory
        review = crud.get_review(db, review_id)
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        # Reconstruct result dict from DB
        result = {
            "repo_url": review.repo_url,
            "files": [],
            "all_findings": [
                {
                    "file": f.file,
                    "line": f.line,
                    "issue": f.issue,
                    "severity": f.severity,
                    "fix": f.fix,
                    "confidence": f.confidence,
                    "agents": f.agents,
                    "pr_eligible": f.pr_eligible,
                    "action_taken": f.action_taken,
                    "github_url": f.github_url
                }
                for f in review.findings
            ],
            "pr_urls": [],
            "final_report": {
                "total": review.total_findings,
                "pr_eligible_count": review.pr_count,
                "by_severity": {}
            }
        }
        active_chat_agents[review_id] = ChatAgent(result)

    agent = active_chat_agents[review_id]

    # Save user message
    crud.save_chat_message(db, request.session_id, "user", request.message)

    # Get response
    response = agent.chat(request.message)

    # Save assistant response
    crud.save_chat_message(db, request.session_id, "assistant", response)

    return {"response": response}


@router.post("/chat/session/{review_id}")
def create_chat_session(review_id: int, db: Session = Depends(get_db)):
    """Create a new chat session for a review"""
    session = crud.create_chat_session(db, review_id)
    return {"session_id": session.id}


@router.get("/chat/history/{session_id}")
def get_chat_history(session_id: int, db: Session = Depends(get_db)):
    """Get chat history for a session"""
    messages = crud.get_chat_history(db, session_id)
    return [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in messages
    ]
