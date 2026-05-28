"""Groq API client for the OMCS compliance service.

Two public functions:
  evaluate_ma       — Multimodal Alignment (Ma) score via Groq LLM
  generate_failure_feedback — Detailed OMCS failure feedback (only on OMCS < 0.80)

Uses the OpenAI-compatible Groq endpoint. Falls back gracefully when the API
key is missing or the call fails.
"""

from __future__ import annotations

import json
import logging
import os

log = logging.getLogger("compliance.groq")

# ── Groq client (optional — falls back deterministically when unavailable) ────
_client = None
try:
    import openai
    _api_key = os.environ.get("GROQ_API_KEY", "")
    if _api_key:
        _client = openai.OpenAI(
            api_key=_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        log.info("groq_client: Groq API client initialised")
    else:
        log.warning("groq_client: GROQ_API_KEY not set — running in fallback mode")
except Exception as exc:
    log.warning("groq_client: could not initialise Groq client: %s", exc)

_MODEL = "llama-3.3-70b-versatile"

# ── System role verbatim from the OMCS spec ───────────────────────────────────
_OMCS_SYSTEM_ROLE = """\
You are an advanced Multimodal Compliance Evaluator designed to analyze promotional \
materials submitted by MSME operators. Your task is to evaluate submitted materials \
(text and, when present, image metadata) against the baseline AI-generated marketing \
recommendations and identify mismatches.

When generating feedback for a compliance failure, respond ONLY with a valid JSON \
object using this exact schema:
{
  "visual_deviations": "<string describing where the image/visual context deviates from the recommendation>"
}

Rules:
- Be specific. Reference exact phrases, visual cues, or missing keywords.
- visual_deviations must describe concrete mismatches between the recommended visual \
direction and what was submitted (composition, tone, lighting, props, cultural cues).
- Do not include any conversational filler. Output valid JSON only.
"""


# ─── Public API ───────────────────────────────────────────────────────────────

def evaluate_ma(
    ai_recommendation: str,
    submission_text:   str,
    media_name:        str | None = None,
    media_size:        int | None = None,
) -> tuple[float, list[str]]:
    """Compute Multimodal Alignment (Ma) score (0.0–1.0).

    Asks the LLM to score how well the submission aligns with the AI
    recommendation in terms of visual/contextual direction.

    Returns:
        (ma_score, mismatches) where ma_score is in [0.0, 1.0] and mismatches
        is a list of deviation strings for downstream feedback use.
    """
    if _client is None:
        log.info("evaluate_ma: Groq unavailable — returning neutral fallback (0.75)")
        return 0.75, []

    media_hint = ""
    if media_name:
        size_kb = f"{(media_size or 0) // 1024} KB" if media_size else "unknown size"
        media_hint = f"\nSubmitted media file: {media_name} ({size_kb})"

    prompt = f"""\
You are evaluating the Multimodal Alignment (Ma) between an AI-generated marketing \
recommendation and an MSME operator's submission.

AI Recommendation:
{ai_recommendation}

Operator Submission (text):
{submission_text}{media_hint}

Score how well the submission aligns with the recommendation on a scale of 0 to 100, \
considering:
- Semantic and tonal alignment between the two texts
- Visual/contextual consistency (inferred from text descriptions and media metadata)
- Cultural and market appropriateness
- Overall message coherence

Respond with valid JSON only:
{{
  "ma_score": <integer 0-100>,
  "mismatches": ["<specific deviation 1>", "<specific deviation 2>"]
}}
"""

    result = _generate_json(prompt)
    raw_score = float(result.get("ma_score", 75))
    ma = round(max(0.0, min(1.0, raw_score / 100.0)), 4)
    mismatches = result.get("mismatches", [])
    log.info("evaluate_ma: ma=%.4f mismatches=%d", ma, len(mismatches))
    return ma, mismatches


def generate_failure_feedback(
    ai_recommendation:  str,
    submission_text:    str,
    failing_tokens:     list[str],
    visual_mismatches:  list[str],
    heuristic_rules:    list[str],
    market:             str,
) -> dict:
    """Generate OMCS failure feedback — only called when OMCS < 0.80.

    Returns a dict with:
      visual_deviations — string describing mismatches

    Falls back to deterministic strings when Groq is unavailable.
    """
    if _client is None:
        return _deterministic_feedback(
            failing_tokens, visual_mismatches, heuristic_rules,
        )

    tokens_str    = ", ".join(f'"{t}"' for t in failing_tokens[:20]) or "none identified"
    mismatches_str = "\n".join(f"- {m}" for m in visual_mismatches) or "- No specific visual mismatches detected"
    missing_rules  = [r for r in heuristic_rules if r.strip().lower() not in submission_text.lower()]
    rules_str      = "\n".join(f"- {r}" for r in missing_rules) or "- All heuristic rules satisfied"

    user_message = f"""\
An MSME operator's promotional material failed the OMCS evaluation (score below 0.80).

Target market: {market}

AI Recommendation (baseline):
{ai_recommendation}

Operator Submission (text):
{submission_text}

Token-level analysis — words in submission NOT in the recommendation vocabulary:
{tokens_str}

Visual/contextual mismatches detected by alignment scoring:
{mismatches_str}

Missing heuristic rules (required phrases/keywords absent from submission):
{rules_str}

Describe the visual and contextual mismatches following the JSON schema in your instructions.
"""

    result = _generate_json(user_message, system=_OMCS_SYSTEM_ROLE)

    visual_dev = result.get("visual_deviations") or _build_visual_deviations(
        visual_mismatches, failing_tokens,
    )

    return {
        "visual_deviations": visual_dev,
    }


# ─── Private helpers ──────────────────────────────────────────────────────────

def _generate_json(prompt: str, system: str | None = None) -> dict:
    """Call Groq with JSON-mode and return parsed dict. Returns {} on failure."""
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = _client.chat.completions.create(
            model=_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.4,
        )
        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)
    except Exception as exc:
        log.warning("groq_client._generate_json failed: %s", exc)
        return {}


