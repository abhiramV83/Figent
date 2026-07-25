import sys
import os
# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.graph import build_graph
from backend.tools.repo_handler import RepoHandler
import json

# Known buggy repos for evaluation
TEST_REPOS = [
    "https://github.com/abhiramV83/figent-test-repo",
]

KNOWN_ISSUES = {
    "figent-test-repo": [
        {"file": "auth.py", "type": "hardcoded_password", "severity": "critical"},
        {"file": "auth.py", "type": "sql_injection", "severity": "critical"},
        {"file": "auth.py", "type": "command_injection", "severity": "high"},
        {"file": "utils.py", "type": "n_cubed_complexity", "severity": "high"},
    ]
}

def evaluate():
    app = build_graph()
    results = []

    for repo_url in TEST_REPOS:
        repo_name = repo_url.split("/")[-1]
        known = KNOWN_ISSUES.get(repo_name, [])

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

        result = app.invoke(initial_state)
        findings = result.get("all_findings", [])

        # Calculate precision and recall
        detected_types = []
        for f in findings:
            issue_lower = f["issue"].lower()
            if "password" in issue_lower or "hardcoded" in issue_lower:
                detected_types.append("hardcoded_password")
            if "sql" in issue_lower or "injection" in issue_lower:
                detected_types.append("sql_injection")
            if "command" in issue_lower or "subprocess" in issue_lower:
                detected_types.append("command_injection")
            if "nested" in issue_lower or "complexity" in issue_lower or "n^3" in issue_lower:
                detected_types.append("n_cubed_complexity")

        known_types = [k["type"] for k in known]
        true_positives = len(set(detected_types) & set(known_types))
        precision = true_positives / len(detected_types) if detected_types else 0
        recall = true_positives / len(known_types) if known_types else 0

        results.append({
            "repo": repo_name,
            "known_issues": len(known),
            "detected": len(findings),
            "true_positives": true_positives,
            "precision": round(precision * 100, 1),
            "recall": round(recall * 100, 1)
        })

        handler = RepoHandler()
        if result["repo_path"]:
            handler.cleanup(result["repo_path"])

    print("\n===== FIGENT EVAL RESULTS =====")
    for r in results:
        print(f"\nRepo: {r['repo']}")
        print(f"  Known issues:  {r['known_issues']}")
        print(f"  Detected:      {r['detected']}")
        print(f"  True positives:{r['true_positives']}")
        print(f"  Precision:     {r['precision']}%")
        print(f"  Recall:        {r['recall']}%")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    results_path = os.path.join(os.path.dirname(script_dir), "results.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to {results_path}")

if __name__ == "__main__":
    evaluate()