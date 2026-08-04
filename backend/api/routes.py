import os
import asyncio
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from backend.db.models import Review

from backend.db.database import get_db
from backend.db import crud
from backend.graph import build_graph
from backend.agents.chat_agent import ChatAgent

router = APIRouter()

# In-memory store for active chat agents
# (review_id → ChatAgent instance)
active_chat_agents = {}

# In-memory store for currently running reviews progress events
# (review_id → list of events)
active_review_progress = {}

# In-memory store for currently running reviews stop events
# (review_id → asyncio.Event)
active_stop_events = {}


class ReviewTaskManager:
    def __init__(self):
        self.queues = {} # review_id -> list of asyncio.Queue

    def register_listener(self, review_id: int, queue: asyncio.Queue):
        if review_id not in self.queues:
            self.queues[review_id] = []
        self.queues[review_id].append(queue)

    def unregister_listener(self, review_id: int, queue: asyncio.Queue):
        if review_id in self.queues:
            if queue in self.queues[review_id]:
                self.queues[review_id].remove(queue)
            if not self.queues[review_id]:
                del self.queues[review_id]

    def publish_event(self, review_id: int, event: dict):
        if review_id not in active_review_progress:
            active_review_progress[review_id] = []
        active_review_progress[review_id].append(event)
        
        if review_id in self.queues:
            for q in self.queues[review_id]:
                q.put_nowait(event)

task_manager = ReviewTaskManager()

# ── Password Hashing Helpers ─────────────────────────────

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a unique salt"""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}:{key.hex()}"



def generate_token() -> str:
    """Generate a cryptographically secure random session token"""
    return secrets.token_urlsafe(32)

# ── Bearer Token Authentication Dependency ───────────────

security_scheme = HTTPBearer()

def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security_scheme), db: Session = Depends(get_db)):
    token = auth.credentials
    user = crud.get_user_by_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token")
    if user.token_expires and user.token_expires < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session token has expired")
    return user

# ── Request Models ───────────────────────────────────────

class ReviewRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    selected_files: Optional[list[str]] = None

class ChatRequest(BaseModel):
    message: str
    session_id: int

class SupportTicketRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class GitHubAuthRequest(BaseModel):
    code: str

# Manual registration, email OTP verification, password login, and recovery endpoints are disabled. All auth runs through GitHub OAuth.


@router.get("/auth/me")
def get_me(user = Depends(get_current_user)):
    """Verify session token and retrieve user details"""
    return {"id": user.id, "username": user.username, "email": user.email}


def get_client_ip(request: Request) -> str:
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/auth/guest")
def create_guest_user(db: Session = Depends(get_db)):
    """Automatically register and authenticate an anonymous guest user"""
    import secrets
    
    guest_id = secrets.token_hex(4)
    username = f"guest_{guest_id}"
    password_hash = hash_password(secrets.token_hex(16))
    email = f"{username}@figent.com"
    
    user = crud.create_user(db, username, password_hash, email)
    
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)
    
    return {
        "token": token,
        "username": username,
        "message": "Guest session created successfully"
    }


@router.post("/auth/github")
def github_auth(request: GitHubAuthRequest, request_obj: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Exchange GitHub authorization code for user token"""
    import requests
    import logging
    logger = logging.getLogger("uvicorn.error")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        logger.error("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured in backend .env")
        raise HTTPException(status_code=500, detail="GitHub login is not configured on the server")

    # 1. Exchange authorization code for access token
    try:
        token_res = requests.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": request.code
            },
            timeout=15
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            err_msg = f"Failed to get GitHub access token. GitHub returned: {token_data}"
            logger.error(err_msg)
            raise HTTPException(status_code=400, detail=token_data.get("error_description") or "Invalid authorization code")
    except HTTPException:
        raise
    except Exception as e:
        err_msg = f"Error exchanging code with GitHub: {type(e).__name__}: {e}"
        logger.error(err_msg)
        raise HTTPException(status_code=400, detail="Failed to authenticate with GitHub")

    # 2. Fetch user profile from GitHub
    try:
        user_res = requests.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/json"
            },
            timeout=15
        )
        user_data = user_res.json()
        github_username = user_data.get("login")
        if not github_username:
            err_msg = f"Failed to fetch GitHub profile. GitHub returned: {user_data}"
            logger.error(err_msg)
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")
    except HTTPException:
        raise
    except Exception as e:
        err_msg = f"Error fetching GitHub profile: {type(e).__name__}: {e}"
        logger.error(err_msg)
        raise HTTPException(status_code=400, detail="Failed to connect to GitHub API")

    # 3. Fetch user email from GitHub
    email = None
    try:
        email_res = requests.get(
            "https://api.github.com/user/emails",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/json"
            },
            timeout=15
        )
        emails_data = email_res.json()
        # Find primary email
        for email_info in emails_data:
            if email_info.get("primary"):
                email = email_info.get("email")
                break
        if not email and emails_data:
            email = emails_data[0].get("email")
    except Exception as e:
        logger.warning(f"Failed to fetch GitHub emails: {e}")

    if not email:
        email = f"{github_username}@users.noreply.github.com"

    # 4. Find or create user
    user = crud.get_user_by_username(db, github_username)
    if not user:
        # Check by email to prevent duplicate accounts
        user = crud.get_user_by_email(db, email)
        if not user:
            # Create a new user with a random hashed password
            import secrets
            random_pass = secrets.token_hex(16)
            password_hash = hash_password(random_pass)
            user = crud.create_user(db, github_username, password_hash, email)

    # 5. Generate and set session token
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)

    # Send login alert emails asynchronously to user and admin
    background_tasks.add_task(
        send_login_notification_email,
        user.username,
        user.email,
        get_client_ip(request_obj)
    )

    return {
        "token": token,
        "username": user.username,
        "message": "GitHub login successful"
    }


