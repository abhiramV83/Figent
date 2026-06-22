import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call

QUALITY_PROMPT = """You are a senior code reviewer analyzing a file for code quality issues.

Static analysis tool found these complexity issues:
{radon_findings}

File: {file_path}
Language: {language}
Code:
{code_content}

Based on the static analysis findings AND your own reading of the code, identify quality issues.

Common things to look for:
- Functions that are too long or doing too many things
- Poor naming that makes code hard to understand
- Missing or inadequate error handling
- Code duplication that should be abstracted
- Deeply nested logic that should be simplified
- Dead code or unused variables

For each issue respond with this exact JSON structure:

[
  {{
    "line": <line number>,
    "issue": "<clear description of the problem>",
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

def quality_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for quality issues"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        radon_findings = file.get("tool_results", {}).get("radon_findings", [])

        prompt = QUALITY_PROMPT.format(
            radon_findings=json.dumps(radon_findings),
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
                f["agent"] = "quality"
                all_findings.append(f)

        except json.JSONDecodeError as e:
            print(f"Could not parse quality agent response for {file['path']}: {e}")
            print(f"Raw content preview: {content[:200]}")
            continue
        except Exception as e:
            print(f"Quality agent error on {file['path']}: {e}")
            continue

    state["quality_findings"] = all_findings
    print(f"Quality agent found {len(all_findings)} issues total")
    return state