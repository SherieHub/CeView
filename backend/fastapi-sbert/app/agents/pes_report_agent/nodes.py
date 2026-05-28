"""PES Report Agent — node definitions.

generate_report  → builds structured ReportOutput via Gemini
evaluate_report  → scores and validates the report via Gemini
finalize_response → packages final_ui_payload and metadata
route_action     → conditional edge: pass (score ≥ 85) or retry (up to 3×)
"""
from __future__ import annotations

# BUG FIX: was `from app.agents.pes_report_agent.nodes import ...` — circular.
# All shared types live in state.py.
from app.agents.pes_report_agent.state import (
    AgentState,
    ReportOutput,
    EvaluationResult,
    CrossMetricLogic,
    MetricCondition,
    RankedWeakness,
)
import json
from typing import Any

from app.core.AgentLLMModel import AgentLLMModel
from app.agents.pes_report_agent.prompt import evaluation_prompt, generation_prompt

# ── LLM setup with structured outputs ────────────────────────────────────────
# BUG FIX: AgentLLMModel.get_model() is an *instance* method — must instantiate
# via AgentLLMModel() (singleton __new__ returns the same object every time).
# BUG FIX: plain get_model() returns the base LLM; we need .with_structured_output()
# so the invoke() result is the Pydantic model, not a BaseMessage.


# ── Fallback values used when LLM is unavailable ─────────────────────────────

_FALLBACK_REPORT = ReportOutput(
    metric_conditions=[],
    cross_metric_logic=CrossMetricLogic(
        relationships="LLM unavailable — no analysis performed.",
        insights="",
    ),
    ranked_weaknesses=[],
)

_FALLBACK_EVALUATION = {
    "score": 0,
    "pass": False,
    "issues": ["LLM unavailable"],
    "missing_elements": [],
    "accuracy_check": "incorrect",
    "recommendation": "regenerate",
}

# ==========================================
# Node definitions
# ==========================================


def generate_report(state: AgentState) -> dict[str, Any]:
    """Agent 1 — Generate structured marketing report JSON.

    On retry iterations, the evaluator's feedback is injected into the prompt
    so the generator can correct specific issues.
    """
    metrics_data = state["metrics_data"]
    iterations   = state.get("iterations", 0)

    # Inject evaluator feedback on retries
    feedback_context = ""
    if iterations > 0 and state.get("evaluation"):
        feedback_context = (
            "\n\nCRITICAL FEEDBACK FROM EVALUATOR — FIX THESE ISSUES:\n"
            + json.dumps(state["evaluation"], indent=2)
        )
    
    _base_llm = AgentLLMModel().get_model()
    
    if _base_llm is None:
        return {"report": _FALLBACK_REPORT.model_dump(), "iterations": iterations + 1}
    
    generator_llm = _base_llm.with_structured_output(ReportOutput)

    messages = generation_prompt.format_messages(
        metrics_data=metrics_data,
        feedback_context=feedback_context,
    )
    result: ReportOutput = generator_llm.invoke(messages)
    return {"report": result.model_dump(), "iterations": iterations + 1}


def evaluate_report(state: AgentState) -> dict[str, Any]:
    """Agent 2 — Evaluate the generated report for accuracy and completeness."""
    metrics_data     = state["metrics_data"]
    report           = state["report"]
    formatted_report = json.dumps(report, indent=2)
    
    _base_llm = AgentLLMModel().get_model()

    if _base_llm is None:
        return {"evaluation": _FALLBACK_EVALUATION}
    
    evaluator_llm = _base_llm.with_structured_output(EvaluationResult)

    messages = evaluation_prompt.format_messages(
        metrics_data=metrics_data,
        generated_report=formatted_report,
    )
    result: EvaluationResult = evaluator_llm.invoke(messages)
    # by_alias=True serializes pass_status → "pass" (matches route_action's key lookup)
    return {"evaluation": result.model_dump(by_alias=True)}


def finalize_response(state: AgentState) -> dict[str, Any]:
    """Agent 3 (Final) — Package report + metadata into the UI payload."""
    report      = state.get("report", {})
    evaluation  = state.get("evaluation", {})
    score       = evaluation.get("score", 0)
    iterations  = state.get("iterations", 0)
    MAX_RETRIES = 3

    needs_review = bool(iterations >= MAX_RETRIES and score < 85)

    final_metadata = {
        "final_score":        score,
        "total_iterations":   iterations,
        "needs_human_review": needs_review,
        "warning_message": (
            "WARNING: Quality threshold not met after maximum retries. "
            "Please review the AI report for inaccuracies."
            if needs_review
            else "Report passed quality checks."
        ),
    }

    final_ui_payload = {
        "report_data": report,        # metric_conditions, cross_metric_logic, ranked_weaknesses
        "metadata":    final_metadata,
    }

    return {
        "final_metadata":   final_metadata,
        "final_ui_payload": final_ui_payload,
    }


# ==========================================
# Routing logic
# ==========================================


def route_action(state: AgentState) -> str:
    """Conditional edge: pass → finalize_response; fail → generate_report (retry)."""
    evaluation  = state.get("evaluation", {})
    score       = evaluation.get("score", 0)
    passed      = evaluation.get("pass", False)
    iterations  = state.get("iterations", 0)
    MAX_RETRIES = 3

    if score >= 85 and passed:
        return "finalize_response"
    if iterations >= MAX_RETRIES:
        return "finalize_response"
    return "generate_report"