def validate_github_repo(repo_url: str) -> bool:
    """Validate if the repository URL is a valid, publicly accessible GitHub repository"""
    import re
    import requests
    
    # 1. Parse owner and repo name using regex
    match = re.search(r'github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/|$)', repo_url)
    if not match:
        return False
        
    owner, repo = match.group(1), match.group(2)
    
    # 2. Check if the repo is publicly accessible via GitHub API
    api_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Figent-App"
    }
    
    # Authenticate if GITHUB_TOKEN is available to avoid API rate limit blocks
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    try:
        res = requests.head(api_url, headers=headers, timeout=5)
        if res.status_code == 200:
            return True
        if res.status_code == 404:
            return False
            
        # Fallback to GET check
        res_get = requests.get(api_url, headers=headers, timeout=5)
        return res_get.status_code == 200
    except Exception:
        # Fail closed — reject unverifiable URLs rather than letting them through
        return False


def parse_github_url(repo_url: str) -> tuple[str, str] | None:
    """Parse owner and repo name from GitHub URL"""
    import re
    match = re.search(r'github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/|$)', repo_url)
    if not match:
        return None
    return match.group(1), match.group(2)


def map_github_api_error(status_code: int, raw_text: str, operation: str) -> str:
    """Helper to convert raw GitHub API error responses to clean, user-friendly warnings"""
    if status_code == 404:
        return "The specified GitHub repository or branch does not exist, or it is private. Please verify that the repository URL and branch name are correct and publicly accessible."
    elif status_code in (403, 429):
        return "GitHub API rate limit exceeded or access forbidden. Please wait a few minutes and try again."
    elif status_code == 401:
        return "GitHub authorization failed. Please check the server GITHUB_TOKEN configuration."
    else:
        return f"Failed to {operation} from GitHub (HTTP Status: {status_code})."


