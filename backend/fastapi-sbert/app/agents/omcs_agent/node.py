import json
import logging
import os
import re
import time
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from app import errors
from app.agents.omcs_agent.state import CeviewValidationState
from app.services.profile_alignment import profile_alignment_score
from app.unavailable import DEPENDENCY_DOWN, DependencyUnavailable

load_dotenv()
logger = logging.getLogger(__name__)

# The omcs_agent needs a VISION-capable model because nodes pass the pubmat
# image as an image_url content block. The shared AgentLLMModel default
# (openai/gpt-oss-120b) is text-only and rejects multimodal input, so this
# agent uses its own Groq vision model. Overridable via OMCS_VISION_MODEL.
# Kept isolated so other agents (caption generation, PES report) are unaffected.
# qwen/qwen3.8-27b: Groq retired meta-llama/llama-4-scout-17b-16e-instruct (it
# now 404s), and qwen is the only model on the project key that accepts image
# input. It rejects images under 32px on a side; real pubmats are far larger.
_VISION_MODEL = os.environ.get("OMCS_VISION_MODEL", "qwen/qwen3.8-27b")

_llm = None

# OMCS = weighted sum of the three node scores (each on a 0-100 scale).
OMCS_WEIGHTS = {"profile": 0.35, "rubric": 0.45, "consistency": 0.20}
OMCS_PASS_THRESHOLD = 70

# Groq meters output tokens per minute and counts the max_tokens a request ASKS for, so a cap
# above the account's limit is refused outright (the free tier's qwen limit is 1000/min, and
# 2048 was rejected on every call). Each reply here is a short JSON object or a few sentences,
# so a small cap loses nothing, and two calls then fit inside one minute's budget. Raise it with
# OMCS_MAX_OUTPUT_TOKENS on a paid tier, or if replies are being cut off.
OMCS_MAX_OUTPUT_TOKENS = int(os.environ.get("OMCS_MAX_OUTPUT_TOKENS", "450"))

# On a rate limit, wait for the delay Groq asks for and retry ONCE — but never longer than this:
# the gateway gives up after 90 s and an operator should not stare at a spinner for minutes.
OMCS_RATE_LIMIT_MAX_WAIT_S = float(os.environ.get("OMCS_RATE_LIMIT_MAX_WAIT_S", "20"))
# Used when Groq rate-limits us without saying for how long.
_DEFAULT_RATE_LIMIT_WAIT_S = 5.0

RUBRIC_KEYS = (
    "visual_business_context_match",
    "visual_intent_consistency",
    "tone_visual_mood_alignment",
    "psychological_strategy_support",
    "target_audience_fit",
    "platform_suitability",
    "attribute_coverage_consistency",
)


def _normalize_rubric(data: dict) -> tuple[dict, int]:
    """Whole-number percentages (0-100) for the rubric scores, and their mean.

    The model's own ``total`` is ignored: it has come back as the *sum* of the
    seven scores. A model that scores on 0-1 despite the prompt (every value
    <= 1) is scaled up rather than read as seven near-zero percentages.
    """
    raw = (data or {}).get("scores")
    values: dict = {}
    for key in RUBRIC_KEYS:
        try:
            values[key] = float((raw or {})[key])
        except (KeyError, TypeError, ValueError):
            continue
    if values and all(v <= 1.0 for v in values.values()):
        values = {k: v * 100 for k, v in values.items()}
    scores = {k: int(round(max(0.0, min(100.0, v)))) for k, v in values.items()}
    total = int(round(sum(scores.values()) / len(scores))) if scores else 0
    return scores, total


def get_llm():
    """Lazily build the Groq vision model on first use.

    Lazy so it picks up GROQ_API_KEY after the app's dotenv load, and so a
    missing key fails at call time (clean error code) rather than import time.
    """
    global _llm
    if _llm is None:
        api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            logger.error("omcs_agent: GROQ_API_KEY missing — vision LLM unavailable.")
            return None
        try:
            from langchain_groq import ChatGroq  # type: ignore[import]
            # max_tokens: without a cap, langchain's JsonOutputParser silently
            # repairs a truncated response by dropping the last incomplete key
            # rather than raising — a growing rubric or rationale field could
            # someday truncate the same way the caption matrix did in
            # AgentLLMModel before this was added there. Cheap to guard now.
            _llm = ChatGroq(
                model=_VISION_MODEL, temperature=0.4, groq_api_key=api_key, max_tokens=OMCS_MAX_OUTPUT_TOKENS,
            )
        except Exception as exc:  # pragma: no cover - import/config failure
            logger.error("omcs_agent: failed to init vision LLM (%s): %s", _VISION_MODEL, exc)
            return None
    return _llm


