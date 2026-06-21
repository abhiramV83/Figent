from backend.tools.repo_handler import RepoHandler

handler = RepoHandler()

repo_url = "https://github.com/pallets/flask"
repo_path = handler.clone(repo_url)

files = handler.get_code_files(repo_path)  # updated method name

print(f"\nTotal files found: {len(files)}")

# Show breakdown by language
from collections import Counter
lang_counts = Counter(f["language"] for f in files)
print(f"By language: {dict(lang_counts)}")

print("\nFirst 3 files:")
for f in files[:3]:
    print(f"  [{f['language']}] {f['path']} ({f['size_kb']}KB)")

handler.cleanup(repo_path)
print("Done. Cleanup complete.")