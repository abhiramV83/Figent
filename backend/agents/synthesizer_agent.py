import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call

SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}

def group_by_location(findings: list) -> dict:
    """Group findings by file + approximate line (within 5 lines = same issue)"""
    groups = {}
    for f in findings:
        file = f["file"]
        line = f.get("line", 0)

        matched = False
        for key in groups:
            key_file, key_line = key
            if key_file == file and abs(key_line - line) <= 5:
                groups[key].append(f)
                matched = True
                break

        if not matched:
            groups[(file, line)] = [f]

    return groups


def merge_finding_group(group: list) -> dict:
    """Merge multiple agent findings about the same location into one"""
    if len(group) == 1:
        f = group[0]
        f["agents"] = [f["agent"]]
        f["pr_eligible"] = f.get("confidence", 0) >= 85
        return f

    # Take highest severity across agents
    highest = max(group, key=lambda f: SEVERITY_RANK.get(f["severity"], 0))

    # Take highest confidence
    best_confidence = max(f.get("confidence", 0) for f in group)

    # Combine agent names
    agents = list(set(f["agent"] for f in group))

    # Combine issues into one description
    combined_issues = " | ".join(
        f"[{f['agent']}] {f['issue']}" for f in group
    )

    # Take the fix from the highest confidence finding
    best_fix = max(group, key=lambda f: f.get("confidence", 0))["fix"]

    return {
        "file": highest["file"],
        "line": highest.get("line", 0),
        "issue": combined_issues,
        "severity": highest["severity"],
        "fix": best_fix,
        "confidence": best_confidence,
        "agents": agents,          # list of which agents flagged this
        "pr_eligible": best_confidence >= 85  # threshold for PR opening
    }

import os
from backend.tools.fix_generator import generate_fix

def synthesizer_node(state: ReviewState) -> ReviewState:
    """Combines all agent findings into a clean, ranked, deduplicated report"""

    # Combine all findings
    all_raw = (
        state.get("quality_findings", []) +
        state.get("security_findings", []) +
        state.get("performance_findings", [])
    )

    if not all_raw:
        state["all_findings"] = []
        state["final_report"] = {"total": 0, "findings": [], "pr_eligible": 0}
        return state

    # Group by location
    groups = group_by_location(all_raw)

    # Merge each group
    merged = [merge_finding_group(group) for group in groups.values()]

    # Sort by severity then confidence
    merged.sort(key=lambda f: (
        -SEVERITY_RANK.get(f["severity"], 0),
        -f.get("confidence", 0)
    ))

    # Build final report
    pr_eligible = [f for f in merged if f.get("pr_eligible")]
    by_severity = {
        "critical": [f for f in merged if f["severity"] == "critical"],
        "high":     [f for f in merged if f["severity"] == "high"],
        "medium":   [f for f in merged if f["severity"] == "medium"],
        "low":      [f for f in merged if f["severity"] == "low"]
    }

    print("Generating code fixes for PR eligible findings...")
    
    files_dict = {f["path"]: f for f in state["files"]}

    for finding in merged:
        if finding.get("pr_eligible"):
            file_path = finding["file"]
            file_data = files_dict.get(file_path)

            if file_data:
                fix = generate_fix(
                    finding,
                    file_data["content"],
                    file_data["language"]
                )
                finding["code_fix"] = fix
            else:
                finding["code_fix"] = {"error": "File not found"}
        else:
            finding["code_fix"] = None  # no fix needed for report-only findings

    state["all_findings"] = merged
    state["final_report"] = {
        "total": len(merged),
        "pr_eligible_count": len(pr_eligible),
        "by_severity": {k: len(v) for k, v in by_severity.items()},
        "findings": merged
    }

    print(f"Synthesizer complete:")
    print(f"  Raw findings: {len(all_raw)}")
    print(f"  After dedup:  {len(merged)}")
    print(f"  PR eligible:  {len(pr_eligible)}")

    return state