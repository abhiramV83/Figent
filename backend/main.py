from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db.database import create_tables
from backend.api.routes import router

@asynccontextmanager
async def lifespan(app):
    create_tables()
    print("Figent API started — tables ready")
    yield

import os

env = os.getenv("ENVIRONMENT", "development")
show_docs = env != "production"

app = FastAPI(
    title="Figent API",
    description="Autonomous multi-agent code review system",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if show_docs else None,
    redoc_url="/redoc" if show_docs else None,
    openapi_url="/openapi.json" if show_docs else None
)

origins = ["http://localhost:3000", "http://localhost:5173"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    if "," in frontend_url:
        origins.extend([url.strip() for url in frontend_url.split(",") if url.strip()])
    else:
        origins.append(frontend_url.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "figent"}

app.include_router(router, prefix="/api")