def _deterministic_feedback(
    failing_tokens:    list[str],
    visual_mismatches: list[str],
    heuristic_rules:   list[str],
) -> dict:
    """Fallback feedback built entirely from rule-based signals."""
    return {
        "visual_deviations": _build_visual_deviations(visual_mismatches, failing_tokens),
    }


def _build_visual_deviations(mismatches: list[str], failing_tokens: list[str]) -> str:
    parts = []
    if mismatches:
        parts.append("Visual/contextual mismatches: " + "; ".join(mismatches[:5]) + ".")
    if failing_tokens:
        sample = ", ".join(f'"{t}"' for t in failing_tokens[:8])
        parts.append(
            f"The submission contains terminology ({sample}) that deviates from the "
            "recommended vocabulary, suggesting a misaligned visual or tonal direction."
        )
    if not parts:
        parts.append(
            "The submission does not sufficiently reflect the recommended visual "
            "direction, tone, or cultural context."
        )
    return " ".join(parts)


def _build_guidance(failing_tokens: list[str], missing_rules: list[str]) -> str:
    steps = ["To improve your OMCS score above 0.80, take the following steps:"]
    step = 1
    if failing_tokens:
        sample = ", ".join(f'"{t}"' for t in failing_tokens[:6])
        steps.append(
            f"{step}. Review and revise the following terms that are not aligned "
            f"with the AI recommendation: {sample}. Replace them with language "
            "that mirrors the recommended tone and vocabulary."
        )
        step += 1
    if missing_rules:
        for rule in missing_rules[:5]:
            steps.append(
                f"{step}. Ensure your submission includes: \"{rule}\"."
            )
            step += 1
    if step == 1:
        steps.append(
            "1. Closely review the AI recommendation and rewrite your submission "
            "to better match its vocabulary, tone, visual direction, and cultural cues."
        )
    return " ".join(steps)
