import os
from backend.state import ReviewState
from backend.tools.repo_handler import RepoHandler
from backend.tools.static_analysis import analyze_file

def orchestrator_node(state: ReviewState) -> ReviewState:
    """Entry point — clones repo, extracts files, runs static analysis"""
    handler = RepoHandler()

    try:
        repo_path = handler.clone(state["repo_url"])
        state["repo_path"] = repo_path

        files = handler.get_code_files(repo_path)

        # Attach tool results to each file
        for f in files:
            full_path = os.path.join(repo_path, f["path"])
            f["tool_results"] = analyze_file(full_path, f["language"])

        state["files"] = files
        state["error"] = None

        print(f"Orchestrator complete — {len(files)} files ready for analysis")

    except Exception as e:
        state["error"] = f"Orchestrator failed: {str(e)}"
        state["files"] = []
        print(f"Orchestrator error: {e}")

    return state