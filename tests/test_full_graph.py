from backend.graph import build_graph
from backend.tools.repo_handler import RepoHandler
handler = RepoHandler()

app = build_graph()

initial_state = {
    "repo_url": "https://github.com/abhiramV83/figent-test-repo",
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

print("Starting Figent analysis...\n")
result = app.invoke(initial_state)
import json
with open("tests/last_result.json", "w") as f:
    result_to_save = {
        **result,
        "files": [{"path": f["path"], "language": f["language"]} for f in result["files"]]
    }
    json.dump(result_to_save, f, indent=2)
print("Result saved to tests/last_result.json")

print("\n======= FIGENT REPORT =======")
print(f"Files analyzed:    {len(result['files'])}")
print(f"Raw findings:      {len(result['quality_findings']) + len(result['security_findings']) + len(result['performance_findings'])}")
print(f"After dedup:       {len(result['all_findings'])}")
print(f"PR eligible:       {result['final_report'].get('pr_eligible_count', 0)}")
print(f"By severity:       {result['final_report'].get('by_severity', {})}")

print("\n" + "="*60)
print("         FIGENT CODE REVIEW REPORT")
print("="*60)
print(f"Repository: {result['repo_url']}")
print(f"Files Analyzed: {len(result['files'])}")
print(f"Total Issues Found: {result['final_report'].get('total', 0)}")
print(f"PR Eligible: {result['final_report'].get('pr_eligible_count', 0)}")

severity = result['final_report'].get('by_severity', {})
print(f"\nSeverity Breakdown:")
print(f"  🔴 Critical : {severity.get('critical', 0)}")
print(f"  🟠 High     : {severity.get('high', 0)}")
print(f"  🟡 Medium   : {severity.get('medium', 0)}")
print(f"  🟢 Low      : {severity.get('low', 0)}")

print("\n" + "="*60)
print("FINDINGS")
print("="*60)

for i, f in enumerate(result["all_findings"], 1):
    severity_icon = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢"
    }.get(f["severity"], "⚪")

    pr_badge = "✅ PR WILL BE OPENED" if f.get("pr_eligible", False) else "📋 REPORT ONLY"

    print(f"""
#{i} {severity_icon} {f['severity'].upper()} — {f['file']} (Line {f['line']})
{'─'*55}
🔍 Issue     : {f['issue']}
🔧 Fix       : {f['fix']}
📊 Confidence: {f['confidence']}%
🤖 Agents    : {', '.join(f['agents'])}
🚀 Action    : {pr_badge}
""")

print("="*60)
print(f"Analysis Complete.")
print("="*60)


handler.cleanup(result["repo_path"])
print("\nDone.")