def _rate_limit_wait(exc: Exception) -> float | None:
    """Seconds Groq asks us to wait after a 429, or None when waiting would not help.

    None for anything that is not a rate limit, and for "Request too large": that one is
    about the size of the request (max_tokens above the account's limit), which a retry
    repeats identically. Otherwise the wait comes from the Retry-After header, else from
    the "try again in 2.5s" / "in 1m3s" wording of the message, else a short default.
    """
    if getattr(exc, "status_code", None) != 429:
        return None
    message = str(exc)
    if "request too large" in message.lower():
        return None

    headers = getattr(getattr(exc, "response", None), "headers", None)
    header = headers.get("retry-after") if headers is not None else None
    try:
        if header is not None:
            return max(0.0, float(header))
    except (TypeError, ValueError):
        pass

    match = re.search(r"try again in (?:(\d+)m)?\s*([\d.]+)s", message)
    if match:
        return int(match.group(1) or 0) * 60 + float(match.group(2))
    return _DEFAULT_RATE_LIMIT_WAIT_S


def _invoke(messages):
    """``get_llm().invoke`` with one polite retry when Groq rate-limits the call.

    Waits the delay Groq asked for (capped at OMCS_RATE_LIMIT_MAX_WAIT_S) and tries again once.
    If it is still limited, or Groq asks for longer than the cap, raises DependencyUnavailable
    naming the rate limit and how long to wait, so the operator sees "try again in about N
    seconds" rather than a generic failure. Any other error propagates unchanged.
    """
    llm = get_llm()
    try:
        return llm.invoke(messages)
    except Exception as exc:  # noqa: BLE001 - classified below; anything else is re-raised
        wait = _rate_limit_wait(exc)
        if wait is None:
            raise
        if wait > OMCS_RATE_LIMIT_MAX_WAIT_S:
            raise _rate_limited(wait) from exc
        logger.warning("omcs_agent: Groq rate limit; waiting %.1fs, then retrying once", wait)
        time.sleep(wait + 0.25)  # a hair over, so the window has really reopened
        try:
            return llm.invoke(messages)
        except Exception as retry_exc:  # noqa: BLE001
            again = _rate_limit_wait(retry_exc)
            if again is None:
                raise
            raise _rate_limited(again) from retry_exc


def _rate_limited(wait_seconds: float) -> DependencyUnavailable:
    seconds = max(1, int(round(wait_seconds)))
    return DependencyUnavailable(
        code=errors.MOD33_RATE_LIMITED,
        message="The compliance model is rate-limited right now.",
        dependency="groq",
        cause=f"Groq's per-minute token limit was reached; try again in about {seconds} seconds",
        stage="fastapi-sbert/omcs_agent",
        status_code=DEPENDENCY_DOWN,
    )


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response.

    Vision models frequently wrap their output in prose or markdown fences even
    when instructed otherwise. A bare json.loads() on that text raises an
    exception and the caller silently returns 0.0. This helper finds the first
    {...} block anywhere in the response so scores are never silently zeroed.
    """
    text = text.strip()
    # Try the whole string first (fast path when the model behaves)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip common markdown fences then retry
    text = re.sub(r"```(?:json)?", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Last resort: pull the first {...} block out of surrounding prose
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return {}


def _clean_image_url(url: str) -> str:
    """Strip whitespace and newlines Postman/copy-paste may embed in data: URLs.

    Groq's image decoder rejects base64 with any embedded whitespace, which
    commonly appears when a long data: URL is pasted into Postman's JSON editor
    or generated by encoders that wrap at 76 characters.
    """
    if url.startswith("data:"):
        prefix, _, b64 = url.partition(",")
        return prefix + "," + "".join(b64.split())
    return url.strip()


def _multimodal(text: str, image_url: str) -> HumanMessage:
    """A human turn carrying ``text`` plus the (cleaned) pubmat image."""
    return HumanMessage(content=[
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": _clean_image_url(image_url)}}
    ])


# 2. Define the Nodes
def node_profile_diff(state: CeviewValidationState) -> dict:
    return {
        "profile_semantic_score": profile_alignment_score(
            state.get("business_profile") or {},
            # The profile is English; a Korean/Japanese caption is compared via
            # its English translation when the caller has one.
            (state.get("caption_en") or "").strip() or state["caption"],
        )
    }

def node_evaluate_rubric(state: CeviewValidationState) -> dict:
    system_prompt = SystemMessage(content="""
