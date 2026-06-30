from backend.graph import build_graph
from backend.tools.repo_handler import RepoHandler

app = build_graph()

initial_state = {
    "repo_url": "https://github.com/pallets/flask",
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

print("Starting full graph run...\n")
result = app.invoke(initial_state)

print("\n======= GRAPH COMPLETE =======")
print(f"Error: {result['error']}")
print(f"Files analyzed: {len(result['files'])}")
print(f"Quality findings: {len(result['quality_findings'])}")
print(f"Security findings: {len(result['security_findings'])}")
print(f"Performance findings: {len(result['performance_findings'])}")

# Cleanup
handler = RepoHandler()
if result["repo_path"]:
    handler.cleanup(result["repo_path"])

print("\nDone.")