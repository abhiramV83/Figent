import json
from backend.tools.fix_generator import generate_fix

# Load last result instead of re-running graph
with open("tests/last_result.json", "r") as f:
    result = json.load(f)

# Test fix generation on first 3 PR eligible findings
pr_findings = [f for f in result["all_findings"] if f.get("pr_eligible")][:3]

# We need file contents — load from a real file for testing
# Use a hardcoded test case first
test_finding = {
    "file": "auth.py",
    "line": 5,
    "issue": "Hardcoded password in source code",
    "fix": "Move to environment variable",
    "severity": "critical",
    "confidence": 95
}

test_code = """import os

def connect():
    password = "admin122"
    host = "localhost"
    return f"{host}:{password}"
"""

print("Testing fix generator...\n")
fix = generate_fix(test_finding, test_code, "py")

print("GENERATED FIX:")
print(f"Original : {fix.get('original_code')}")
print(f"Fixed    : {fix.get('fixed_code')}")
print(f"Explain  : {fix.get('explanation')}")
print(f"Lines    : {fix.get('line_start')} → {fix.get('line_end')}")