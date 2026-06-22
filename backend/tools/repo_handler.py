import os
import shutil
import stat
from git import Repo
from pathlib import Path
from typing import List, Dict

SKIP_DIRS = ["venv", "__pycache__", ".git","tests",
             "node_modules", ".env", "dist", "build"]
MAX_FILE_SIZE_KB = 100

# Languages we support — bandit/radon only work on .py,
# but LLM agents can read any of these
SUPPORTED_EXTENSIONS = [".py", ".js", ".ts", ".java", ".go"]


def _force_remove(func, path, exc_info):
    """Force delete read-only files on Windows (.git files are read-only)"""
    os.chmod(path, stat.S_IWRITE)
    func(path)


class RepoHandler:
    def __init__(self, clone_dir="./temp_repos"):
        self.clone_dir = clone_dir
        os.makedirs(clone_dir, exist_ok=True)

    def clone(self, repo_url: str) -> str:
        """Clone repo and return local path"""
        repo_name = repo_url.rstrip("/").split("/")[-1]
        repo_name = repo_name.replace(".git", "")
        target_path = os.path.join(self.clone_dir, repo_name)

        if os.path.exists(target_path):
            shutil.rmtree(target_path, onexc=_force_remove)

        print(f"Cloning {repo_url}...")
        Repo.clone_from(repo_url, target_path)
        print(f"Cloned to {target_path}")
        return target_path

    def get_code_files(self, repo_path: str) -> List[Dict]:
        """Extract all supported code files with their content and language"""
        files = []
        for ext in SUPPORTED_EXTENSIONS:
            for path in Path(repo_path).rglob(f"*{ext}"):
                # Skip unwanted directories
                if any(skip in path.parts for skip in SKIP_DIRS):
                    continue
                # Skip test files by name
                if path.name.startswith("test_") or path.name.startswith("conftest"):
                    continue

                # Skip files that are too large
                size_kb = path.stat().st_size / 1024
                if size_kb > MAX_FILE_SIZE_KB:
                    print(f"Skipping large file: {path.name} ({size_kb:.1f}KB)")
                    continue

                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    # Skip empty files
                    if not content.strip():
                        continue

                    files.append({
                        "path": str(path.relative_to(repo_path)),
                        "content": content,
                        "language": ext.replace(".", ""),  # py, js, ts, java, go
                        "size_kb": round(size_kb, 2)
                    })

                except Exception as e:
                    print(f"Could not read {path}: {e}")
                    continue
        # print(files)
        print(f"Found {len(files)} code files")
        return files

    def cleanup(self, repo_path: str):
        """Delete cloned repo after analysis"""
        shutil.rmtree(repo_path, onexc=_force_remove)
        print(f"Cleaned up {repo_path}")