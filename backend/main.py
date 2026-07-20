from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db.database import create_tables
from backend.api.routes import router

app = FastAPI(
    title="Figent API",
    description="Autonomous multi-agent code review system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
async def startup():
    create_tables()
    print("Figent API started — tables ready")

@app.get("/health")
def health():
    return {"status": "ok", "service": "figent"}

app.include_router(router, prefix="/api")