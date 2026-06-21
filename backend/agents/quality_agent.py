import json
from backend.llm_config import get_llm
from backend.state import ReviewState, Finding

QUALITY_PROMPT = """You are a senior code reviewer analyzing a Python file for code quality issues.

Static analysis tool found these complexity issues:
{radon_findings}

File: {file_path}
Code:
{code_content}

Based on the static analysis findings AND your own reading of the code, identify quality issues.
For each issue, respond with this exact JSON structure (a list of objects):

[
  {{
    "line": <line number>,
    "issue": "<clear description of the problem>",
    "severity": "critical" | "high" | "medium" | "low",
    "fix": "<concrete suggested fix>",
    "confidence": <0-100, how confident you are this is a real issue>
  }}
]

IMPORTANT RULES:
- In the "issue" and "fix" fields, do NOT use backticks, code snippets, or nested quotes.
- Describe everything in plain English. Example: instead of "use `nodes.reference()`", 
  write "use the nodes.reference function".
- Only return the JSON list, nothing else — no explanation, no markdown fences, no preamble.
- If no issues found, return an empty list [].
"""

def quality_agent_node(state: ReviewState) -> ReviewState:
    """LangGraph node — analyzes all files for quality issues"""
    llm = get_llm()
    all_findings = []

    for file in state["files"]:
        if file["language"] != "py":
            continue  # quality agent focuses on python for now

        radon_findings = file.get("tool_results", {}).get("radon_findings", [])

        prompt = QUALITY_PROMPT.format(
            radon_findings=json.dumps(radon_findings),
            file_path=file["path"],
            code_content=file["content"][:3000]
        )

        content = ""  # define upfront so it's available in except block too
        try:
            response = llm.invoke(prompt)
            content = response.content.strip()

            # Strip markdown fences if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            findings = json.loads(content)

            for f in findings:
                f["file"] = file["path"]
                f["agent"] = "quality"
                all_findings.append(f)

        except json.JSONDecodeError as e:
            print(f"Could not parse LLM response for {file['path']}: {e}")
            print(f"Raw content preview: {content[:200]}")
            continue
        except Exception as e:
            print(f"Quality agent error on {file['path']}: {e}")
            continue

    state["quality_findings"] = all_findings
    print(f"Quality agent found {len(all_findings)} issues total")
    return state