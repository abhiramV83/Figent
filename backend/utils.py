import time

def repair_truncated_json(content: str) -> str:
    """Attempt to repair truncated JSON array"""
    content = content.strip()

    # Find the last COMPLETE object — must end with }
    # Walk backwards finding complete objects
    last_complete = -1
    depth = 0
    in_string = False
    escape_next = False

    for i, char in enumerate(content):
        if escape_next:
            escape_next = False
            continue
        if char == "\\" and in_string:
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                last_complete = i

    if last_complete == -1:
        return "[]"

    repaired = content[:last_complete + 1]

    if not repaired.startswith("["):
        repaired = "[" + repaired

    repaired = repaired + "]"
    return repaired


def clean_llm_response(content: str) -> str:
    """Clean LLM response to extract valid JSON array"""
    content = content.strip()

    # Strip markdown fences
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    # Extract just the JSON array boundaries
    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1:
        return content[start:end+1].strip()

    # No closing bracket — response was truncated, attempt repair
    if start != -1 and end == -1:
        print("Truncated JSON detected — attempting repair...")
        return repair_truncated_json(content[start:])

    return content


def safe_llm_call(llm, prompt: str, retries: int = 3) -> str:
    """Call LLM with automatic retry on rate limit"""
    for attempt in range(retries):
        try:
            response = llm.invoke(prompt)
            return response.content
        except Exception as e:
            if "rate_limit" in str(e).lower() or "429" in str(e):
                wait_time = 10 * (attempt + 1)
                print(f"Rate limit hit — waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                raise e
    return ""