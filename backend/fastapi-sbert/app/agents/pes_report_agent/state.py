"""PES Report Agent — shared state TypedDict and Pydantic output schemas.

All LLM initialisation has been moved to nodes.py (uses AgentLLMModel / Gemini).
This file is import-safe: no network calls, no API-key checks at module load time.
"""
from __future__ import annotations

from typing import TypedDict, List
from pydantic import BaseModel, Field


# ==========================================
# 1. Agent state (shared across all nodes)
# ==========================================

class AgentState(TypedDict):
    """State dict threaded through the LangGraph workflow."""
    metrics_data:    str   # Input:  JSON string of time-series lists (index 0 = current week)
    report:          dict  # Output: generated structured report
    evaluation:      dict  # Output: evaluator scores and issues
    iterations:      int   # Control: prevents infinite retry loops
    final_metadata:  dict  # Output: final score, retry count, review flag
    final_ui_payload: dict # Output: bundled package for the frontend


# ==========================================
# 2. Generator output schemas
# ==========================================

class MetricCondition(BaseModel):
    metric_name:    str   = Field(description="Name of the metric (e.g. CTR, CPC, ROAS, CR, CAC)")
    current_status: str   = Field(description="Current condition based on recent weeks")
    trend:          str   = Field(description="up / down / stable / volatile")
    peak_value:     float = Field(description="Highest value in the time series")
    low_value:      float = Field(description="Lowest value in the time series")


class RankedWeakness(BaseModel):
    metric_name:      str = Field(description="The specific metric identified as a weakness")
    rank:             int = Field(description="Priority rank (1 = most urgent / weakest metric)")
    weakness_meaning: str = Field(description="What this weakness means for the campaign")
    recommendation:   str = Field(description="Specific, actionable step to improve this metric")


class CrossMetricLogic(BaseModel):
    relationships: str = Field(description="Explanation of relationships between the metrics")
    insights:      str = Field(description="Logically consistent insights across the funnel")


class ReportOutput(BaseModel):
    """Final structured JSON output of the marketing report."""
    metric_conditions:  List[MetricCondition]
    cross_metric_logic: CrossMetricLogic
    ranked_weaknesses:  List[RankedWeakness]


# ==========================================
# 3. Evaluator output schema
# ==========================================

class EvaluationResult(BaseModel):
    score:            int       = Field(description="Score from 0-100")
    pass_status:      bool      = Field(alias="pass", description="true or false")
    issues:           List[str] = Field(description="List of major problems found")
    missing_elements: List[str] = Field(description="What is missing or weak in the report")
    accuracy_check:   str       = Field(description="correct / partially correct / incorrect")
    recommendation:   str       = Field(description="approve / regenerate")
