from backend.tools.repo_handler import RepoHandler
from backend.tools.static_analysis import analyze_file
from backend.agents.quality_agent import quality_agent_node
import os

handler = RepoHandler()
repo_url = "https://github.com/pallets/flask"
repo_path = handler.clone(repo_url)

files = handler.get_code_files(repo_path)
python_files = [f for f in files if f["language"] == "py"][:3]  # test on just 3

# Attach tool results to each file (manual for now, orchestrator does this tomorrow)
for f in python_files:
    full_path = os.path.join(repo_path, f["path"])
    f["tool_results"] = analyze_file(full_path, f["language"])

# Build minimal state to test the agent
state = {
    "files": python_files,
    "quality_findings": []
}

result = quality_agent_node(state)

print("\n--- QUALITY FINDINGS ---")
for finding in result["quality_findings"]:
    print(f"\n{finding['file']} — Line {finding['line']}")
    print(f"  Issue: {finding['issue']}")
    print(f"  Severity: {finding['severity']} | Confidence: {finding['confidence']}")
    print(f"  Fix: {finding['fix']}")

handler.cleanup(repo_path)