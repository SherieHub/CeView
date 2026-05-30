from __future__ import annotations

import logging

from app import errors
from app.agents.creative_director_agent.graph import caption_generation_agent
from app.model.CaptionInputClass import CaptionInputClass

logger = logging.getLogger(__name__)


async def caption_generation_service(input: CaptionInputClass) -> dict:
    """Invoke the LangGraph caption generation agent (Submodule 3.1).

    Returns the compiled 3-platform caption matrix from the agent state
    (6-field schema: core_business_context, market_cultural_localization,
    psychological_elements, creative_tone_atmosphere,
    algorithmic_platform_architecture, caption).

    Raises RuntimeError with a MOD31_* error code if the LLM is unavailable
    or the agent returns an unusable response.  No fallback captions are
    returned — callers must propagate the error to the operator.
    """
    try:
        result = await caption_generation_agent.ainvoke(input.model_dump())
        captions = result.get("final_captions")
        if not captions:
            logger.error(
                "[%s] caption_agent returned empty final_captions",
                errors.MOD31_CAPTION_AGENT_FAILED,
            )
            raise RuntimeError(errors.MOD31_CAPTION_AGENT_FAILED)
        # "source" is set by the node: "fallback" when LLM is unavailable, "groq" otherwise
        source = result.get("source", "groq")
        if source == "fallback":
            logger.warning(
                "[%s] caption_agent used fallback mock captions — LLM was unavailable.",
                errors.MOD31_LLM_UNAVAILABLE,
            )
        return {"final_captions": captions, "source": source}
    except RuntimeError:
        raise
    except Exception as exc:
        logger.error(
            "[%s] caption_agent.ainvoke failed: %s",
            errors.MOD31_CAPTION_AGENT_FAILED,
            exc,
        )
        raise RuntimeError(errors.MOD31_CAPTION_AGENT_FAILED) from exc