@router.get("/repo/branches")
def get_repo_branches(repo_url: str, user = Depends(get_current_user)):
    """Fetch all branches of a public GitHub repository"""
    parsed = parse_github_url(repo_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")
    
    owner, repo = parsed
    api_url = f"https://api.github.com/repos/{owner}/{repo}/branches"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Figent-App"
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    try:
        import requests
        res = requests.get(api_url, headers=headers, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=map_github_api_error(res.status_code, res.text, "fetch branches"))
        branches = [b["name"] for b in res.json()]
        return {"branches": branches}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error checking branches: {str(e)}")


@router.get("/repo/files")
def get_repo_files(repo_url: str, branch: str = "main", user = Depends(get_current_user)):
    """Fetch supported code files of a repository and branch using GitHub's recursive tree API"""
    parsed = parse_github_url(repo_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")
    
    owner, repo = parsed
    api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Figent-App"
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    try:
        import requests
        res = requests.get(api_url, headers=headers, timeout=15)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=map_github_api_error(res.status_code, res.text, "fetch file tree"))
            
        tree_data = res.json()
        tree = tree_data.get("tree", [])
        
        from backend.tools.repo_handler import SUPPORTED_EXTENSIONS, SKIP_DIRS
        
        supported_files = []
        for item in tree:
            if item.get("type") == "blob":
                path = item.get("path", "")
                parts = path.split("/")
                if any(skip in parts for skip in SKIP_DIRS):
                    continue
                if parts[-1].startswith("test_") or parts[-1].startswith("conftest"):
                    continue
                ext = os.path.splitext(parts[-1])[1]
                if ext in SUPPORTED_EXTENSIONS:
                    supported_files.append({
                        "path": path,
                        "size_bytes": item.get("size", 0),
                        "language": ext.replace(".", "")
                    })
        return {"files": supported_files}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.get("/repo/compare")
def compare_repo_branches(repo_url: str, branch: str, user = Depends(get_current_user)):
    """Compare target branch with default branch to list modified files"""
    parsed = parse_github_url(repo_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")
    
    owner, repo = parsed
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Figent-App"
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
        
    import requests
    
    # 1. Fetch repository default branch
    repo_api_url = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        repo_res = requests.get(repo_api_url, headers=headers, timeout=10)
        if repo_res.status_code != 200:
            raise HTTPException(status_code=repo_res.status_code, detail="Failed to fetch repository info from GitHub")
        default_branch = repo_res.json().get("default_branch", "main")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error checking default branch: {str(e)}")
        
    # If the target branch is the same as the default branch, return empty modifications list
    if branch == default_branch:
        return {"modified_files": [], "default_branch": default_branch}
        
    # 2. Call compare API
    compare_api_url = f"https://api.github.com/repos/{owner}/{repo}/compare/{default_branch}...{branch}"
    try:
        compare_res = requests.get(compare_api_url, headers=headers, timeout=15)
        if compare_res.status_code != 200:
            raise HTTPException(status_code=compare_res.status_code, detail=f"Failed to fetch comparison from GitHub: {compare_res.text}")
        
        compare_data = compare_res.json()
        modified_files = [f["filename"] for f in compare_data.get("files", [])]
        return {"modified_files": modified_files, "default_branch": default_branch}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error comparing branches: {str(e)}")


# ── Review Routes ────────────────────────────────────────

@router.post("/review")
async def start_review(request: Request, review_req: ReviewRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Start a new code review — returns review_id immediately with IP-based rate limiting for guests"""
    # Validate the repository URL first
    if not validate_github_repo(review_req.repo_url):
        raise HTTPException(
            status_code=400,
            detail="The specified repository URL is invalid or private. Please verify that it is a public GitHub repository."
        )

    client_ip = get_client_ip(request)
    
    # Check if the user is a guest user (skip if local loopback IP for testing/local convenience)
    if user.username.startswith("guest_") and client_ip not in ("127.0.0.1", "::1", "localhost"):
        existing_reviews_count = db.query(Review).filter(Review.ip_address == client_ip).count()
        if existing_reviews_count >= 1:
            raise HTTPException(
                status_code=429,
                detail="Free tier limit reached for guest sessions. Please sign in with GitHub to unlock unlimited code audits."
            )
    
    # Determine report_mode
    report_mode = True
    parsed = parse_github_url(review_req.repo_url)
    if parsed:
        owner, _ = parsed
        if user and user.username and not user.username.startswith("guest_") and owner.lower() == user.username.lower():
            report_mode = False

    review = crud.create_review(db, review_req.repo_url, owner_id=user.id, ip_address=client_ip, report_mode=report_mode)
    return {"review_id": review.id, "status": "started"}


@router.get("/review/{review_id}")
def get_review(review_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get review results by ID"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")

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
def get_all_reviews(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get all past reviews — for history view"""
    reviews = crud.get_user_reviews(db, user.id)
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


@router.get("/review/{review_id}/progress")
def get_review_progress(review_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get live progress events of a running review"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")
    
    events = active_review_progress.get(review_id, [])
    return {
        "status": review.status,
        "repo_url": review.repo_url,
        "events": events
    }


@router.post("/review/{review_id}/stop")
def stop_review(review_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Stop/cancel an actively running review and retain completed findings"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")

    if review_id in active_stop_events:
        active_stop_events[review_id].set()
        return {"message": "Stop signal sent to review pipeline"}
    
    # Fallback: if status says running/pending in database, force-mark complete
    if review.status in ("running", "pending"):
        review.status = "complete"
        db.commit()
        return {"message": "Review force-marked as complete"}

    return {"message": "Review is not currently running"}

async def run_review_pipeline_background(review_id: int, repo_url: str, branch: Optional[str], selected_files: Optional[list[str]], username: str, report_mode: bool = False):
    """Executes the review graph in a detached async background task and publishes progress events"""
    from backend.db.database import SessionLocal
    db = SessionLocal()
    
    # 1. Initialize historical progress tracking
    active_review_progress[review_id] = []
    
    task_manager.publish_event(review_id, {
        "type": "started",
        "review_id": review_id,
        "message": "Review started",
        "agent": "started"
    })
    
    try:
        # Update review status to running in DB
        review = crud.get_review(db, review_id)
        if review:
            review.status = "running"
            db.commit()
            
        stop_event = asyncio.Event()
        active_stop_events[review_id] = stop_event

        # 2. Build and run the graph
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
            "error": None,
            "branch": branch,
            "selected_files": selected_files,
            "report_mode": report_mode
        }

        accumulated_state = dict(initial_state)
        final_result = None

        def run_stream():
            return app.stream(initial_state)

        def safe_next(iterator):
            try:
                return next(iterator)
            except StopIteration:
                return None

        stream_iter = await asyncio.to_thread(run_stream)

        while True:
            if stop_event.is_set():
                task_manager.publish_event(review_id, {
                    "type": "stopped",
                    "message": "Analysis stopped by user.",
                    "agent": "stopped"
                })
                
                # Collate stopped findings
                all_findings = []
                all_findings.extend(accumulated_state.get("quality_findings", []))
                all_findings.extend(accumulated_state.get("security_findings", []))
                all_findings.extend(accumulated_state.get("performance_findings", []))
                accumulated_state["all_findings"] = all_findings
                accumulated_state["final_report"] = {
                    "total": len(all_findings),
                    "by_severity": {
                        "critical": len([f for f in all_findings if f.get("severity") == "critical"]),
                        "high": len([f for f in all_findings if f.get("severity") == "high"]),
                        "medium": len([f for f in all_findings if f.get("severity") == "medium"]),
                        "low": len([f for f in all_findings if f.get("severity") == "low"]),
                    }
                }
                final_result = accumulated_state
                break

            try:
                event = await asyncio.to_thread(safe_next, stream_iter)
                if event is None:
                    break
            except Exception as e:
                # Handle pipeline exception
                review = crud.get_review(db, review_id)
                if review:
                    review.status = "failed"
                    review.error = str(e)
                    db.commit()
                task_manager.publish_event(review_id, {
                    "type": "error",
                    "message": f"Analysis failed: {str(e)}",
                    "agent": "error"
                })
                return

            node_name = list(event.keys())[0]
            node_output = event[node_name]
            accumulated_state.update(node_output)
            final_result = accumulated_state

            if node_name == "orchestrator":
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "orchestrator",
                    "message": f"Repository cloned — {len(node_output.get('files', []))} files ready",
                    "files_count": len(node_output.get("files", []))
                })

            elif node_name == "quality_agent":
                findings = node_output.get("quality_findings", [])
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "quality_agent",
                    "message": f"Quality analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "security_agent":
                findings = node_output.get("security_findings", [])
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "security_agent",
                    "message": f"Security analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "performance_agent":
                findings = node_output.get("performance_findings", [])
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "performance_agent",
                    "message": f"Performance analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "synthesizer":
                report = node_output.get("final_report", {})
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "synthesizer",
                    "message": f"Synthesis done — {report.get('total', 0)} unique findings",
                    "report": report,
                    "all_findings": node_output.get("all_findings", [])
                })
                task_manager.publish_event(review_id, {
                    "type": "keepalive",
                    "message": "Finalizing review report..." if report_mode else "Opening GitHub PRs and Issues — this may take a minute..."
                })

            elif node_name == "pr_agent":
                pr_urls = node_output.get("pr_urls", [])
                task_manager.publish_event(review_id, {
                    "type": "agent_complete",
                    "agent": "pr_agent",
                    "message": "Review report generated successfully" if report_mode else "GitHub actions done",
                    "pr_urls": pr_urls
                })

        # Save to DB on completion
        if final_result:
            try:
                db.close()
            except Exception:
                pass
            db = SessionLocal()
            crud.complete_review(db, review_id, final_result)
            active_chat_agents[review_id] = ChatAgent(final_result, username=username)

            # Send completion email if email exists and user is not a guest
            try:
                import logging
                logger = logging.getLogger("uvicorn.error")
                from backend.db.models import User
                review = crud.get_review(db, review_id)
                if review and review.owner_id:
                    user = db.query(User).filter(User.id == review.owner_id).first()
                    if user and user.email and not user.username.startswith("guest_"):
                        asyncio.create_task(asyncio.to_thread(
                            send_audit_completed_email,
                            username=user.username,
                            email=user.email,
                            review_id=review_id,
                            repo_url=repo_url,
                            total_findings=review.total_findings or 0
                        ))
            except Exception as mail_err:
                import logging
                logger = logging.getLogger("uvicorn.error")
                logger.error(f"Error preparing completed review email notification: {mail_err}")

            # Publish final complete event
            task_manager.publish_event(review_id, {
                "type": "complete",
                "review_id": review_id,
                "message": "Review complete"
            })

    except Exception as e:
        review = crud.get_review(db, review_id)
        if review:
            review.status = "failed"
            review.error = str(e)
            db.commit()
        task_manager.publish_event(review_id, {
            "type": "error",
            "message": f"Pipeline failure: {str(e)}",
            "agent": "error"
        })
    finally:
        db.close()
        active_stop_events.pop(review_id, None)


