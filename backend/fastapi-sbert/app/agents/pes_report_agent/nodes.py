from app.agents.pes_report_agent.nodes import AgentState, ReportOutput, EvaluationResult
import json
from typing import Dict, TypedDict, Any, List
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from app.core.AgentLLMModel import AgentLLMModel
from app.agents.pes_report_agent.prompt import evaluation_prompt, generation_prompt

generator_llm = AgentLLMModel.get_model()
evaluator_llm = AgentLLMModel.get_model()
# ==========================================
# 2. Define the Nodes (Agents)
# ==========================================

def generate_report(state: AgentState):
    """Agent 1: Generates the structured marketing report JSON."""
    metrics_data = state["metrics_data"]
    iterations = state.get("iterations", 0)
    
    # 1. Prepare feedback context if this is a retry loop
    feedback_context = ""
    if iterations > 0 and state.get("evaluation"):
        feedback_context = f"\n\nCRITICAL FEEDBACK FROM EVALUATOR - FIX THESE ISSUES:\n{json.dumps(state['evaluation'], indent=2)}"

    # 2. Format the messages using the ChatPromptTemplate
    messages = generation_prompt.format_messages(
        metrics_data=metrics_data,
        feedback_context=feedback_context
    )
    
    # 3. Invoke the generator LLM with the structured output schema
    result: ReportOutput = generator_llm.invoke(messages)
    
    # 4. Return the dumped Pydantic model and increment iterations
    return {
        "report": result.model_dump(), 
        "iterations": iterations + 1
    }

def evaluate_report(state: AgentState):
    """Agent 2: Evaluates the generated JSON report."""
    metrics_data = state["metrics_data"]
    report = state["report"]

    # 1. Convert the report dictionary into a formatted JSON string
    formatted_report = json.dumps(report, indent=2)

    # 2. Format the messages using your ChatPromptTemplate
    messages = evaluation_prompt.format_messages(
        metrics_data=metrics_data,
        generated_report=formatted_report
    )
    
    # 3. Invoke the evaluator LLM with the structured output schema
    result: EvaluationResult = evaluator_llm.invoke(messages)
    
    # 4. Return the dumped Pydantic model back to the state
    return {"evaluation": result.model_dump(by_alias=True)}

def finalize_response(state: AgentState):
    """Agent 3 (Final Node): Packages the final score, determines if user review is needed, and bundles the UI payload."""
    
    # 1. Grab necessary data from the current state
    report = state.get("report", {})
    evaluation = state.get("evaluation", {})
    score = evaluation.get("score", 0)
    iterations = state.get("iterations", 0)
    MAX_RETRIES = 3
    
    # 2. Calculate logic
    needs_review = bool(iterations >= MAX_RETRIES and score < 85)
    
    # 3. Build Metadata
    final_metadata = {
        "final_score": score,
        "total_iterations": iterations,
        "needs_human_review": needs_review,
        "warning_message": "WARNING: Quality threshold not met after maximum retries. Please review the AI report for inaccuracies." if needs_review else "Report passed quality checks."
    }
    
    # 4. NEW: Bundle everything together for the UI
    final_ui_payload = {
        "report_data": report,       # This includes your metric conditions, cross-metric logic, and ranked weaknesses!
        "metadata": final_metadata   # This includes your score and warnings!
    }
    
    # 5. Return both to update the state. 
    # If your API reads the output of this final node, it will now see the entire package.
    return {
        "final_metadata": final_metadata,
        "final_ui_payload": final_ui_payload 
    }

# ==========================================
# 3. Define the Routing Logic
# ==========================================

def route_action(state: AgentState):
    evaluation = state.get("evaluation", {})
    score = evaluation.get("score", 0)
    passed = evaluation.get("pass", False)
    iterations = state.get("iterations", 0)
    
    MAX_RETRIES = 3

    if score >= 85 and passed:
        return "finalize_response"
    elif iterations >= MAX_RETRIES:
        return "finalize_response"
    else:
        return "generate_report"