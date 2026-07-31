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
        # Validate paths and analyze files in parallel
        import concurrent.futures, os
        def _resolve_path(base, rel_path):
            abs_path = os.path.abspath(os.path.join(base, rel_path))
            if not abs_path.startswith(os.path.abspath(base) + os.sep):
                raise ValueError(f"Path traversal detected: {rel_path}")
            return abs_path

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_file = {
                executor.submit(analyze_file, _resolve_path(repo_path, f["path"]), f["language"]): f
                for f in files
            }
            for future in concurrent.futures.as_completed(future_to_file):
                file_entry = future_to_file[future]
                file_entry["tool_results"] = future.result()

        state["files"] = files
        state["error"] = None

        print(f"Orchestrator complete — {len(files)} files ready for analysis")

    except Exception as e:
        state["error"] = f"Orchestrator failed: {str(e)}"
        state["files"] = []
        print(f"Orchestrator error: {e}")

    return state