from typing import TypedDict, List, Dict, Optional

class Finding(TypedDict):
    file: str
    line: int
    issue: str
    severity: str        # critical / high / medium / low
    fix: str
    confidence: int      # 0-100
    agent: str           # which agent found it

class ReviewState(TypedDict):
    repo_url: str
    repo_path: str
    files: List[Dict]            # list of {path, content}
    quality_findings: List[Finding]
    security_findings: List[Finding]
    performance_findings: List[Finding]
    all_findings: List[Finding]  # synthesizer fills this
    final_report: Dict
    pr_urls: List[str]           # opened PR links
    error: Optional[str]