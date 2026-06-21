from langgraph.graph import StateGraph, END
from typing import TypedDict, List

# This is your shared state — every agent reads and writes to this
class ReviewState(TypedDict):
    repo_url: str
    files: List[str]
    quality_findings: List[str]
    security_findings: List[str]
    final_report: str

# Node 1 — simulates fetching files from repo
def fetch_repo(state: ReviewState) -> ReviewState:
    print("Fetching repo...")
    state["files"] = ["main.py", "auth.py", "db.py"]
    return state

# Node 2 — simulates code quality agent
def quality_agent(state: ReviewState) -> ReviewState:
    print(f"Quality agent analyzing {len(state['files'])} files...")
    state["quality_findings"] = ["main.py: high complexity in line 42"]
    return state

# Node 3 — simulates security agent
def security_agent(state: ReviewState) -> ReviewState:
    print("Security agent running...")
    state["security_findings"] = ["auth.py: hardcoded secret detected"]
    return state

# Node 4 — synthesizer combines everything
def synthesizer(state: ReviewState) -> ReviewState:
    print("Synthesizing report...")
    all_findings = state["quality_findings"] + state["security_findings"]
    state["final_report"] = f"Found {len(all_findings)} issues: {all_findings}"
    return state

# Build the graph
graph = StateGraph(ReviewState)

# Add nodes
graph.add_node("fetch_repo", fetch_repo)
graph.add_node("quality_agent", quality_agent)
graph.add_node("security_agent", security_agent)
graph.add_node("synthesizer", synthesizer)

# Add edges — this is the flow
graph.set_entry_point("fetch_repo")
graph.add_edge("fetch_repo", "quality_agent")
graph.add_edge("quality_agent", "security_agent")
graph.add_edge("security_agent", "synthesizer")
graph.add_edge("synthesizer", END)

# Compile and run
app = graph.compile()

result = app.invoke({
    "repo_url": "https://github.com/example/repo",
    "files": [],
    "quality_findings": [],
    "security_findings": [],
    "final_report": ""
})

print("\n--- FINAL REPORT ---")
print(result["final_report"])