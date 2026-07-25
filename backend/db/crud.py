from sqlalchemy.orm import Session
from backend.db.models import User, Review, Finding, ChatSession, ChatMessage
from datetime import datetime

def create_review(db: Session, repo_url: str, owner_id: int = None) -> Review:
    """Create a new review record"""
    review = Review(repo_url=repo_url, status="running", owner_id=owner_id)
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

def get_latest_chat_session(db: Session, review_id: int) -> ChatSession:
    """Get the most recent chat session for a review"""
    return db.query(ChatSession)\
             .filter(ChatSession.review_id == review_id)\
             .order_by(ChatSession.created_at.desc())\
             .first()

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

# ── User CRUD ───────────────────────────────────────────

def get_user_by_username(db: Session, username: str) -> User:
    """Find a user by username"""
    return db.query(User).filter(User.username == username).first()

def get_user_by_token(db: Session, token: str) -> User:
    """Find a user by their session token"""
    return db.query(User).filter(User.token == token).first()

def create_user(db: Session, username: str, password_hash: str, email: str = None) -> User:
    """Create a new user"""
    user = User(username=username, password_hash=password_hash, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user_verification_otp(db: Session, user: User, otp: str, expires_at: datetime) -> User:
    """Store verification OTP and expiration"""
    user.verification_otp = otp
    user.verification_otp_expires = expires_at
    db.commit()
    db.refresh(user)
    return user

def verify_user_email(db: Session, user: User) -> User:
    """Mark user as verified and clear OTP fields"""
    user.is_verified = True
    user.verification_otp = None
    user.verification_otp_expires = None
    db.commit()
    db.refresh(user)
    return user

def get_user_by_verification_otp(db: Session, email: str, otp: str) -> User:
    """Find a user by email and matching verification OTP"""
    return db.query(User).filter(
        User.email == email,
        User.verification_otp == otp
    ).first()

def update_user_token(db: Session, user: User, token: str, expires_at: datetime) -> User:
    """Update a user's active session token"""
    user.token = token
    user.token_expires = expires_at
    db.commit()
    db.refresh(user)
    return user

def get_user_by_email(db: Session, email: str) -> User:
    """Find a user by email"""
    return db.query(User).filter(User.email == email).first()

def get_user_by_reset_token(db: Session, token: str) -> User:
    """Find a user by reset token"""
    return db.query(User).filter(User.reset_token == token).first()

def update_user_reset_token(db: Session, user: User, token: str, expires_at: datetime) -> User:
    """Update user's password reset token"""
    user.reset_token = token
    user.reset_token_expires = expires_at
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user: User, password_hash: str) -> User:
    """Update user's hashed password and clear reset token"""
    user.password_hash = password_hash
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    return user

def get_user_reviews(db: Session, user_id: int) -> list:
    """Get all past reviews for a specific user"""
    return db.query(Review).filter(Review.owner_id == user_id).order_by(Review.created_at.desc()).all()