# ── WebSocket — Live Streaming ───────────────────────────

@router.websocket("/ws/review")
async def review_websocket(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for streaming review results.
    Client sends: {"repo_url": "https://github.com/...", "token": "...", "branch": "...", "selected_files": [...]}
    Server returns all past events and streams live progress from background tasks.
    """
    await websocket.accept()

    try:
        # Receive payload from client
        data = await websocket.receive_json()
        repo_url = data.get("repo_url", "").strip()
        token = data.get("token")
        branch = data.get("branch")
        selected_files = data.get("selected_files")

        if not token:
            await websocket.send_json({"type": "error", "message": "Authentication token required"})
            await websocket.close(code=4001)
            return

        user = crud.get_user_by_token(db, token)
        if not user or (user.token_expires and user.token_expires < datetime.utcnow()):
            await websocket.send_json({"type": "error", "message": "Invalid or expired token"})
            await websocket.close(code=4001)
            return

        if not repo_url:
            await websocket.send_json({"type": "error", "message": "repo_url required"})
            await websocket.close(code=4002)
            return

        # Normalize repo URL
        import re as _re
        repo_url = _re.sub(r'(github\.com/[^/]+/[^/]+)(/.*)?$', r'\1', repo_url)
        if not validate_github_repo(repo_url):
            await websocket.send_json({
                "type": "error",
                "message": "The specified repository URL is invalid or private. Please verify that it is a public GitHub repository."
            })
            await websocket.close(code=4003)
            return

        # Enforce rate limit for guest sessions
        client_ip = None
        x_forwarded_for = websocket.headers.get("x-forwarded-for")
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        else:
            client_ip = websocket.client.host if websocket.client else "127.0.0.1"

        if user.username.startswith("guest_") and client_ip not in ("127.0.0.1", "::1", "localhost"):
            existing_reviews_count = db.query(Review).filter(Review.ip_address == client_ip).count()
            if existing_reviews_count >= 1:
                await websocket.send_json({
                    "type": "error",
                    "message": "Free tier limit reached for guest sessions. Please sign in with GitHub to unlock unlimited code audits."
                })
                await websocket.close(code=4029)
                return

        # Check if there is an active running/pending review for this repo url
        existing_running = db.query(Review).filter(
            Review.repo_url == repo_url,
            Review.owner_id == user.id,
            Review.status.in_(["pending", "running"])
        ).order_by(Review.created_at.desc()).first()

        # Determine report_mode
        report_mode = True
        parsed = parse_github_url(repo_url)
        if parsed:
            owner, _ = parsed
            if user and user.username and not user.username.startswith("guest_") and owner.lower() == user.username.lower():
                report_mode = False

        if existing_running:
            review_id = existing_running.id
        else:
            # Create review record and launch background task runner
            review = crud.create_review(db, repo_url, owner_id=user.id, ip_address=client_ip, report_mode=report_mode)
            review_id = review.id
            asyncio.create_task(run_review_pipeline_background(
                review_id, repo_url, branch, selected_files, user.username, report_mode=report_mode
            ))

        # Register event queue listener for this review ID
        queue = asyncio.Queue()
        task_manager.register_listener(review_id, queue)

        # Background listener task for WebSocket cancellation messages
        async def listen_for_stop():
            try:
                while True:
                    msg_data = await websocket.receive_json()
                    if msg_data.get("type") == "stop":
                        stop_event = active_stop_events.get(review_id)
                        if stop_event:
                            stop_event.set()
                        break
            except Exception:
                pass

        listen_task = asyncio.create_task(listen_for_stop())

        try:
            # 1. Send all historical events that already occurred
            past_events = active_review_progress.get(review_id, [])
            for event in past_events:
                await websocket.send_json(event)
                
            # 2. Wait and stream live events from queue
            while True:
                event = await queue.get()
                await websocket.send_json(event)
                if event.get("type") in ("complete", "error", "stopped"):
                    break
        finally:
            task_manager.unregister_listener(review_id, queue)
            if not listen_task.done():
                listen_task.cancel()

    except WebSocketDisconnect:
        print("Client disconnected from review session")
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": f"Session error: {str(e)}"})
        except Exception:
            pass

def send_support_ticket_email(name: str, email: str, subject: str, message: str):
    """Send support ticket details to the administrator email via SMTP in a beautiful HTML template"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import logging
    logger = logging.getLogger("uvicorn.error")

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    support_recipient = "figentbyabhiram@gmail.com"

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.info(f"\n[EMAIL SIMULATION] Support ticket from {name} ({email}):\nSubject: {subject}\nMessage: {message}\n")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f'"{name} via Figent" <{smtp_from}>'
        msg['To'] = support_recipient
        msg['Subject'] = f"[Figent Support] {subject}"
        msg['Reply-To'] = email

        # HTML Email template matches the visual design system card layout
        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f3ec;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e7e5dc;
            border-radius: 24px;
            padding: 44px;
            box-shadow: 0 4px 20px rgba(42, 45, 34, 0.02);
        }}
        .header {{
            text-align: center;
            margin-bottom: 32px;
        }}
        .logo {{
            font-size: 26px;
            font-weight: 850;
            color: #526322;
            margin: 0 0 8px;
            letter-spacing: -0.5px;
        }}
        .title {{
            font-size: 22px;
            font-weight: 800;
            color: #1c1d1a;
            margin: 0 0 24px;
            letter-spacing: -0.4px;
        }}
        .text {{
            font-size: 14.5px;
            color: #4a4c44;
            line-height: 1.6;
            margin: 0 0 20px;
            font-weight: 500;
        }}
        .details-box {{
            background-color: #faf9f6;
            border: 1px dashed #dcdad0;
            border-radius: 16px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-item {{
            margin-bottom: 16px;
            font-size: 14px;
        }}
        .detail-item:last-child {{
            margin-bottom: 0;
        }}
        .label {{
            font-weight: 800;
            color: #7a855a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
            margin-bottom: 4px;
        }}
        .value {{
            font-weight: 600;
            color: #1c1d1a;
            font-size: 14.5px;
        }}
        .message-content {{
            font-family: inherit;
            white-space: pre-wrap;
            background-color: #fcfbfa;
            border: 1px solid #e7e5dc;
            border-radius: 12px;
            padding: 16px;
            margin-top: 8px;
            color: #2a2c26;
            font-size: 13.5px;
            line-height: 1.5;
            font-weight: 500;
        }}
        .footer {{
            text-align: center;
            margin-top: 36px;
            font-size: 11px;
            color: #7a7c74;
            line-height: 1.5;
            font-weight: 500;
            border-top: 1px solid #f2f0e8;
            padding-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Figent</div>
            <h1 class="title">New Support Ticket</h1>
        </div>
        
        <p class="text">Hello Admin,</p>
        <p class="text">A user has submitted a new inquiry through the Developer Support Desk. The details of the request are outlined below:</p>
        
        <div class="details-box">
            <div class="detail-item">
                <span class="label">SENDER NAME</span>
                <span class="value">{name}</span>
            </div>
            <div class="detail-item">
                <span class="label">SENDER EMAIL</span>
                <span class="value">{email}</span>
            </div>
            <div class="detail-item">
                <span class="label">SUBJECT</span>
                <span class="value">{subject}</span>
            </div>
            <div class="detail-item">
                <span class="label">MESSAGE</span>
                <div class="message-content">{message}</div>
            </div>
        </div>
        
        <div class="footer">
            This is an automated message from the Figent Support Desk.<br>
            &copy; 2026 Figent. All rights reserved.
        </div>
    </div>
</body>
</html>
"""
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP(smtp_host, int(smtp_port or 587))
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [support_recipient], msg.as_string())
        server.quit()
        logger.info(f"Support ticket from {email} successfully sent to {support_recipient}")
        return True
    except Exception as e:
        logger.error(f"Failed to send support ticket email: {e}")
        return False


def send_login_notification_email(username: str, email: str, ip_address: str = None):
    """Send beautiful login alert emails to both the user and the admin"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import logging
    logger = logging.getLogger("uvicorn.error")

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    admin_recipient = "figentbyabhiram@gmail.com"
    ip_str = ip_address or "Unknown IP"
    from datetime import timedelta
    ist_time = datetime.utcnow() + timedelta(hours=5, minutes=30)
    time_str = ist_time.strftime("%Y-%m-%d %H:%M:%S IST")

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.info(f"\n[EMAIL SIMULATION] Login Alert for {username} ({email or 'No email'}) from {ip_str} at {time_str}\n")
        return True

    # 1. Send security alert to the User
    if email:
        try:
            msg_user = MIMEMultipart('alternative')
            msg_user['From'] = f'"Figent Security" <{smtp_from}>'
            msg_user['To'] = email
            msg_user['Subject'] = "[Figent] Security Alert: New Login Detected"

            html_user = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f3ec;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e7e5dc;
            border-radius: 24px;
            padding: 44px;
            box-shadow: 0 4px 20px rgba(42, 45, 34, 0.02);
        }}
        .header {{
            text-align: center;
            margin-bottom: 32px;
        }}
        .logo {{
            font-size: 26px;
            font-weight: 850;
            color: #526322;
            margin: 0 0 8px;
            letter-spacing: -0.5px;
        }}
        .title {{
            font-size: 20px;
            font-weight: 800;
            color: #1c1d1a;
            margin: 0 0 24px;
            letter-spacing: -0.4px;
        }}
        .text {{
            font-size: 14.5px;
            color: #4a4c44;
            line-height: 1.6;
            margin: 0 0 20px;
            font-weight: 500;
        }}
        .details-box {{
            background-color: #faf9f6;
            border: 1px dashed #dcdad0;
            border-radius: 16px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-item {{
            margin-bottom: 14px;
            font-size: 14px;
        }}
        .detail-item:last-child {{
            margin-bottom: 0;
        }}
        .label {{
            font-weight: 800;
            color: #7a855a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
            margin-bottom: 4px;
        }}
        .value {{
            font-weight: 600;
            color: #1c1d1a;
            font-size: 14px;
        }}
        .footer {{
            text-align: center;
            margin-top: 36px;
            font-size: 11px;
            color: #7a7c74;
            line-height: 1.5;
            font-weight: 500;
            border-top: 1px solid #f2f0e8;
            padding-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Figent</div>
            <h1 class="title">New Sign-In Detected</h1>
        </div>
        
        <p class="text">Hello {username},</p>
        <p class="text">A new sign-in was successfully processed for your Figent workspace. The session details are as follows:</p>
        
        <div class="details-box">
            <div class="detail-item">
                <span class="label">ACCOUNT</span>
                <span class="value">{username}</span>
            </div>

            <div class="detail-item">
                <span class="label">TIME</span>
                <span class="value">{time_str}</span>
            </div>
        </div>

        <p class="text">If this sign-in was you, no action is required. If you did not log in, please reset your password immediately to secure your account.</p>
        
        <div class="footer">
            This is an automated security notification from Figent.<br>
            &copy; 2026 Figent. All rights reserved.
        </div>
    </div>
</body>
</html>
"""
            msg_user.attach(MIMEText(html_user, 'html'))
            server = smtplib.SMTP(smtp_host, int(smtp_port or 587))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [email], msg_user.as_string())
            server.quit()
            logger.info(f"Login notification email sent to user {username} ({email})")
        except Exception as e:
            logger.error(f"Failed to send login notification to user {username}: {e}")

    # 2. Send notification to the Admin
    try:
        msg_admin = MIMEMultipart('alternative')
        msg_admin['From'] = f'"Figent Server" <{smtp_from}>'
        msg_admin['To'] = admin_recipient
        msg_admin['Subject'] = f"[Figent Admin] User Sign-In Notification: {username}"

        html_admin = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f3ec;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e7e5dc;
            border-radius: 24px;
            padding: 44px;
            box-shadow: 0 4px 20px rgba(42, 45, 34, 0.02);
        }}
        .header {{
            text-align: center;
            margin-bottom: 32px;
        }}
        .logo {{
            font-size: 26px;
            font-weight: 850;
            color: #526322;
            margin: 0 0 8px;
            letter-spacing: -0.5px;
        }}
        .title {{
            font-size: 20px;
            font-weight: 800;
            color: #1c1d1a;
            margin: 0 0 24px;
            letter-spacing: -0.4px;
        }}
        .text {{
            font-size: 14.5px;
            color: #4a4c44;
            line-height: 1.6;
            margin: 0 0 20px;
            font-weight: 500;
        }}
        .details-box {{
            background-color: #faf9f6;
            border: 1px dashed #dcdad0;
            border-radius: 16px;
            padding: 24px;
            margin: 24px 0;
        }}
        .detail-item {{
            margin-bottom: 14px;
            font-size: 14px;
        }}
        .detail-item:last-child {{
            margin-bottom: 0;
        }}
        .label {{
            font-weight: 800;
            color: #7a855a;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
            margin-bottom: 4px;
        }}
        .value {{
            font-weight: 600;
            color: #1c1d1a;
            font-size: 14px;
        }}
        .footer {{
            text-align: center;
            margin-top: 36px;
            font-size: 11px;
            color: #7a7c74;
            line-height: 1.5;
            font-weight: 500;
            border-top: 1px solid #f2f0e8;
            padding-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Figent</div>
            <h1 class="title">User Sign-In Alert</h1>
        </div>
        
        <p class="text">Hello Admin,</p>
        <p class="text">A user has signed in to the Figent application. The sign-in details are as follows:</p>
        
        <div class="details-box">
            <div class="detail-item">
                <span class="label">USERNAME</span>
                <span class="value">{username}</span>
            </div>
            <div class="detail-item">
                <span class="label">EMAIL</span>
                <span class="value">{email or "No Email"}</span>
            </div>

            <div class="detail-item">
                <span class="label">TIMESTAMP</span>
                <span class="value">{time_str}</span>
            </div>
        </div>
        
        <div class="footer">
            Automated system report from Figent Admin Console.<br>
            &copy; 2026 Figent. All rights reserved.
        </div>
    </div>
</body>
</html>
"""
        msg_admin.attach(MIMEText(html_admin, 'html'))
        server = smtplib.SMTP(smtp_host, int(smtp_port or 587))
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [admin_recipient], msg_admin.as_string())
        server.quit()
        logger.info(f"Login notification email sent to admin for user {username}")
    except Exception as e:
        logger.error(f"Failed to send login notification to admin for user {username}: {e}")

    return True


def send_audit_completed_email(username: str, email: str, review_id: int, repo_url: str, total_findings: int):
    """Send a beautiful, Figent-themed email notification when a repository code review audit finishes"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import logging
    logger = logging.getLogger("uvicorn.error")

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    
    frontend_url = os.getenv("FRONTEND_URL") or "http://localhost:5173"
    findings_url = f"{frontend_url.rstrip('/')}/review/{review_id}"

    if not smtp_host or not smtp_user or not smtp_pass:
        logger.info(f"\n[EMAIL SIMULATION] Audit Completed Alert for {username} ({email}) - Review #{review_id} for {repo_url}. Findings: {total_findings}. URL: {findings_url}\n")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f'"Figent Code Review" <{smtp_from}>'
        msg['To'] = email
        msg['Subject'] = f"[Figent] Code Review Complete: {repo_url.split('/')[-1]}"

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f5f3ec;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e7e5dc;
            border-radius: 24px;
            padding: 44px;
            box-shadow: 0 4px 20px rgba(42, 45, 34, 0.02);
        }}
        .header {{
            text-align: center;
            margin-bottom: 32px;
        }}
        .logo {{
            font-size: 26px;
            font-weight: 800;
            color: #3b422e;
            letter-spacing: -1px;
            margin-bottom: 12px;
        }}
        .title {{
            font-size: 20px;
            font-weight: 800;
            color: #3b422e;
            margin: 0;
            letter-spacing: -0.5px;
        }}
        .text {{
            font-size: 14.5px;
            line-height: 1.65;
            color: #55524a;
            margin: 16px 0;
            font-weight: 500;
        }}
        .details-box {{
            background-color: #faf9f5;
            border: 1px solid #edebe4;
            border-radius: 16px;
            padding: 24px;
            margin: 28px 0;
        }}
        .detail-item {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #f2f0e8;
        }}
        .detail-item:last-child {{
            border-bottom: none;
            padding-bottom: 0;
        }}
        .detail-item:first-child {{
            padding-top: 0;
        }}
        .label {{
            font-size: 10px;
            font-weight: 800;
            color: #8f8b80;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }}
        .value {{
            font-size: 13.5px;
            font-weight: 700;
            color: #3b422e;
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }}
        .btn {{
            display: block;
            text-align: center;
            background-color: #60684f;
            color: #f7f9eb !important;
            text-decoration: none;
            font-weight: 800;
            font-size: 14px;
            padding: 14px 24px;
            border-radius: 12px;
            margin: 32px 0 16px;
            transition: background-color 0.15s;
        }}
        .footer {{
            text-align: center;
            font-size: 11px;
            color: #a3a095;
            margin-top: 40px;
            line-height: 1.5;
            font-weight: 500;
            border-top: 1px solid #f2f0e8;
            padding-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Figent</div>
            <h1 class="title">Review Audit Complete</h1>
        </div>
        
        <p class="text">Hello {username},</p>
        <p class="text">Great news! The autonomous agent review pipeline has finished analyzing your repository code. Here is a summary of the analysis report:</p>
        
        <div class="details-box">
            <div class="detail-item">
                <span class="label">REPOSITORY</span>
                <span class="value">{repo_url.split('/')[-1]}</span>
            </div>
            <div class="detail-item">
                <span class="label">TOTAL FINDINGS</span>
                <span class="value" style="color: #b91c1c;">{total_findings} issues detected</span>
            </div>
            <div class="detail-item">
                <span class="label">STATUS</span>
                <span class="value" style="color: #60684f;">Complete</span>
            </div>
        </div>

        <a href="{findings_url}" class="btn" target="_blank">View Findings Dashboard</a>

        <p class="text">You can explore individual issues, review suggested remediations (with auto-fix patches), and consult our context-aware AI assistant directly inside the dashboard workspace.</p>
        
        <div class="footer">
            Automated notifications from your Figent dashboard.<br>
            &copy; 2026 Figent. All rights reserved.
        </div>
    </div>
</body>
</html>
"""
        msg.attach(MIMEText(html_content, 'html'))
        server = smtplib.SMTP(smtp_host, int(smtp_port or 587))
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [email], msg.as_string())
        server.quit()
        logger.info(f"Audit complete email notification sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send audit complete email notification to {email}: {str(e)}")
        return False


@router.post("/support/ticket")
def submit_support_ticket(request: SupportTicketRequest, background_tasks: BackgroundTasks, user = Depends(get_current_user)):
    """Submit a support ticket and email it to the administrator inbox"""
    if user.email and request.email != user.email:
        raise HTTPException(status_code=403, detail="Forbidden: You must submit the ticket using your registered email address")

    background_tasks.add_task(
        send_support_ticket_email,
        request.name,
        request.email,
        request.subject,
        request.message
    )
    return {"message": "Support ticket submitted successfully"}


# ── Chat Routes ──────────────────────────────────────────

@router.post("/chat/{review_id}")
def chat(review_id: int, request: ChatRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Send a chat message about a review"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")

    # Get or create chat agent
    if review_id not in active_chat_agents:
        # Reconstruct result dict from DB
        findings_list = [
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
        ]
        
        unique_files = list(set([f.file for f in review.findings if f.file]))
        
        by_severity = {
            "critical": len([f for f in findings_list if f["severity"] == "critical"]),
            "high": len([f for f in findings_list if f["severity"] == "high"]),
            "medium": len([f for f in findings_list if f["severity"] == "medium"]),
            "low": len([f for f in findings_list if f["severity"] == "low"]),
        }
        
        pr_urls = []
        for f in review.findings:
            if f.github_url:
                pr_type = "pr" if f.action_taken == "pr" else "issue"
                pr_urls.append({
                    "type": pr_type,
                    "file": f.file,
                    "line": f.line,
                    "url": f.github_url
                })

        result = {
            "repo_url": review.repo_url,
            "files": unique_files,
            "all_findings": findings_list,
            "pr_urls": pr_urls,
            "final_report": {
                "total": review.total_findings,
                "pr_eligible_count": review.pr_count,
                "by_severity": by_severity
            }
        }
        active_chat_agents[review_id] = ChatAgent(result, username=user.username)

    agent = active_chat_agents[review_id]

    # Save user message
    crud.save_chat_message(db, request.session_id, "user", request.message)

    # Get response
    response = agent.chat(request.message)

    # Save assistant response
    crud.save_chat_message(db, request.session_id, "assistant", response)

    return {"response": response}


@router.post("/chat/session/{review_id}")
def create_chat_session(review_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get the latest active chat session, or create one if none exists"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")

    session = crud.get_latest_chat_session(db, review_id)
    if not session:
        session = crud.create_chat_session(db, review_id)
    return {"session_id": session.id}


@router.post("/chat/session/{review_id}/new")
def create_new_chat_session(review_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Create a completely new chat session for a review, resetting history"""
    review = crud.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this review")

    session = crud.create_chat_session(db, review_id)
    return {"session_id": session.id}


@router.get("/chat/history/{session_id}")
def get_chat_history(session_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Get chat history for a session"""
    session = db.query(crud.ChatSession).filter(crud.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    review = crud.get_review(db, session.review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.owner_id and review.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this session")

    messages = crud.get_chat_history(db, session_id)
    return [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in messages
    ]
