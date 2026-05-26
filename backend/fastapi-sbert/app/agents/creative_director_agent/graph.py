from __future__ import annotations

from langgraph.graph import StateGraph, END  # type: ignore[import]
from app.agents.creative_director_agent.state import SocialAgentState
from app.agents.creative_director_agent.node import analyze_services, generate_platform_captions

# ── Build the LangGraph workflow ──────────────────────────────────────────────
workflow = StateGraph(SocialAgentState)

workflow.add_node("analyze_services",          analyze_services)
workflow.add_node("generate_platform_captions", generate_platform_captions)

# Linear flow: analyse → generate → end
workflow.set_entry_point("analyze_services")
workflow.add_edge("analyze_services",          "generate_platform_captions")  # was commented-out — fixed
workflow.add_edge("generate_platform_captions", END)

# Compile the agent
caption_generation_agent = workflow.compile()
