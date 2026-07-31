import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call, chunk_file

QUALITY_PROMPT = """You are a senior code reviewer analyzing a file for code quality issues.

Static analysis tool found these complexity issues:
{radon_findings}

File: {file_path}
Language: {language}
Note: This is a partial view of the file starting at line {start_line}.
Report line numbers relative to this starting line (e.g. if the issue is on the first line of this view, the line number is {start_line}).

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
"""

def quality_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for quality issues"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        radon_findings = file.get("tool_results", {}).get("radon_findings", [])

        # Replace the single prompt call with chunked calls
        chunks = chunk_file(file["content"])

        for chunk in chunks:
            prompt = QUALITY_PROMPT.format(
                radon_findings=json.dumps(radon_findings),
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
                    f["agent"] = "quality"
                    all_findings.append(f)

            except json.JSONDecodeError as e:
                logging.error("Could not parse quality agent response for %s chunk %s: %s", file["path"], chunk["start_line"], e)
                continue
            except Exception as e:
                logging.exception("Quality agent error on %s chunk %s", file["path"], chunk["start_line"])
                continue

    state["quality_findings"] = all_findings
    print(f"Quality agent found {len(all_findings)} issues total")
    return state