import os
from github import Github, GithubException
from dotenv import load_dotenv
from backend.llm_config import get_llm
from backend.utils import safe_llm_call

load_dotenv()

# Action decision logic
def decide_action(finding: dict) -> str:
    severity = finding["severity"]
    confidence = finding.get("confidence", 0)

    if confidence >= 85 and severity in ["critical", "high"]:
        return "open_pr"
    elif confidence >= 60 and severity in ["medium", "low"]:
        return "open_issue"
    elif confidence >= 60:
        return "open_issue"
    else:
        return "report_only"


# LLM naming
PR_TITLE_PROMPT = """Generate a professional GitHub PR title for this code fix.

Issue: {issue}
Severity: {severity}
File: {file}
Fix: {fix}

Return only the title — one line, under 72 characters, no quotes.
Use conventional commit format: fix(scope): description
Example: fix(auth): replace hardcoded password with environment variable
"""

ISSUE_TITLE_PROMPT = """Generate a professional GitHub Issue title for this code problem.

Issue: {issue}
Severity: {severity}
File: {file}

Return only the title — one line, under 72 characters, no quotes.
Use this format: [SEVERITY] Brief description of the problem
Example: [MEDIUM] Missing error handling in database connection layer
"""

def generate_pr_title(finding: dict) -> str:
    llm = get_llm()
    prompt = PR_TITLE_PROMPT.format(
        issue=finding["issue"][:200],
        severity=finding["severity"],
        file=finding["file"],
        fix=finding.get("code_fix", {}).get("explanation", finding["fix"])
    )
    title = safe_llm_call(llm, prompt).strip().strip('"').strip("'")
    if not title or len(title) > 100:
        return f"[Figent] {finding['severity'].upper()}: {finding['issue'][:60]}"
    return title


def generate_issue_title(finding: dict) -> str:
    llm = get_llm()
    prompt = ISSUE_TITLE_PROMPT.format(
        issue=finding["issue"][:200],
        severity=finding["severity"],
        file=finding["file"]
    )
    title = safe_llm_call(llm, prompt).strip().strip('"').strip("'")
    if not title or len(title) > 100:
        return f"[{finding['severity'].upper()}] {finding['issue'][:60]}"
    return title


