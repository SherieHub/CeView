"""Module 4 — PES Time-Series Deep-Analysis Agent (FR4.x).

  POST /generate  — LangGraph pes_report_agent deep-analysis
                    (Gemini structured outputs, up to 3 quality-gated iterations)

Called by Spring Boot AnalyticsController.pesAnalysis() which builds a
synthetic or real weekly time-series from the stored campaign metrics and
forwards it here as { "metrics_data": { "CTR": [...], ... }, "weeks": 4|8 }.

Agent input contract (passed to graph.ainvoke):
    metrics_data  — JSON string of metric arrays in REVERSE chronological order:
                    index [0] = CURRENT week (most recent)
                    last index = FIRST week (baseline / starting point)
                    Example: { "CTR": [2.1, 1.9, 1.5, 1.2], "CPC": [...], ... }

Agent output (final_ui_payload):
    report_data   — { metric_conditions, cross_metric_logic, ranked_weaknesses }
    metadata      — { final_score, total_iterations, needs_human_review, warning_message }
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.pes_report_agent.graph import app as pes_agent_graph
from app.core.AgentLLMModel import AgentLLMModel

router = APIRouter()
log = logging.getLogger("module4.pes_analysis")

# NOTE: The module-level _LLM_AVAILABLE check was removed from here to prevent 
# the "Import Order Trap". The check is now done dynamically inside the route.


# ─── Pydantic schema ──────────────────────────────────────────────────────────

class PesAnalysisRequest(BaseModel):
    """Request body forwarded from Spring Boot AnalyticsController.

    metrics_data — dict keyed by metric name; each value is a list of floats
                   in reverse chronological order (index 0 = current week).
    weeks        — analysis window hint; used only for logging (the agent
                   derives window length from the list length itself).
    """
    metrics_data: dict = Field(
        default_factory=dict,
        description=(
            "{ 'CTR': [current, ..., baseline], 'CPC': [...], "
            "'ROAS': [...], 'CR': [...], 'CAC': [...] }"
        ),
    )
    weeks: int = Field(default=4, ge=4, le=8)


# ─── Deterministic fallback (LLM offline / empty input) ──────────────────────

_FALLBACK_PAYLOAD: dict = {
    "report_data": {
        "metric_conditions": [],
        "cross_metric_logic": {
            "relationships": "Analysis unavailable — AI agent is offline.",
            "insights": "",
        },
        "ranked_weaknesses": [],
    },
    "metadata": {
        "final_score":        0,
        "total_iterations":   0,
        "needs_human_review": True,
        "warning_message":    (
            "WARNING: PES analysis agent is offline. "
            "Check GOOGLE_API_KEY and restart the service."
        ),
    },
}


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate(req: PesAnalysisRequest) -> dict:
    """Invoke the LangGraph pes_report_agent with time-series marketing KPIs.

    The agent runs a generate → evaluate → [conditional] → finalize loop with
    Gemini structured outputs.  It retries up to 3 times until the internal
    quality score reaches ≥ 85.  The compiled final_ui_payload is returned
    directly to Spring Boot and surfaced in the React AIActionPlanReport panel.

    Fallback behaviour:
      - Empty metrics_data → immediate fallback (no agent call)
      - Agent raises / returns no payload → deterministic fallback
    """
    
    # 1. Evaluate availability dynamically inside the route!
    llm_available = AgentLLMModel().get_model() is not None
    
    # 2. Short-circuit immediately if LLM is unavailable — avoids 3 wasted graph
    # iterations that all hit the fallback path and return score=0 anyway.
    if not llm_available:
        log.warning(
            "pes_analysis.generate: LLM unavailable "
            "— returning offline fallback without invoking the graph"
        )
        return _FALLBACK_PAYLOAD

    if not req.metrics_data:
        log.warning("pes_analysis.generate: empty metrics_data — returning fallback")
        return _FALLBACK_PAYLOAD

    metrics_json = json.dumps(req.metrics_data, indent=2)
    log.info(
        "pes_analysis.generate weeks=%s metrics_keys=%s",
        req.weeks,
        list(req.metrics_data.keys()),
    )

    try:
        state = await pes_agent_graph.ainvoke({
            "metrics_data": metrics_json,
            "iterations":   0,
        })

        payload = state.get("final_ui_payload")
        if not payload:
            log.warning("pes_agent returned no final_ui_payload — using fallback")
            return _FALLBACK_PAYLOAD

        log.info(
            "pes_analysis.generate ok score=%s iterations=%s needs_review=%s",
            payload.get("metadata", {}).get("final_score"),
            payload.get("metadata", {}).get("total_iterations"),
            payload.get("metadata", {}).get("needs_human_review"),
        )
        return payload

    except Exception as exc:
        log.warning("pes_agent.ainvoke failed: %s — returning fallback", exc)
        return _FALLBACK_PAYLOAD