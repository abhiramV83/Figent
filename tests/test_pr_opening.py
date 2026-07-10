from backend.tools.github_handler import GitHubHandler, decide_action

REPO_URL = "https://github.com/YOUR_USERNAME/figent-test-repo"

# Test all 3 action types
findings = [
    {
        "file": "auth.py",
        "line": 4,
        "issue": "Hardcoded password in source code exposes credentials",
        "severity": "critical",
        "confidence": 95,
        "agents": ["security"],
        "fix": "Move to environment variable",
        "pr_eligible": True,
        "code_fix": {
            "original_code": 'password = "admin123"',
            "fixed_code": 'password = os.getenv("PASSWORD", "")',
            "explanation": "Replaced hardcoded password with environment variable"
        }
    },
    {
        "file": "utils.py",
        "line": 3,
        "issue": "Triple nested loop causes O(n³) time complexity",
        "severity": "medium",
        "confidence": 75,
        "agents": ["performance"],
        "fix": "Refactor using itertools or list comprehension",
        "pr_eligible": False,
        "code_fix": None
    },
    {
        "file": "utils.py",
        "line": 15,
        "issue": "Function has too many nested conditions",
        "severity": "low",
        "confidence": 55,
        "agents": ["quality"],
        "fix": "Simplify using early returns",
        "pr_eligible": False,
        "code_fix": None
    }
]

handler = GitHubHandler()

print("Testing GitHub actions...\n")
print("Action decisions:")
for f in findings:
    action = decide_action(f)
    print(f"  [{f['severity'].upper()}] {f['file']} → {action}")

print("\nExecuting actions...")
for f in findings:
    action = decide_action(f)
    if action == "open_pr":
        print(f"\nOpening PR for {f['file']}...")
        url = handler.create_pr_for_finding(REPO_URL, f)
        print(f"PR: {url}" if url else "PR failed")

    elif action == "open_issue":
        print(f"\nOpening Issue for {f['file']}...")
        url = handler.create_issue_for_finding(REPO_URL, f)
        print(f"Issue: {url}" if url else "Issue failed")

    else:
        print(f"\nReport only: {f['file']} (confidence too low)")