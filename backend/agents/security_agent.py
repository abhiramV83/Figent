import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call

SECURITY_PROMPT = """You are a senior security engineer reviewing code for vulnerabilities.

Static analysis tool (bandit) found these security issues:
{bandit_findings}

File: {file_path}
Language: {language}
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
- Return a MAXIMUM of 5 findings per file. Pick the most important ones only.
- Keep each "issue" field under 150 characters.
- Keep each "fix" field under 150 characters. Be concise.
"""

def security_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for security vulnerabilities"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        bandit_findings = file.get("tool_results", {}).get("bandit_findings", [])

        prompt = SECURITY_PROMPT.format(
            bandit_findings=json.dumps(bandit_findings),
            file_path=file["path"],
            language=file["language"],
            code_content=file["content"][:3000]
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
            print(f"Could not parse security agent response for {file['path']}: {e}")
            print(f"Raw content preview: {content[:200]}")
            continue
        except Exception as e:
            print(f"Security agent error on {file['path']}: {e}")
            continue

    state["security_findings"] = all_findings
    print(f"Security agent found {len(all_findings)} issues total")
    return state