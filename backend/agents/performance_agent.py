import json
from backend.llm_config import get_llm
from backend.state import ReviewState
from backend.utils import clean_llm_response, safe_llm_call

PERFORMANCE_PROMPT = """You are a senior performance engineer reviewing code for inefficiencies.

Static analysis complexity findings:
{radon_findings}

File: {file_path}
Language: {language}
Code:
{code_content}

Analyze the code for performance issues. Use the complexity findings as
a signal but also look for issues radon may have missed.

Common things to look for:
- Inefficient loops (nested loops that could be simplified)
- Repeated expensive operations inside loops
- Missing caching for repeated computations
- Unnecessary database calls inside loops (N+1 problem)
- Memory leaks or large object creation in hot paths
- Blocking I/O where async would be better
- Inefficient data structures for the use case

For each issue respond with this exact JSON structure:

[
  {{
    "line": <line number>,
    "issue": "<clear description of the performance problem>",
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

def performance_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for performance issues"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        radon_findings = file.get("tool_results", {}).get("radon_findings", [])

        prompt = PERFORMANCE_PROMPT.format(
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
                f["agent"] = "performance"
                all_findings.append(f)

        except json.JSONDecodeError as e:
            print(f"Could not parse performance agent response for {file['path']}: {e}")
            print(f"Raw content preview: {content[:200]}")
            continue
        except Exception as e:
            print(f"Performance agent error on {file['path']}: {e}")
            continue

    state["performance_findings"] = all_findings
    print(f"Performance agent found {len(all_findings)} issues total")
    return state