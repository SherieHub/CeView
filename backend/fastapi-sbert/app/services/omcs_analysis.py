"""Submodule 3.3 — OMCS compliance audit via the LangGraph omcs_agent.

Invokes the compiled omcs_agent graph (omcs_agent/graph.py) which runs the
sequential pipeline:

    get_profile_diff → evaluate_rubric → check_consistency → calculate_omcs
                                                                   |
                                                          PASS ----+---- FAIL -> feedback

OMCS formula (node_calculate_omcs):
    OMCS = (0.35 * profile_semantic_score)
         + (0.45 * recommendations_picture_score)
         + (0.20 * pubmat_consistency_score)

A score < 70 sets status="Fail" and routes through the feedback node, which
generates a root-cause + actionable-fixes diagnostic. The full graph state
(inputs echoed back + all computed fields) is returned to the caller.
"""
from __future__ import annotations

import logging

from app import errors
from app.agents.omcs_agent.graph import app as omcs_graph
from app.model.ComplianceScoreInputClass import ComplianceInputClass
from app.unavailable import MISSING_INPUT, DependencyUnavailable

logger = logging.getLogger(__name__)


async def omcs_calculation(input: ComplianceInputClass) -> dict:
    """Run the omcs_agent graph and return its final state.

    The returned dict carries the four inputs plus every computed field:
    profile_semantic_score, rubric_evaluation_data, recommendations_picture_score,
    consistency_explanation, pubmat_consistency_score, omcs_score, status, feedback.

    Raises DependencyUnavailable unchanged when a node reports one, and
    RuntimeError(MOD33_OMCS_AGENT_FAILED) when the graph otherwise cannot complete
    (e.g. the multimodal LLM is unavailable) so the caller can surface a clean
    error code rather than a raw stack trace.
    """
    # The rubric judges the image against the visual-guide recommendations. With
    # none, the model would score against nothing — report the missing input.
    if not input.recommendations:
        raise DependencyUnavailable(
            code=errors.MOD33_RECOMMENDATIONS_MISSING,
            message="The compliance audit needs the generated caption guidance.",
            dependency="content_generation",
            cause="no recommendations were supplied — generate captions for this market first",
            stage="fastapi-sbert/omcs_analysis",
            status_code=MISSING_INPUT,
        )

    try:
        result = await omcs_graph.ainvoke(input.model_dump())
    except DependencyUnavailable:
        # A node reported a specific, already-coded 503 (e.g. no profile to
        # compare against). Let it reach the registered handler intact rather
        # than flattening it into MOD33_OMCS_AGENT_FAILED.
        raise
    except Exception as exc:
        logger.error(
            "[%s] omcs_agent.ainvoke failed: %s",
            errors.MOD33_OMCS_AGENT_FAILED,
            exc,
        )
        raise RuntimeError(errors.MOD33_OMCS_AGENT_FAILED) from exc

    logger.info(
        "omcs_analysis ok omcs=%.2f status=%s",
        float(result.get("omcs_score", 0.0)),
        result.get("status"),
    )
    return result
