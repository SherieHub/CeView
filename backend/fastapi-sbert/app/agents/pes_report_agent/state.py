import json
from typing import Dict, TypedDict, Any, List
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# ==========================================
# 1. Define the State & Structured Outputs
# ==========================================

class AgentState(TypedDict):
    """The state shared across the workflow."""
    metrics_data: str      # Input: The JSON string of time series lists
    report: dict           # Output: The generated JSON narrative/report
    evaluation: dict       # Output: The JSON evaluation results
    iterations: int        # Control: Prevent infinite loops
    final_metadata: dict   # Output: Stores final score, retry counts, and warnings
    final_ui_payload: dict # NEW: The fully combined package for your frontend

# --- Generator Output Schemas ---
class MetricCondition(BaseModel):
    metric_name: str = Field(description="Name of the metric (e.g., CTR, CPC, ROAS, CR, CAC)")
    current_status: str = Field(description="Current condition based on recent weeks")
    trend: str = Field(description="up / down / stable / volatile")
    peak_value: float = Field(description="Highest value in the time series")
    low_value: float = Field(description="Lowest value in the time series")

class RankedWeakness(BaseModel):
    metric_name: str = Field(description="The specific metric identified as a weakness")
    rank: int = Field(description="Priority rank (1 is the most urgent/weakest metric)")
    weakness_meaning: str = Field(description="What this weakness means contextually for the campaign")
    recommendation: str = Field(description="Specific, actionable recommendation to improve this metric")

class CrossMetricLogic(BaseModel):
    relationships: str = Field(description="Explanation of relationships between the metrics")
    insights: str = Field(description="Logically consistent insights across the funnel")

class ReportOutput(BaseModel):
    """The final structured JSON output of the marketing report."""
    metric_conditions: List[MetricCondition]
    cross_metric_logic: CrossMetricLogic
    ranked_weaknesses: List[RankedWeakness]

# --- Evaluator Output Schema ---
class EvaluationResult(BaseModel):
    score: int = Field(description="Score from 0-100")
    pass_status: bool = Field(alias="pass", description="true or false")
    issues: List[str] = Field(description="list of major problems")
    missing_elements: List[str] = Field(description="what is missing or weak")
    accuracy_check: str = Field(description="correct / partially correct / incorrect")
    recommendation: str = Field(description="approve / regenerate")

# Initialize the LLMs with structured outputs
llm = ChatOpenAI(model="gpt-4o", temperature=0.2)
generator_llm = llm.with_structured_output(ReportOutput)
evaluator_llm = llm.with_structured_output(EvaluationResult)