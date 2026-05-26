import json
from typing import Dict, TypedDict, Any, List
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from app.agents.pes_report_agent.state import AgentState
from app.agents.pes_report_agent.nodes import generate_report, evaluate_report, finalize_response, route_action

# ==========================================
# 4. Build and Compile the Graph
# ==========================================

workflow = StateGraph(AgentState)

workflow.add_node("generate_report", generate_report)
workflow.add_node("evaluate_report", evaluate_report)
workflow.add_node("finalize_response", finalize_response)

workflow.set_entry_point("generate_report")
workflow.add_edge("generate_report", "evaluate_report")

workflow.add_conditional_edges(
    "evaluate_report",
    route_action,
    {
        "finalize_response": "finalize_response",
        "generate_report": "generate_report"
    }
)
workflow.add_edge("finalize_response", END)

app = workflow.compile()

# ==========================================
# 5. Execution Example (UI PAYLOAD SETUP)
# ==========================================

# if __name__ == "__main__":
#     # Input Data
#     input_metrics_dict = {
#         "CTR": [1.9, 2.1, 1.5, 1.2],
#         "CPC": [1.15, 1.10, 1.35, 1.50],
#         "ROAS": [2.3, 2.5, 1.8, 1.1],
#         "CR": [3.2, 3.5, 2.8, 2.1],
#         "CAC": [31, 29, 38, 45]
#     }
    
#     initial_state = {
#         "metrics_data": json.dumps(input_metrics_dict, indent=2),
#         "iterations": 0
#     }

#     # Run the workflow
#     final_state = app.invoke(initial_state)
    
#     # -------------------------------------------------------------
#     # THIS IS THE FINAL PAYLOAD TO SEND TO YOUR FRONTEND UI
#     # It contains both the report (with weaknesses/recommendations)
#     # and the metadata (score, warnings, etc.) side-by-side.
#     # -------------------------------------------------------------
#     ui_payload = {
#         "report_data": final_state["report"],
#         "metadata": final_state["final_metadata"]
#     }

#     print("\n================ JSON PAYLOAD FOR UI ================\n")
#     print(json.dumps(ui_payload, indent=2))