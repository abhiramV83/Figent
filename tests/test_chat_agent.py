import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import time
from backend.agents.chat_agent import ChatAgent

with open("tests/last_result.json", "r") as f:
    review_result = json.load(f)

agent = ChatAgent(review_result)

# Test intent-aware responses
questions = [
    "Give me a summary of the review",
    "Show me all critical findings in detail",
    "What issues were found in auth.py?",
    "Which PRs were opened and what are their links?",
    "Explain the command injection vulnerability",
    "What should I fix first to make this codebase safer?",
    "Why is the triple nested loop a problem?",
]

for question in questions:
    print(f"\nUser: {question}")
    intent = agent.detect_intent(question)
    print(f"Detected Intent: {intent}")
    response = agent.chat(question)
    # Safely print response replacing any potential non-ascii characters
    print(f"Figent: {response.encode('ascii', errors='replace').decode('ascii')}")
    print("-" * 55)
    time.sleep(5)