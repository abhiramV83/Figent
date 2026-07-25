import subprocess
import json
import sys
import os
from typing import List, Dict

def get_executable_path(name: str) -> str:
    """Get the path to the executable, checking the virtual environment's bin/Scripts directory first."""
    bindir = os.path.dirname(sys.executable)
    ext = ".exe" if os.name == "nt" else ""
    local_path = os.path.join(bindir, f"{name}{ext}")
    if os.path.exists(local_path):
        return local_path
    return name  # Fallback to system PATH

def run_bandit(file_path: str) -> List[Dict]:
    """Run bandit security scan on a single file, return structured findings"""
    try:
        result = subprocess.run(
            [get_executable_path("bandit"), "-f", "json", file_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        findings = []
        for issue in data.get("results", []):
            findings.append({
                "line": issue["line_number"],
                "issue": issue["issue_text"],
                "severity": issue["issue_severity"].lower(),
                "confidence": issue["issue_confidence"],
                "source": "bandit"
            })
        return findings

    except Exception as e:
        print(f"Bandit error on {file_path}: {e}")
        return []


def run_radon(file_path: str) -> List[Dict]:
    """Run radon complexity analysis, return structured findings"""
    try:
        result = subprocess.run(
            [get_executable_path("radon"), "cc", "-j", file_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        data = json.loads(result.stdout)

        findings = []
        for file_key, blocks in data.items():
            for block in blocks:
                # Only flag functions with high complexity
                if block["complexity"] > 8:
                    findings.append({
                        "line": block["lineno"],
                        "issue": f"High complexity in '{block['name']}' (score: {block['complexity']})",
                        "severity": "medium" if block["complexity"] <= 15 else "high",
                        "source": "radon"
                    })
        return findings

    except Exception as e:
        print(f"Radon error on {file_path}: {e}")
        return []


def analyze_file(file_path: str, language: str) -> Dict:
    """Run all applicable static analysis tools on a file"""
    if language != "py":
        # Tools are Python-only — non-python files skip this step
        return {"bandit_findings": [], "radon_findings": []}

    return {
        "bandit_findings": run_bandit(file_path),
        "radon_findings": run_radon(file_path)
    }