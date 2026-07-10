import json
from backend.llm_config import get_llm
from backend.utils import clean_llm_response, safe_llm_call

FIX_PROMPT = """You are a senior software engineer. Your job is to generate a precise code fix.

File: {file_path}
Language: {language}

The following issue was found at line {line}:
Issue: {issue}
Suggested approach: {fix_description}

Relevant code context:
{code_context}

Generate a precise fix for this specific issue.
Respond with this exact JSON structure:

{{
    "original_code": "<the exact line or lines that need to change>",
    "fixed_code": "<the replacement code>",
    "explanation": "<one sentence explaining what changed and why>",
    "line_start": <starting line number of the change>,
    "line_end": <ending line number of the change>
}}

IMPORTANT RULES:
- original_code must be exact characters from the file — copy it precisely
- fixed_code must be valid, working code in the same language
- Keep the fix minimal — change only what's necessary to fix the issue
- Do NOT use backticks or nested quotes in any field
- Return only the JSON object, nothing else
"""

def extract_code_context(file_content: str, line: int, window: int = 10) -> str:
    """Extract lines around the issue for context"""
    lines = file_content.split("\n")
    start = max(0, line - window)
    end = min(len(lines), line + window)

    context_lines = []
    for i, l in enumerate(lines[start:end], start=start+1):
        marker = ">>>" if i == line else "   "
        context_lines.append(f"{marker} {i:3d} | {l}")

    return "\n".join(context_lines)


def generate_fix(finding: dict, file_content: str, language: str) -> dict:
    """Generate actual code fix for a finding"""
    llm = get_llm()

    line = finding.get("line", 0)
    context = extract_code_context(file_content, line)

    prompt = FIX_PROMPT.format(
        file_path=finding["file"],
        language=language,
        line=line,
        issue=finding["issue"],
        fix_description=finding["fix"],
        code_context=context
    )

    content = ""
    try:
        raw_content = safe_llm_call(llm, prompt)

        if not raw_content:
            return {"error": "Empty response from LLM"}

        content = raw_content.strip()

        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        # Extract JSON object (not array this time)
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            content = content[start:end+1]

        fix = json.loads(content)

        # Validate required fields exist
        required = ["original_code", "fixed_code", "explanation"]
        for field in required:
            if field not in fix:
                return {"error": f"Missing field: {field}"}

        return fix

    except json.JSONDecodeError as e:
        print(f"Fix generation parse error: {e}")
        print(f"Raw content: {content[:200]}")
        return {"error": f"Parse error: {str(e)}"}
    except Exception as e:
        print(f"Fix generation error: {e}")
        return {"error": str(e)}