class GitHubHandler:
    def __init__(self):
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            raise ValueError("GITHUB_TOKEN not set in .env")
        self.client = Github(token)

    def get_repo(self, repo_url: str):
        repo_url = repo_url.rstrip("/")
        if "github.com" in repo_url:
            parts = repo_url.split("github.com/")[-1]
        else:
            parts = repo_url
        parts = parts.replace(".git", "")
        return self.client.get_repo(parts)

    def get_default_branch(self, repo) -> str:
        return repo.default_branch

    def get_file_content(self, repo, file_path: str, branch: str):
        try:
            contents = repo.get_contents(file_path, ref=branch)
            return {
                "content": contents.decoded_content.decode("utf-8"),
                "sha": contents.sha
            }
        except GithubException as e:
            return {"error": str(e)}

    def create_branch(self, repo, branch_name: str, base_branch: str) -> bool:
        try:
            base_ref = repo.get_git_ref(f"heads/{base_branch}")
            repo.create_git_ref(
                ref=f"refs/heads/{branch_name}",
                sha=base_ref.object.sha
            )
            return True
        except GithubException as e:
            if "already exists" in str(e):
                return True
            print(f"Branch creation error: {e}")
            return False

    def apply_fix_to_file(self, repo, file_path: str,
                          original_code: str, fixed_code: str,
                          branch: str, commit_message: str) -> bool:
        file_data = self.get_file_content(repo, file_path, branch)

        if "error" in file_data:
            print(f"Could not get file {file_path}: {file_data['error']}")
            return False

        content = file_data["content"]

        if original_code not in content:
            print(f"Original code not found in {file_path}")
            return False

        new_content = content.replace(original_code, fixed_code, 1)

        try:
            repo.update_file(
                path=file_path,
                message=commit_message,
                content=new_content,
                sha=file_data["sha"],
                branch=branch
            )
            return True
        except GithubException as e:
            print(f"File update error: {e}")
            return False

    def open_pull_request(self, repo, branch: str, base_branch: str,
                          title: str, body: str) -> str:
        try:
            pr = repo.create_pull(
                title=title,
                body=body,
                head=branch,
                base=base_branch
            )
            return pr.html_url
        except GithubException as e:
            print(f"PR creation error: {e}")
            return ""

    def open_issue(self, repo, title: str, body: str,
                   labels: list = None) -> str:
        try:
            issue = repo.create_issue(
                title=title,
                body=body,
                labels=labels or []
            )
            return issue.html_url
        except GithubException as e:
            print(f"Issue creation error: {e}")
            return ""

    def create_pr_for_finding(self, repo_url: str, finding: dict) -> str:
        code_fix = finding.get("code_fix", {})

        if not code_fix or "error" in code_fix:
            print(f"No valid fix for {finding['file']} line {finding['line']}")
            return ""

        if not code_fix.get("original_code") or not code_fix.get("fixed_code"):
            print(f"Incomplete fix for {finding['file']} line {finding['line']}")
            return ""

        try:
            repo = self.get_repo(repo_url)
            base_branch = self.get_default_branch(repo)

            safe_file = (finding["file"]
                        .replace("/", "-")
                        .replace("\\", "-")
                        .replace(".", "-"))
            branch_name = f"figent/fix-{safe_file}-L{finding['line']}"

            if not self.create_branch(repo, branch_name, base_branch):
                return ""

            commit_message = (
                f"fix({finding['severity']}): {finding['issue'][:60]}\n\n"
                f"Auto-fix generated by Figent\n"
                f"Confidence: {finding['confidence']}%\n"
                f"Agents: {', '.join(finding.get('agents', []))}"
            )

            success = self.apply_fix_to_file(
                repo=repo,
                file_path=finding["file"].replace("\\", "/"),
                original_code=code_fix["original_code"],
                fixed_code=code_fix["fixed_code"],
                branch=branch_name,
                commit_message=commit_message
            )

            if not success:
                return ""

            # LLM generated title
            pr_title = generate_pr_title(finding)

            pr_body = f"""## Figent Automated Fix

**Issue:** {finding['issue']}

**Severity:** {finding['severity'].upper()}
**Confidence:** {finding['confidence']}%
**Detected by:** {', '.join(finding.get('agents', []))}
**File:** `{finding['file']}` (Line {finding['line']})

**What changed:**
{code_fix.get('explanation', 'See diff above')}

**Before:**
{code_fix.get('original_code', '')}

**After:**
{code_fix.get('fixed_code', '')}
---
*This PR was automatically generated by Figent with {finding['confidence']}% confidence*
"""

            return self.open_pull_request(
                repo, branch_name, base_branch, pr_title, pr_body
            )

        except Exception as e:
            print(f"PR creation failed for {finding['file']}: {e}")
            return ""

    def create_issue_for_finding(self, repo_url: str, finding: dict) -> str:
        try:
            repo = self.get_repo(repo_url)

            # LLM generated title
            issue_title = generate_issue_title(finding)

            issue_body = f"""## Figent Code Review Finding

**Issue:** {finding['issue']}

**Severity:** {finding['severity'].upper()}
**Confidence:** {finding['confidence']}%
**Detected by:** {', '.join(finding.get('agents', []))}
**File:** `{finding['file']}` (Line {finding['line']})

**Suggested Fix:**
{finding.get('fix', 'See issue description')}

**Why this matters:**
This issue was flagged by Figent's automated code review system.
Confidence score of {finding['confidence']}% indicates this needs
human review before any automated action is taken.

---
*This issue was automatically created by Figent*
"""

            # Label by severity
            label_map = {
                "critical": ["bug", "figent", "critical"],
                "high": ["bug", "figent"],
                "medium": ["enhancement", "figent"],
                "low": ["figent"]
            }
            labels = label_map.get(finding["severity"], ["figent"])

            return self.open_issue(repo, issue_title, issue_body, labels)

        except Exception as e:
            print(f"Issue creation failed for {finding['file']}: {e}")
            return ""