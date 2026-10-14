"""Module 4 LLM prompts: PES prescriptive insights and the performance report.

Both go through ``gemini_client._generate_json`` (the shared Groq JSON call),
referenced via the module so tests that patch it also cover these functions.
"""
from __future__ import annotations

import json

from app.config.markets import REPORT_PLATFORM_BY_MARKET
from app.services import gemini_client


def pes_compute_insights(
    base_metrics: dict,
    pes_score: float,
    pes_label: str,
    breakdown: list[dict],
    flagged_metrics: list[str],
) -> dict:
    """Generate AI prescriptive insights for UC-4.3 (pes_compute endpoint).

    Returns: { weakest_funnel_stage, recommendations, executive_summary, source }
    Falls back to rule-based output if Groq is unavailable.
    """
    if not gemini_client._enabled():
        return {}

    breakdown_text = "\n".join(
        f"  - {b['metric']}: weight {b['weight']}, contribution {b['contribution']:.4f}"
        for b in breakdown
    )
    flag_text = (
        f"Excluded metrics (missing data): {', '.join(flagged_metrics)}"
        if flagged_metrics else "No metrics were excluded."
    )

    prompt = f"""You are CeView's Senior Campaign Analyst for Cebu MSME tourism businesses — resorts, tour operators, dive shops, and cultural experience providers in Cebu, Philippines targeting Korean, Japanese, and US tourists.

Campaign PES Analysis:
- PES Score: {pes_score:.4f} / 1.00 ({pes_label})
- Base Metrics: {json.dumps(base_metrics, indent=2)}
- Metric Contributions (normalized × weight):
{breakdown_text}
- {flag_text}

Context on what each metric means for a Cebu tourism operator:
- CTR: % of tourists who saw the ad and clicked — measures ad creative relevance for Cebu's target tourist markets
- CPC: ₱ cost per click on platforms like Facebook, Naver Blog, or Instagram — measures ad spend efficiency per tourist reached
- ROAS: ₱ revenue from Cebu resort packages or tours per ₱1 of ad spend — measures overall campaign profitability
- CR: % of clicks that became booking enquiries or form submissions on the Cebu operator's landing page — measures offer and landing page effectiveness
- CAC: total ₱ cost to acquire one confirmed booking customer for the Cebu tourism business — measures total acquisition efficiency

Identify the weakest funnel stage and provide 3 specific, actionable recommendations to improve the campaign's PES score.
Each recommendation must:
  - Reference Cebu's tourism context specifically (e.g. Cebu resort packages, island-hopping tours, dive packages in Moalboal, cultural experiences)
  - Name the specific platform to act on (e.g. Naver Blog for Korean tourists, Instagram Reels for US tourists, Facebook for Japanese tourists)
  - State the expected business outcome for the Cebu operator (e.g. lower CAC, more booking enquiries, higher ROAS)

Return JSON with exactly:
- weakest_funnel_stage: string (e.g. "Clicks → Bookings", "Impressions → Clicks", etc.)
- recommendations: array of exactly 3 strings — each a concrete, Cebu-specific action with platform and expected outcome
- executive_summary: string — 3-4 sentences: state the PES score and what it means for this Cebu tourism business, explain which metric is the biggest drag on performance and why it matters for booking revenue, and name the single most impactful action the operator should take immediately
"""

    out = gemini_client._generate_json(prompt)
    if not out or "recommendations" not in out:
        return {}

    return {
        "weakest_funnel_stage": out.get("weakest_funnel_stage", "Clicks → Bookings"),
        "recommendations":      list(out.get("recommendations", []))[:3],
        "executive_summary":    out.get("executive_summary", ""),
        "source":               "groq",
    }


def performance_report(
    metrics: dict,
    transitions: list[dict],
    weeks: int = 4,
    market: str = "korea",
) -> dict:
    """
    Generate a prescriptive performance report using the new exhaustive funnel
    diagnostics schema (Phase 5 / Module 4).

    Args:
        metrics:     Raw KPI values (impressions, clicks, adSpend, …)
        transitions: Pre-ranked, measured funnel transitions from Spring Boot
                     (business-impact order: Clk→Conv, Conv→Book, Imp→Clk).
                     Required: the router rejects a short list with 424 rather
                     than inventing drop rates.
        weeks:       Analysis window in weeks (4 or 8)
        market:      Target market key (e.g. "korea", "japan", "usa")

    Returns:
        New schema dict:
          executiveSummary, funnelDiagnostics[], recommendations[], recommendedPlatform
    """
    recommended_platform = REPORT_PLATFORM_BY_MARKET.get(market.lower(), "Naver Blog")

    # Build the ordered rank/urgency context for the model
    rank_context = "\n".join(
        f"  {i+1}. \"{t['stage']}\" — {t['dropRate']} absolute drop"
        for i, t in enumerate(transitions[:3])
    )

    prompt = f"""You are CeView's Senior Marketing Analyst specialising in Philippine tourism MSMEs.

CAMPAIGN DATA ({weeks}-week window, market: {market.upper()}):
{json.dumps(metrics, indent=2)}

PRE-RANKED FUNNEL TRANSITIONS (business-impact priority order — do NOT re-order):
{rank_context}

Rank 1 = "Weakest" | Rank 2 = "Moderate" | Rank 3 = "Alright"
Urgency 1 = "Most Urgent" | Urgency 2 = "Urgent" | Urgency 3 = "Not Very Urgent"

RULES:
1. Evaluate ALL THREE transitions. Do not skip any stage.
2. Preserve the pre-ranked order exactly (index 0 = Weakest, index 1 = Moderate, index 2 = Alright).
3. Each funnelDiagnostics entry MUST have exactly one matching recommendations entry (same "stage" value).
4. Urgency is strictly derived from the rank — do not deviate.
5. recommendedPlatform MUST be "{recommended_platform}".
6. Return ONLY valid JSON — no markdown, no explanation text.

Return this exact JSON structure:
{{
  "executiveSummary": "<4–6 sentence overall campaign assessment that: (1) opens with a plain-language explanation of what each of the 5 KPIs means for this Cebu tourism business — CTR is the percentage of tourists who saw the ad and clicked (measures ad creative relevance), CPC is the ₱ cost per click on platforms like Facebook and Naver Blog (measures ad spend efficiency), ROAS is the ₱ revenue earned per ₱1 of ad spend (measures overall campaign profitability for the resort or tour package), CR is the percentage of clicks that turned into a booking enquiry or form submission (measures how well the landing page converts tourist interest into action), and CAC is the total ₱ cost to secure one confirmed booking customer (measures total acquisition efficiency and directly impacts profit margin); (2) summarises the current overall campaign health in the context of this Cebu tourism MSME; (3) identifies the single top-priority improvement for the operator>",
  "funnelDiagnostics": [
    {{
      "stage": "<transition label>",
      "rank": "<Weakest|Moderate|Alright>",
      "dropRate": "<formatted percentage>",
      "insight": "<one-sentence root-cause diagnosis specific to this stage>"
    }}
  ],
  "recommendations": [
    {{
      "stage": "<must match the corresponding funnelDiagnostics stage>",
      "urgency": "<Most Urgent|Urgent|Not Very Urgent>",
      "title": "<≤8-word action title>",
      "action": "<one concrete implementation step — specific and actionable>"
    }}
  ],
  "recommendedPlatform": "{recommended_platform}"
}}"""

    return gemini_client._generate_json(prompt)
