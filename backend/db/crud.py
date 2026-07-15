from sqlalchemy.orm import Session
from backend.db.models import Review, Finding, ChatSession, ChatMessage
from datetime import datetime

def create_review(db: Session, repo_url: str) -> Review:
    """Create a new review record"""
    review = Review(repo_url=repo_url, status="running")
    db.add(review)
    db.commit()
    db.refresh(review)
    return review

def complete_review(db: Session, review_id: int, result: dict) -> Review:
    """Update review with completed results"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        return None

    pr_urls = result.get("pr_urls", [])
    pr_count = len([p for p in pr_urls if p["type"] == "pr"])
    issue_count = len([p for p in pr_urls if p["type"] == "issue"])

    review.status = "complete"
    review.completed_at = datetime.utcnow()
    review.total_findings = len(result.get("all_findings", []))
    review.pr_count = pr_count
    review.issue_count = issue_count
    review.error = result.get("error")

    # Save all findings
    for f in result.get("all_findings", []):
        # Find if this finding had a github action
        github_url = None
        action_taken = "report_only"
        for p in pr_urls:
            if p["file"] == f["file"] and p["line"] == f.get("line"):
                github_url = p["url"]
                action_taken = p["type"]
                break

        finding = Finding(
            review_id=review_id,
            file=f["file"],
            line=f.get("line"),
            issue=f["issue"],
            severity=f["severity"],
            fix=f.get("fix"),
            confidence=f.get("confidence", 0),
            agents=f.get("agents", []),
            pr_eligible=f.get("pr_eligible", False),
            action_taken=action_taken,
            github_url=github_url
        )
        db.add(finding)

    db.commit()
    db.refresh(review)
    return review

def get_review(db: Session, review_id: int) -> Review:
    """Get a review by ID with all findings"""
    return db.query(Review).filter(Review.id == review_id).first()

def get_all_reviews(db: Session) -> list:
    """Get all reviews — for history view"""
    return db.query(Review).order_by(Review.created_at.desc()).all()

def create_chat_session(db: Session, review_id: int) -> ChatSession:
    """Create a new chat session for a review"""
    session = ChatSession(review_id=review_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def save_chat_message(db: Session, session_id: int,
                      role: str, content: str) -> ChatMessage:
    """Save a chat message"""
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_chat_history(db: Session, session_id: int) -> list:
    """Get all messages for a chat session"""
    return db.query(ChatMessage)\
             .filter(ChatMessage.session_id == session_id)\
             .order_by(ChatMessage.created_at)\
             .all()

def fail_review(db: Session, review_id: int, error: str) -> Review:
    """Mark a review as failed"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if review:
        review.status = "failed"
        review.error = error
        db.commit()
    return review