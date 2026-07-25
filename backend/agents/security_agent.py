import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call, chunk_file

SECURITY_PROMPT = """You are a senior security engineer reviewing code for vulnerabilities.

Static analysis tool (bandit) found these security issues:
{bandit_findings}

File: {file_path}
Language: {language}
Note: This is a partial view of the file starting at line {start_line}.
Report line numbers relative to this starting line (e.g. if the issue is on the first line of this view, the line number is {start_line}).

Code:
{code_content}

Analyze the code for security vulnerabilities. Use the bandit findings as
a starting point but also look for issues bandit may have missed.

Common things to look for:
- Hardcoded secrets, passwords, API keys
- SQL injection risks
- Command injection risks
- Insecure deserialization
- Exposed sensitive data in logs or errors
- Broken authentication patterns
- Insecure direct object references

For each issue respond with this exact JSON structure:

[
  {{
    "line": <line number>,
    "issue": "<clear description of the vulnerability>",
    "severity": "critical" | "high" | "medium" | "low",
    "fix": "<concrete fix in plain English>",
    "confidence": <0-100>
  }}
]

IMPORTANT RULES:
- Do NOT use backticks, nested quotes, or code snippets in "issue" or "fix" fields.
- Describe everything in plain English.
- Only return the JSON list, nothing else — no markdown fences, no preamble.
- If no issues found, return an empty list [].
"""

def security_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for security vulnerabilities"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        bandit_findings = file.get("tool_results", {}).get("bandit_findings", [])

        # Replace the single prompt call with chunked calls
        chunks = chunk_file(file["content"])

        for chunk in chunks:
            prompt = SECURITY_PROMPT.format(
                bandit_findings=json.dumps(bandit_findings),
                file_path=file["path"],
                language=file["language"],
                code_content=chunk["content"],
                start_line=chunk["start_line"]
            )

            content = ""
            try:
                raw_content = safe_llm_call(llm, prompt)
                content = clean_llm_response(raw_content)
                findings = json.loads(content)

                for f in findings:
                    f["file"] = file["path"]
                    f["agent"] = "security"
                    all_findings.append(f)

            except json.JSONDecodeError as e:
                print(f"Could not parse security agent response for {file['path']} chunk {chunk['start_line']}: {e}")
                print(f"Raw content preview: {content[:200]}")
                continue
            except Exception as e:
                print(f"Security agent error on {file['path']} chunk {chunk['start_line']}: {e}")
                continue

    state["security_findings"] = all_findings
    print(f"Security agent found {len(all_findings)} issues total")
    return state