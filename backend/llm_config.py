import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv(override=True)

def get_llm():
    from pathlib import Path
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=str(_env_path), override=True)
    return ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.1 
    )