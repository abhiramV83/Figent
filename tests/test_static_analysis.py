from backend.tools.repo_handler import RepoHandler
from backend.tools.static_analysis import analyze_file
import os

handler = RepoHandler()
repo_url = "https://github.com/pallets/flask"
repo_path = handler.clone(repo_url)

files = handler.get_code_files(repo_path)

# Test on first 5 python files only (don't scan everything yet)
python_files = [f for f in files if f["language"] == "py"][:5]

for f in python_files:
    full_path = os.path.join(repo_path, f["path"])
    results = analyze_file(full_path, f["language"])
    print(results)
    total_findings = len(results["bandit_findings"]) + len(results["radon_findings"])
    if total_findings > 0:
        print(f"\n{f['path']} — {total_findings} findings")
        for finding in results["bandit_findings"]:
            print(f"  [bandit] Line {finding['line']}: {finding['issue']}")
        for finding in results["radon_findings"]:
            print(f"  [radon] Line {finding['line']}: {finding['issue']}")

handler.cleanup(repo_path)
print("\nDone.")