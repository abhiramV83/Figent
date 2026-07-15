from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    repo_url = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, running, complete, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    total_findings = Column(Integer, default=0)
    pr_count = Column(Integer, default=0)
    issue_count = Column(Integer, default=0)
    error = Column(Text, nullable=True)

    findings = relationship("Finding", back_populates="review")
    chat_sessions = relationship("ChatSession", back_populates="review")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    file = Column(String, nullable=False)
    line = Column(Integer, nullable=True)
    issue = Column(Text, nullable=False)
    severity = Column(String, nullable=False)
    fix = Column(Text, nullable=True)
    confidence = Column(Integer, default=0)
    agents = Column(JSON, default=list)
    pr_eligible = Column(Boolean, default=False)
    action_taken = Column(String, default="report_only")  # open_pr, open_issue, report_only
    github_url = Column(String, nullable=True)

    review = relationship("Review", back_populates="findings")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("Review", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # user or assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")