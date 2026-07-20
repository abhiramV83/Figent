from backend.tools.repo_handler import RepoHandler
from backend.tools.static_analysis import analyze_file
from backend.agents.quality_agent import quality_agent_node
from backend.agents.security_agent import security_agent_node
from backend.agents.performance_agent import performance_agent_node
import os

handler = RepoHandler()
repo_url = "https://github.com/abhiramV83/figent-test-repo"
repo_path = handler.clone(repo_url)

files = handler.get_code_files(repo_path)
test_files = files[:5]  # keep it small for now

# Attach tool results to each file
for f in test_files:
    full_path = os.path.join(repo_path, f["path"])
    f["tool_results"] = analyze_file(full_path, f["language"])

# Build full state
state = {
    "repo_url": repo_url,
    "repo_path": repo_path,
    "files": test_files,
    "quality_findings": [],
    "security_findings": [],
    "performance_findings": [],
    "all_findings": [],
    "final_report": {},
    "pr_urls": [],
    "error": None
}

# Run all 3 agents sequentially
print("\n--- Running Quality Agent ---")
state = quality_agent_node(state)

print("\n--- Running Security Agent ---")
state = security_agent_node(state)

print("\n--- Running Performance Agent ---")
state = performance_agent_node(state)

# Print summary
print("\n======= SUMMARY =======")
print(f"Quality findings:     {len(state['quality_findings'])}")
print(f"Security findings:    {len(state['security_findings'])}")
print(f"Performance findings: {len(state['performance_findings'])}")
total = (len(state['quality_findings']) +
         len(state['security_findings']) +
         len(state['performance_findings']))
print(f"Total findings:       {total}")

# Show critical and high severity only
print("\n--- HIGH/CRITICAL FINDINGS ---")
all_f = (state['quality_findings'] +
         state['security_findings'] +
         state['performance_findings'])

for f in all_f:
    # if f["severity"] in ["critical", "high"]:
    print(f"\n[{f['agent'].upper()}] {f['file']} — Line {f['line']}")
    print(f"  {f['issue']}")
    print(f"  Fix: {f['fix']}")
    print(f"  Confidence: {f['confidence']}")

handler.cleanup(repo_path)
print("\nDone.")