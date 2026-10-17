"""PES Report Agent — LangGraph workflow definition.

Graph:  generate_report → evaluate_report → [conditional] → finalize_response → END
        Retries up to 3× when the evaluator score is below 85.

LLM backend: Groq (ChatGroq) via AgentLLMModel (see nodes.py).
No OpenAI / langchain_openai dependency.
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.pes_report_agent.nodes import (
    evaluate_report,
    finalize_response,
    generate_report,
    route_action,
)
from app.agents.pes_report_agent.state import AgentState

# ==========================================
# Build and compile the graph
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
        "generate_report": "generate_report",
    },
)
workflow.add_edge("finalize_response", END)

app = workflow.compile()
