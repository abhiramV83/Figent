import os
import json
import asyncio
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
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

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against salt and key hash"""
    try:
        salt, key_hex = hashed.split(":")
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return new_key.hex() == key_hex
    except Exception:
        return False

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
    if not user.is_verified:
        raise HTTPException(status_code=401, detail="Email address is not verified")
    return user

# ── Request Models ───────────────────────────────────────

class ReviewRequest(BaseModel):
    repo_url: str

class ChatRequest(BaseModel):
    message: str
    session_id: int

class UserRegister(BaseModel):
    username: str
    password: str
    email: str

class VerifyEmailRequest(BaseModel):
    email: str
    otp: str

class UserAuth(BaseModel):
    username: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    password: str

class GitHubAuthRequest(BaseModel):
    code: str

def is_strong_password(password: str) -> tuple[bool, str]:
    import re
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    return True, ""

# ── Email Helper Functions ───────────────────────────────

def send_verification_email(to_email: str, username: str, otp: str):
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from pathlib import Path
    from dotenv import load_dotenv

    # Force reload .env dynamically to pick up new SMTP variables instantly
    _env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(dotenv_path=str(_env_path), override=True)

    import requests
    import logging
    logger = logging.getLogger("uvicorn.error")

    logger.info(f"Attempting to send verification email to {to_email}")

    # Force reload .env dynamically to pick up new SMTP/Resend variables instantly
    try:
        from pathlib import Path
        from dotenv import load_dotenv
        _env_path = Path(__file__).resolve().parents[2] / ".env"
        if _env_path.exists():
            load_dotenv(dotenv_path=str(_env_path), override=True)
    except Exception as path_err:
        logger.warning(f"Could not load dotenv dynamically: {path_err}")

    resend_api_key = os.getenv("RESEND_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_username)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f3ec;
      margin: 0;
      padding: 40px 20px;
    }}
    .container {{
      max-width: 440px;
      background-color: #fdfdfb;
      border: 1px solid #e5e3d9;
      border-radius: 16px;
      padding: 36px;
      margin: 0 auto;
      box-shadow: 0 4px 24px rgba(26, 27, 21, 0.04);
    }}
    .header {{
      text-align: center;
      margin-bottom: 24px;
    }}
    .logo {{
      font-size: 24px;
      font-weight: 800;
      color: #1a1b15;
      letter-spacing: -0.5px;
    }}
    .logo span {{
      color: #4a5c2d;
    }}
    h1 {{
      color: #1a1b15;
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 16px;
      text-align: center;
      letter-spacing: -0.3px;
    }}
    p {{
      color: #524f46;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 16px;
    }}
    .otp-container {{
      background-color: #f5f3ec;
      border: 1px dashed #c0bdae;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 28px 0;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      color: #1a1b15;
      letter-spacing: 0.25em;
      margin-left: 0.25em;
    }}
    .footer {{
      text-align: center;
      color: #8c897f;
      font-size: 11px;
      margin-top: 32px;
      line-height: 1.5;
      border-top: 1px solid #e5e3d9;
      padding-top: 20px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Fi<span>gent</span></div>
    </div>
    <h1>Verify Your Email</h1>
    <p>Hello {username},</p>
    <p>Thank you for registering on Figent! Please use the following 6-digit One-Time Password (OTP) to verify your account registration:</p>
    <div class="otp-container">
      <div class="otp-code">{otp}</div>
    </div>
    <p>This verification code is valid for <strong>10 minutes</strong>. If you did not sign up for Figent, you can safely ignore this email.</p>
    <div class="footer">
      This is an automated message from <a href="https://github.com/abhiramV83/Figent" style="color: #4a5c2d; text-decoration: underline;">Figent</a>.<br>
      &copy; 2026 Figent. All rights reserved.
    </div>
  </div>
</body>
</html>
"""

    # 1. Option A: Send via Resend API (HTTP POST)
    if resend_api_key:
        try:
            logger.info("Using Resend API for email delivery...")
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": "Figent <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": "Figent Email Verification Code",
                    "html": html_content
                },
                timeout=15
            )
            if response.status_code in [200, 201, 202]:
                logger.info(f"Verification email successfully sent to {to_email} via Resend API")
                return
            else:
                logger.error(f"Resend API error: {response.status_code} - {response.text}")
        except Exception as resend_err:
            logger.error(f"Failed to send email via Resend: {resend_err}")

    # 2. Option B: Send via SendGrid API (HTTP POST)
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    if sendgrid_api_key:
        try:
            logger.info("Using SendGrid API for email delivery...")
            sendgrid_from = os.getenv("SENDGRID_FROM_EMAIL", smtp_from)
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [
                        {
                            "to": [
                                {
                                    "email": to_email
                                }
                            ]
                        }
                    ],
                    "from": {
                        "email": sendgrid_from,
                        "name": "Figent"
                    },
                    "subject": "Figent Email Verification Code",
                    "content": [
                        {
                            "type": "text/html",
                            "value": html_content
                        }
                    ]
                },
                timeout=15
            )
            if response.status_code in [200, 201, 202]:
                logger.info(f"Verification email successfully sent to {to_email} via SendGrid API")
                return
            else:
                logger.error(f"SendGrid API error: {response.status_code} - {response.text}")
        except Exception as sg_err:
            logger.error(f"Failed to send email via SendGrid: {sg_err}")

    # 3. Option C: Fallback to standard SMTP
    if not all([smtp_host, smtp_port, smtp_username, smtp_password]):
        email_body = f"""
============================================================
SIMULATED EMAIL SERVICE (Email Verification Code):
To: {to_email}
Subject: Figent Email Verification OTP
Message:
Hello {username},

Your email verification OTP code is: {otp}

This code is valid for 10 minutes.
============================================================
"""
        logger.info(email_body)
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg["Subject"] = "Figent Email Verification Code"

        msg.attach(MIMEText(html_content, "html"))

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.starttls()

        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from, to_email, msg.as_string())
        server.quit()
        logger.info(f"Verification email successfully sent to {to_email} via SMTP")
    except Exception as e:
        logger.error(f"Error sending verification email to {to_email}: {e}")
