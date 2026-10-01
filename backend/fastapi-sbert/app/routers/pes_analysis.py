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

from app import errors
from app.agents.pes_report_agent.graph import app as pes_agent_graph
from app.core.AgentLLMModel import AgentLLMModel
from app.unavailable import DependencyUnavailable

router = APIRouter()
log = logging.getLogger("module4.pes_analysis")

# Check LLM availability once at startup — avoids running 3 wasted graph iterations
# when GOOGLE_API_KEY is absent. The singleton is already initialised by this point.
_LLM_AVAILABLE: bool = AgentLLMModel().get_model() is not None


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


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate(req: PesAnalysisRequest) -> dict:
    """Invoke the LangGraph pes_report_agent with time-series marketing KPIs.

    The agent runs a generate → evaluate → [conditional] → finalize loop with
    Gemini structured outputs.  It retries up to 3 times until the internal
    quality score reaches ≥ 85.  The compiled final_ui_payload is returned
    directly to Spring Boot and surfaced in the React AIActionPlanReport panel.

    Unavailability:
      - Empty metrics_data → 424 MOD4_PES_NO_METRICS (no agent call)
      - Agent raises → 503 MOD4_PES_AGENT_FAILED carrying the reason
      - Agent returns no payload → 503 MOD4_PES_AGENT_EMPTY

    Response shape:
        {
          "report_data": {
            "metric_conditions":  [ { metric_name, current_status, trend, peak_value, low_value, 
            insights (2 - 3 sentences that explains the current condition of this metric and how 
            this values means to the bussiness) } ]
            
            ,
            "cross_metric_logic": { relationships, insights },
            "ranked_weaknesses":  [ { metric_name, rank, weakness_meaning, recommendation } ]
          },
          "metadata": {
            "final_score":        <int 0-100>,
            "total_iterations":   <int>,
            "needs_human_review": <bool>,
            "warning_message":    <str>
          }
        }
    """
    if not req.metrics_data:
        raise DependencyUnavailable(
            code=errors.MOD4_PES_NO_METRICS,
            message="No campaign metrics to analyse.",
            dependency="campaign_records",
            cause="metrics_data was empty — ingest at least one campaign before "
                  "requesting a PES analysis",
            stage="fastapi-sbert/pes_analysis",
            status_code=424,
        )

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
            raise DependencyUnavailable(
                code=errors.MOD4_PES_AGENT_EMPTY,
                message="PES analysis returned no payload.",
                dependency="gemini",
                cause="the agent completed but produced no final_ui_payload",
                stage="fastapi-sbert/pes_analysis",
            )

        log.info(
            "pes_analysis.generate ok score=%s iterations=%s needs_review=%s",
            payload.get("metadata", {}).get("final_score"),
            payload.get("metadata", {}).get("total_iterations"),
            payload.get("metadata", {}).get("needs_human_review"),
        )
        return payload

    except DependencyUnavailable:
        raise
    except Exception as exc:
        log.warning("pes_agent.ainvoke failed: %s", exc)
        raise DependencyUnavailable(
            code=errors.MOD4_PES_AGENT_FAILED,
            message="PES analysis is unavailable.",
            dependency="gemini",
            cause=str(exc),
            stage="fastapi-sbert/pes_analysis",
        ) from exc
