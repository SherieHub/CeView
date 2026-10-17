from langgraph.graph import END, START, StateGraph

from app.agents.omcs_agent.node import (
    node_calculate_omcs,
    node_check_consistency,
    node_evaluate_rubric,
    node_generate_feedback,
    node_profile_diff,
    route_omcs_outcome,
)
from app.agents.omcs_agent.state import CeviewValidationState

# 3. Construct the Sequential Graph
workflow = StateGraph(CeviewValidationState)

workflow.add_node("get_profile_diff", node_profile_diff)
workflow.add_node("evaluate_rubric", node_evaluate_rubric)
workflow.add_node("check_consistency", node_check_consistency)
workflow.add_node("calculate_omcs", node_calculate_omcs)
workflow.add_node("feedback", node_generate_feedback)

workflow.add_edge(START, "get_profile_diff")
workflow.add_edge("get_profile_diff", "evaluate_rubric")
workflow.add_edge("evaluate_rubric", "check_consistency")
workflow.add_edge("check_consistency", "calculate_omcs")

# Replace the standard edge with a conditional edge
workflow.add_conditional_edges(
    "calculate_omcs", route_omcs_outcome, {"PASS": END, "FAIL": "feedback"}
)

# Standard exit from the feedback node
workflow.add_edge("feedback", END)

app = workflow.compile()
