import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv(override=True)

def get_llm():
    return ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.1 
    )