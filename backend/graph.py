from langgraph.graph import StateGraph, END
from backend.state import ReviewState
from backend.agents.orchestrator import orchestrator_node
from backend.agents.quality_agent import quality_agent_node
from backend.agents.security_agent import security_agent_node
from backend.agents.performance_agent import performance_agent_node

def build_graph():
    """Builds and compiles the Figent review graph"""
    graph = StateGraph(ReviewState)

    # Add all nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("quality_agent", quality_agent_node)
    graph.add_node("security_agent", security_agent_node)
    graph.add_node("performance_agent", performance_agent_node)

    # Define the flow
    graph.set_entry_point("orchestrator")
    graph.add_edge("orchestrator", "quality_agent")
    graph.add_edge("quality_agent", "security_agent")
    graph.add_edge("security_agent", "performance_agent")
    graph.add_edge("performance_agent", END)

    return graph.compile()