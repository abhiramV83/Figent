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
        # state["repo_path"] already set earlier; no need to assign again

        logger.info("Orchestrator complete — %d files ready for analysis", len(files))

        except (OSError, RuntimeError) as e:
        logger.error("Orchestrator error: %s", e)
        state["error"] = "Orchestrator failed"
        state["files"] = []

    return state