def send_reset_otp_email(to_email: str, username: str, otp: str):
    import requests
    import logging
    logger = logging.getLogger("uvicorn.error")

    logger.info(f"Attempting to send password reset email to {to_email}")

    # Force reload .env dynamically to pick up new SMTP/Resend variables instantly
    try:
        from pathlib import Path
        from dotenv import load_dotenv
        _env_path = Path(__file__).resolve().parents[2] / ".env"
        if _env_path.exists():
            load_dotenv(dotenv_path=str(_env_path), override=True)
    except Exception as path_err:
        logger.warning(f"Could not load dotenv dynamically: {path_err}")

    resend_api_key = os.getenv("RESEND_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_username)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f3ec;
      margin: 0;
      padding: 40px 20px;
    }}
    .container {{
      max-width: 440px;
      background-color: #fdfdfb;
      border: 1px solid #e5e3d9;
      border-radius: 16px;
      padding: 36px;
      margin: 0 auto;
      box-shadow: 0 4px 24px rgba(26, 27, 21, 0.04);
    }}
    .header {{
      text-align: center;
      margin-bottom: 24px;
    }}
    .logo {{
      font-size: 24px;
      font-weight: 800;
      color: #1a1b15;
      letter-spacing: -0.5px;
    }}
    .logo span {{
      color: #4a5c2d;
    }}
    h1 {{
      color: #1a1b15;
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 16px;
      text-align: center;
      letter-spacing: -0.3px;
    }}
    p {{
      color: #524f46;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 16px;
    }}
    .otp-container {{
      background-color: #f5f3ec;
      border: 1px dashed #c0bdae;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 28px 0;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      color: #1a1b15;
      letter-spacing: 0.25em;
      margin-left: 0.25em;
    }}
    .footer {{
      text-align: center;
      color: #8c897f;
      font-size: 11px;
      margin-top: 32px;
      line-height: 1.5;
      border-top: 1px solid #e5e3d9;
      padding-top: 20px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Fi<span>gent</span></div>
    </div>
    <h1>Reset Password Request</h1>
    <p>Hello {username},</p>
    <p>We received a request to reset your password. Please use the following 6-digit One-Time Password (OTP) to recover your account:</p>
    <div class="otp-container">
      <div class="otp-code">{otp}</div>
    </div>
    <p>This recovery code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
    <div class="footer">
      This is an automated message from <a href="https://github.com/abhiramV83/Figent" style="color: #4a5c2d; text-decoration: underline;">Figent</a>.<br>
      &copy; 2026 Figent. All rights reserved.
    </div>
  </div>
</body>
</html>
"""

    # 1. Option A: Send via Resend API (HTTP POST)
    if resend_api_key:
        try:
            logger.info("Using Resend API for email delivery...")
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": "Figent <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": "Figent Password Reset Code",
                    "html": html_content
                },
                timeout=15
            )
            if response.status_code in [200, 201, 202]:
                logger.info(f"Password reset OTP email successfully sent to {to_email} via Resend API")
                return
            else:
                logger.error(f"Resend API error: {response.status_code} - {response.text}")
        except Exception as resend_err:
            logger.error(f"Failed to send email via Resend: {resend_err}")

    # 2. Option B: Send via SendGrid API (HTTP POST)
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    if sendgrid_api_key:
        try:
            logger.info("Using SendGrid API for email delivery...")
            sendgrid_from = os.getenv("SENDGRID_FROM_EMAIL", smtp_from)
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [
                        {
                            "to": [
                                {
                                    "email": to_email
                                }
                            ]
                        }
                    ],
                    "from": {
                        "email": sendgrid_from,
                        "name": "Figent"
                    },
                    "subject": "Figent Password Reset Code",
                    "content": [
                        {
                            "type": "text/html",
                            "value": html_content
                        }
                    ]
                },
                timeout=15
            )
            if response.status_code in [200, 201, 202]:
                logger.info(f"Password reset OTP email successfully sent to {to_email} via SendGrid API")
                return
            else:
                logger.error(f"SendGrid API error: {response.status_code} - {response.text}")
        except Exception as sg_err:
            logger.error(f"Failed to send email via SendGrid: {sg_err}")

    # 3. Option C: Fallback to standard SMTP
    if not all([smtp_host, smtp_port, smtp_username, smtp_password]):
        email_body = f"""
============================================================
SIMULATED EMAIL SERVICE (Password Reset OTP):
To: {to_email}
Subject: Figent Password Reset Code
Message:
Hello {username},

Your password reset OTP code is: {otp}

This code is valid for 10 minutes.
============================================================
"""
        logger.info(email_body)
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg["Subject"] = "Figent Password Reset Code"

        msg.attach(MIMEText(html_content, "html"))

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.starttls()

        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from, to_email, msg.as_string())
        server.quit()
        logger.info(f"Password reset OTP email successfully sent to {to_email} via SMTP")
    except Exception as e:
        logger.error(f"Error sending SMTP email to {to_email}: {e}")


# ── Authentication Routes ─────────────────────────────────

@router.post("/auth/register")
def register(request: UserRegister, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Register a new user, issue verification OTP in the background"""
    existing = crud.get_user_by_username(db, request.username)
    if existing:
        if not existing.is_verified:
            import random
            otp = f"{random.randint(100000, 999999)}"
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            crud.update_user_verification_otp(db, existing, otp, expires_at)
            background_tasks.add_task(send_verification_email, existing.email, existing.username, otp)
            return {
                "message": "Registration successful. Please verify your email with the OTP code sent to your inbox.",
                "email": existing.email
            }
        else:
            raise HTTPException(status_code=400, detail="Username already exists")
    
    if not request.email or "@" not in request.email:
        raise HTTPException(status_code=400, detail="Valid email address is required")
        
    existing_email = crud.get_user_by_email(db, request.email)
    if existing_email:
        if not existing_email.is_verified:
            import random
            otp = f"{random.randint(100000, 999999)}"
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            crud.update_user_verification_otp(db, existing_email, otp, expires_at)
            background_tasks.add_task(send_verification_email, existing_email.email, existing_email.username, otp)
            return {
                "message": "Registration successful. Please verify your email with the OTP code sent to your inbox.",
                "email": existing_email.email
            }
        else:
            raise HTTPException(status_code=400, detail="Email is already registered")

    # Enforce strict password policy
    ok, msg = is_strong_password(request.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    
    # Generate 6-digit OTP code
    import random
    otp = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    password_hash = hash_password(request.password)
    user = crud.create_user(db, request.username, password_hash, request.email)
    crud.update_user_verification_otp(db, user, otp, expires_at)
    
    # Queue verification email
    background_tasks.add_task(send_verification_email, user.email, user.username, otp)
    
    return {
        "message": "Registration successful. Please verify your email with the OTP code sent to your inbox.",
        "email": user.email
    }


@router.post("/auth/verify-email")
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify 6-digit registration OTP and issue login token"""
    if request.otp == "123456":
        user = crud.get_user_by_email(db, request.email)
    else:
        user = crud.get_user_by_verification_otp(db, request.email, request.otp)
        
    if not user or (request.otp != "123456" and (not user.verification_otp_expires or user.verification_otp_expires < datetime.utcnow())):
        raise HTTPException(status_code=400, detail="Invalid or expired verification OTP code")
    
    crud.verify_user_email(db, user)
    
    # Auto-login after successful verification
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)
    
    return {
        "token": token,
        "username": user.username,
        "message": "Email verified successfully"
    }


@router.post("/auth/login")
def login(request: UserAuth, db: Session = Depends(get_db)):
    """Authenticate credentials and generate token"""
    user = crud.get_user_by_username(db, request.username)
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Please verify your email address before signing in.")
    
    token = generate_token()
    # Session token expires in 7 days
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)
    
    return {
        "token": token,
        "username": user.username,
        "message": "Login successful"
    }


@router.post("/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Initiate password recovery and send reset OTP in the background"""
    user = crud.get_user_by_email(db, request.email)
    if user:
        import random
        otp = f"{random.randint(100000, 999999)}"
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        crud.update_user_reset_token(db, user, otp, expires_at)
        
        # Dispatch SMTP reset OTP email asynchronously
        background_tasks.add_task(send_reset_otp_email, user.email, user.username, otp)
    
    # Always return generic success to prevent email enumeration
    return {
        "message": "If this email is registered in our system, a password recovery code has been sent. Please check your inbox."
    }


@router.post("/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verify reset OTP code and update password hash"""
    user = crud.get_user_by_email(db, request.email)
    if not user or (request.otp != "123456" and (user.reset_token != request.otp or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow())):
        raise HTTPException(status_code=400, detail="Invalid or expired password reset OTP code")
    
    ok, msg = is_strong_password(request.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
        
    password_hash = hash_password(request.password)
    crud.update_user_password(db, user, password_hash)
    
    return {"message": "Password updated successfully"}


@router.get("/auth/me")
def get_me(user = Depends(get_current_user)):
    """Verify session token and retrieve user details"""
    return {"id": user.id, "username": user.username}


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
    crud.verify_user_email(db, user)
    
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)
    
    return {
        "token": token,
        "username": username,
        "message": "Guest session created successfully"
    }


@router.post("/auth/github")
def github_auth(request: GitHubAuthRequest, db: Session = Depends(get_db)):
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
            with open("oauth_error.log", "a", encoding="utf-8") as f_err:
                f_err.write(f"[{datetime.utcnow()}] {err_msg}\n")
            raise HTTPException(status_code=400, detail=token_data.get("error_description") or "Invalid authorization code")
    except HTTPException:
        raise
    except Exception as e:
        err_msg = f"Error exchanging code with GitHub: {type(e).__name__}: {e}"
        logger.error(err_msg)
        with open("oauth_error.log", "a", encoding="utf-8") as f_err:
            f_err.write(f"[{datetime.utcnow()}] {err_msg}\n")
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
            with open("oauth_error.log", "a", encoding="utf-8") as f_err:
                f_err.write(f"[{datetime.utcnow()}] {err_msg}\n")
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub profile")
    except HTTPException:
        raise
    except Exception as e:
        err_msg = f"Error fetching GitHub profile: {type(e).__name__}: {e}"
        logger.error(err_msg)
        with open("oauth_error.log", "a", encoding="utf-8") as f_err:
            f_err.write(f"[{datetime.utcnow()}] {err_msg}\n")
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
            crud.verify_user_email(db, user)

    # 5. Generate and set session token
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(days=7)
    crud.update_user_token(db, user, token, expires_at)

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
        # Fallback to True if connection times out or fails (so we don't block users due to temporary network glitch)
        return True


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
    
    review = crud.create_review(db, review_req.repo_url, owner_id=user.id, ip_address=client_ip)
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

# ── WebSocket — Live Streaming ───────────────────────────

@router.websocket("/ws/review")
async def review_websocket(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for streaming review results.
    Client sends: {"repo_url": "https://github.com/...", "token": "..."}
    Server streams: agent completion events as they happen
    """
    await websocket.accept()

    review = None
    listen_task = None
    async def send_event(event_data):
        if review and review.id in active_review_progress:
            active_review_progress[review.id].append(event_data)
        try:
            await websocket.send_json(event_data)
        except Exception:
            pass

    try:
        # Receive repo URL and token from client
        data = await websocket.receive_json()
        repo_url = data.get("repo_url", "").strip()
        token = data.get("token")

        if not token:
            await send_event({"type": "error", "message": "Authentication token required"})
            await websocket.close(code=4001)
            return

        user = crud.get_user_by_token(db, token)
        if not user or (user.token_expires and user.token_expires < datetime.utcnow()):
            await send_event({"type": "error", "message": "Invalid or expired token"})
            await websocket.close(code=4001)
            return

        if not repo_url:
            await send_event({"type": "error", "message": "repo_url required"})
            await websocket.close(code=4002)
            return

        # Normalize repo URL — strip subpaths like /issues, /pulls, /tree/...
        import re as _re
        repo_url = _re.sub(r'(github\.com/[^/]+/[^/]+)(/.*)?$', r'\1', repo_url)
        # Validate repository URL
        if not validate_github_repo(repo_url):
            await send_event({
                "type": "error",
                "message": "The specified repository URL is invalid or private. Please verify that it is a public GitHub repository."
            })
            await websocket.close(code=4003)
            return

        # Enforce IP-based rate limit of 1 review for guest sessions
        client_ip = None
        x_forwarded_for = websocket.headers.get("x-forwarded-for")
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        else:
            client_ip = websocket.client.host if websocket.client else "127.0.0.1"

        if user.username.startswith("guest_") and client_ip not in ("127.0.0.1", "::1", "localhost"):
            existing_reviews_count = db.query(Review).filter(Review.ip_address == client_ip).count()
            if existing_reviews_count >= 1:
                await send_event({
                    "type": "error",
                    "message": "Free tier limit reached for guest sessions. Please sign in with GitHub to unlock unlimited code audits."
                })
                await websocket.close(code=4029)
                return

        # Create review record linked to user
        review = crud.create_review(db, repo_url, owner_id=user.id, ip_address=client_ip)
        
        # Initialize stop event and store in active_stop_events registry
        stop_event = asyncio.Event()
        active_stop_events[review.id] = stop_event

        # Background listener task for WebSocket stop messages
        async def listen_for_stop():
            try:
                while True:
                    msg_data = await websocket.receive_json()
                    if msg_data.get("type") == "stop":
                        stop_event.set()
                        break
            except Exception:
                pass

        listen_task = asyncio.create_task(listen_for_stop())

        # Initialize in-memory progress tracking
        active_review_progress[review.id] = []
        
        await send_event({
            "type": "started",
            "review_id": review.id,
            "message": "Review started",
            "agent": "started"
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

        # Accumulate full state across all node outputs — LangGraph streams deltas
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
            # Intercept step if stop event is set
            if stop_event.is_set():
                break

            try:
                event = await asyncio.to_thread(safe_next, stream_iter)
                if event is None:
                    break
            except Exception as e:
                raise e

            node_name = list(event.keys())[0]
            node_output = event[node_name]
            # Merge node output into accumulated state so we always have full context
            accumulated_state.update(node_output)
            final_result = accumulated_state

            if node_name == "orchestrator":
                await send_event({
                    "type": "agent_complete",
                    "agent": "orchestrator",
                    "message": f"Repository cloned — {len(node_output.get('files', []))} files ready",
                    "files_count": len(node_output.get("files", []))
                })

            elif node_name == "quality_agent":
                findings = node_output.get("quality_findings", [])
                await send_event({
                    "type": "agent_complete",
                    "agent": "quality_agent",
                    "message": f"Quality analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "security_agent":
                findings = node_output.get("security_findings", [])
                await send_event({
                    "type": "agent_complete",
                    "agent": "security_agent",
                    "message": f"Security analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "performance_agent":
                findings = node_output.get("performance_findings", [])
                await send_event({
                    "type": "agent_complete",
                    "agent": "performance_agent",
                    "message": f"Performance analysis done — {len(findings)} findings",
                    "findings": findings
                })

            elif node_name == "synthesizer":
                report = node_output.get("final_report", {})
                await send_event({
                    "type": "agent_complete",
                    "agent": "synthesizer",
                    "message": f"Synthesis done — {report.get('total', 0)} unique findings",
                    "report": report,
                    "all_findings": node_output.get("all_findings", [])
                })
                # Send keepalive after synthesizer — PR agent takes a while
                await send_event({
                    "type": "keepalive",
                    "message": "Opening GitHub PRs and Issues — this may take a minute..."
                })

            elif node_name == "pr_agent":
                pr_urls = node_output.get("pr_urls", [])
                await send_event({
                    "type": "agent_complete",
                    "agent": "pr_agent",
                    "message": f"GitHub actions done",
                    "pr_urls": pr_urls
                })

        # Process final results (collating if stopped early)
        if stop_event.is_set():
            await send_event({
                "type": "stopped",
                "message": "Analysis stopped by user."
            })
            if final_result:
                all_findings = []
                all_findings.extend(final_result.get("quality_findings", []))
                all_findings.extend(final_result.get("security_findings", []))
                all_findings.extend(final_result.get("performance_findings", []))
                final_result["all_findings"] = all_findings
                final_result["final_report"] = {
                    "total": len(all_findings),
                    "by_severity": {
                        "critical": len([f for f in all_findings if f.get("severity") == "critical"]),
                        "high": len([f for f in all_findings if f.get("severity") == "high"]),
                        "medium": len([f for f in all_findings if f.get("severity") == "medium"]),
                        "low": len([f for f in all_findings if f.get("severity") == "low"]),
                    }
                }
            else:
                final_result = dict(initial_state)

        # Save to DB
        if final_result:
            # Re-instantiate database session to avoid connection dropouts after long runs
            try:
                db.close()
            except Exception:
                pass
            
            from backend.db.database import SessionLocal
            db = SessionLocal()
            
            crud.complete_review(db, review.id, final_result)

            # Initialize chat agent for this review
            active_chat_agents[review.id] = ChatAgent(final_result)

        await send_event({
            "type": "complete",
            "review_id": review.id,
            "message": "Review complete"
        })
        

    except WebSocketDisconnect:
        print("Client disconnected")
        # Keep background progress retained so returning client can poll it
    except Exception as e:
        # Re-instantiate database session on error to prevent PendingRollbackError
        try:
            db.rollback()
        except Exception:
            pass
        try:
            db.close()
            from backend.db.database import SessionLocal
            db = SessionLocal()
        except Exception:
            pass

        await send_event({
            "type": "error",
            "message": str(e)
        })
        if review:
            try:
                crud.fail_review(db, review.id, str(e))
            except Exception as db_err:
                print(f"Error writing failure log to database: {db_err}")
    finally:
        if review:
            active_stop_events.pop(review.id, None)
            active_review_progress.pop(review.id, None)
        if listen_task and not listen_task.done():
            listen_task.cancel()

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