You are an expert marketing quality auditor. Evaluate the asset using the Pubmat–Recommendation Alignment Rubric.
OUTPUT ONLY VALID JSON.
Required Schema:
{
  "scores": {
      "visual_business_context_match": int,
      "visual_intent_consistency": int,
      "tone_visual_mood_alignment": int,
      "psychological_strategy_support": int,
      "target_audience_fit": int,
      "platform_suitability": int,
      "attribute_coverage_consistency": int
  }
}
Every score is a whole number from 0 to 100 (a percentage, e.g. 85 — never 0.85).
""")
    recs_str = json.dumps(state['recommendations'], indent=2)
    human_text = f"Recommendations Context:\n{recs_str}\n\nEvaluate the image."
    message = _multimodal(human_text, state["image_url"])

    response = _invoke([system_prompt, message])
    logger.debug("node_evaluate_rubric raw response: %s", response.content[:400])

    evaluation_data = _extract_json(response.content)
    if not evaluation_data or "scores" not in evaluation_data:
        logger.warning("node_evaluate_rubric: JSON extraction failed; raw=%s", response.content[:200])
        evaluation_data = {"error": "Parse failed", "raw": response.content}
        total_score = 0
    else:
        scores, total_score = _normalize_rubric(evaluation_data)
        evaluation_data = {"scores": scores, "total": total_score}

    return {
        "rubric_evaluation_data": evaluation_data,
        "recommendations_picture_score": total_score
    }

def node_check_consistency(state: CeviewValidationState) -> dict:
    system_prompt = SystemMessage(content="""
Analyze consistency between caption and image (Tone, Alignment, Category).
OUTPUT ONLY VALID JSON.
Schema:
{
    "consistency_score": float,  // 0 to 100
    "rationale": "string explanation"
}
""")
    human_text = f"Caption: \"{state['caption']}\"\nAnalyze consistency."
    message = _multimodal(human_text, state["image_url"])
    response = _invoke([system_prompt, message])
    logger.debug("node_check_consistency raw response: %s", response.content[:400])

    data = _extract_json(response.content)
    if data:
        score = float(data.get("consistency_score", 0.0))
        text = data.get("rationale", "No rationale provided.")
    else:
        logger.warning("node_check_consistency: JSON extraction failed; raw=%s", response.content[:200])
        score = 0.0
        text = response.content

    return {
        "pubmat_consistency_score": score,
        "consistency_explanation": text
    }

def node_calculate_omcs(state: CeviewValidationState) -> dict:
    """Calculates OMCS and explicitly sets the pass/fail status here."""
    p_score = state.get('profile_semantic_score', 0)
    r_score = state.get('recommendations_picture_score', 0)
    c_score = state.get('pubmat_consistency_score', 0)

    OMCS = max(0.0, min(100.0, (
        (OMCS_WEIGHTS["profile"] * p_score)
        + (OMCS_WEIGHTS["rubric"] * r_score)
        + (OMCS_WEIGHTS["consistency"] * c_score)
    )))

    # Set the status immediately so it's available even if we skip the feedback node
    status = "Pass" if OMCS >= OMCS_PASS_THRESHOLD else "Fail"
    
    # If it passes, pre-fill feedback so it isn't completely empty
    feedback = "Asset approved." if status == "Pass" else ""
    
    return {
        "omcs_score": OMCS, 
        "status": status,
        "feedback": feedback
    } 

def node_generate_feedback(state: CeviewValidationState) -> dict:
    """This node is now ONLY called if the OMCS score is a Fail."""
    score = state.get("omcs_score", 0)
    
    system_prompt = """You are an expert QA Evaluator. The asset has FAILED the OMCS check.
Provide Root Cause Analysis and bulleted Actionable Fixes. No filler."""

    human_prompt = f"""
OMCS Score: {score:.2f}/100
- Profile Semantic Score: {state.get('profile_semantic_score')}
- Rubric Total: {state.get('recommendations_picture_score')}
- Consistency Score: {state.get('pubmat_consistency_score')} | Rationale: {state.get('consistency_explanation')}

Generate the failure diagnostic report.
"""
    response = _invoke([SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)])
    
    return {"feedback": response.content}

# Conditional Routing Logic
def route_omcs_outcome(state: CeviewValidationState) -> str:
    """Evaluates the OMCS score to decide the next step."""
    if state.get("omcs_score", 0) >= OMCS_PASS_THRESHOLD:
        return "PASS"  # Immediately terminate on Pass
    else:
        return "FAIL"  # Route to feedback on Fail
