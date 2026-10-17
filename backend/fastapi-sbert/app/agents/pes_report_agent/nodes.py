"""PES Report Agent — node definitions.

generate_report  → builds structured ReportOutput via the Groq LLM
evaluate_report  → scores and validates the report via the Groq LLM
finalize_response → packages final_ui_payload and metadata
route_action     → conditional edge: pass (score ≥ PASS_SCORE) or retry (up to MAX_RETRIES)
"""

from __future__ import annotations

import json
from typing import Any

from app import errors
from app.agents.pes_report_agent.prompt import evaluation_prompt, generation_prompt
from app.agents.pes_report_agent.state import AgentState, EvaluationResult, ReportOutput
from app.core.AgentLLMModel import AgentLLMModel
from app.unavailable import DependencyUnavailable

# Evaluator score a report needs to pass, and how many generate/evaluate rounds
# run before the report is released with a needs-human-review flag.
PASS_SCORE = 85
MAX_RETRIES = 3


def _require_llm(message: str, cause: str, stage: str):
    """Return the shared LLM, or raise the agent's 503 if it is unavailable."""
    llm = AgentLLMModel().get_model()
    if llm is None:
        raise DependencyUnavailable(
            code=errors.MOD4_PES_AGENT_FAILED,
            message=message,
            dependency="gemini",
            cause=cause,
            stage=stage,
        )
    return llm


# ==========================================
# Node definitions
# ==========================================


def generate_report(state: AgentState) -> dict[str, Any]:
    """Agent 1 — Generate structured marketing report JSON.

    On retry iterations, the evaluator's feedback is injected into the prompt
    so the generator can correct specific issues.
    """
    metrics_data = state["metrics_data"]
    iterations = state.get("iterations", 0)

    feedback_context = ""
    if iterations > 0 and state.get("evaluation"):
        feedback_context = (
            "\n\nCRITICAL FEEDBACK FROM EVALUATOR — FIX THESE ISSUES:\n"
            + json.dumps(state["evaluation"], indent=2)
        )

    _base_llm = _require_llm(
        message="PES report generation is unavailable.",
        cause="the report node produced no structured output",
        stage="fastapi-sbert/pes_report_agent.generate",
    )
    generator_llm = _base_llm.with_structured_output(ReportOutput)
    messages = generation_prompt.format_messages(
        metrics_data=metrics_data,
        feedback_context=feedback_context,
    )
    result: ReportOutput = generator_llm.invoke(messages)
    return {"report": result.model_dump(), "iterations": iterations + 1}


def evaluate_report(state: AgentState) -> dict[str, Any]:
    """Agent 2 — Evaluate the generated report for accuracy and completeness."""
    metrics_data = state["metrics_data"]
    report = state["report"]
    formatted_report = json.dumps(report, indent=2)

    _base_llm = _require_llm(
        message="PES report evaluation is unavailable.",
        cause="the evaluate node produced no structured output",
        stage="fastapi-sbert/pes_report_agent.evaluate",
    )
    evaluator_llm = _base_llm.with_structured_output(EvaluationResult)
    messages = evaluation_prompt.format_messages(
        metrics_data=metrics_data,
        generated_report=formatted_report,
    )
    result: EvaluationResult = evaluator_llm.invoke(messages)
    return {"evaluation": result.model_dump(by_alias=True)}


def finalize_response(state: AgentState) -> dict[str, Any]:
    """Agent 3 (Final) — Package report + metadata into the UI payload."""
    report = state.get("report", {})
    evaluation = state.get("evaluation", {})
    score = evaluation.get("score", 0)
    iterations = state.get("iterations", 0)

    needs_review = bool(iterations >= MAX_RETRIES and score < PASS_SCORE)

    final_metadata = {
        "final_score": score,
        "total_iterations": iterations,
        "needs_human_review": needs_review,
        "warning_message": (
            "WARNING: Quality threshold not met after maximum retries. "
            "Please review the AI report for inaccuracies."
            if needs_review
            else "Report passed quality checks."
        ),
    }

    final_ui_payload = {
        "report_data": report,
        "metadata": final_metadata,
    }

    return {
        "final_metadata": final_metadata,
        "final_ui_payload": final_ui_payload,
    }


# ==========================================
# Routing logic
# ==========================================


def route_action(state: AgentState) -> str:
    """Conditional edge: pass → finalize_response; fail → generate_report (retry)."""
    evaluation = state.get("evaluation", {})
    score = evaluation.get("score", 0)
    passed = evaluation.get("pass", False)
    iterations = state.get("iterations", 0)

    if score >= PASS_SCORE and passed:
        return "finalize_response"
    if iterations >= MAX_RETRIES:
        return "finalize_response"
    return "generate_report"
