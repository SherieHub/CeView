from typing import TypedDict, Dict, Any
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.AgentLLMModel import AgentLLMModel
import json
from app.agents.omcs_agent.state import CeviewValidationState
from app.agents.omcs_agent.node import node_profile_diff, node_evaluate_rubric, node_check_consistency, node_calculate_omcs, node_generate_feedback, route_omcs_outcome

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
    "calculate_omcs",
    route_omcs_outcome, {
        "PASS": END,
        "FAIL": "feedback"
    }
)

# Standard exit from the feedback node
workflow.add_edge("feedback", END)

app = workflow.compile()