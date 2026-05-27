import json
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from IPython.display import Image, display
from app.agents.omcs_agent.state import CeviewValidationState
from app.core.AgentLLMModel import AgentLLMModel

llm = AgentLLMModel().get_model()
# 2. Define the Nodes
def node_profile_diff(state: CeviewValidationState) -> dict:
    return {"profile_semantic_score": 85.5}

def node_evaluate_rubric(state: CeviewValidationState) -> dict:
    system_prompt = SystemMessage(content="""
You are an expert marketing quality auditor. Evaluate the asset using the Pubmat–Recommendation Alignment Rubric.
OUTPUT ONLY VALID JSON.
Required Schema:
{
  "scores": {
      "visual_business_context_match": float,
      "visual_intent_consistency": float,
      "tone_visual_mood_alignment": float,
      "psychological_strategy_support": float,
      "target_audience_fit": float,
      "platform_suitability": float,
      "attribute_coverage_consistency": float
  },
  "total": float
}
""")
    recs_str = json.dumps(state['recommendations'], indent=2)
    human_text = f"Recommendations Context:\n{recs_str}\n\nEvaluate the image."
    
    message = HumanMessage(content=[
        {"type": "text", "text": human_text},
       {"type": "image_url", "image_url": {"url": state["image_url"]}}
    ])
    
    response = llm.invoke([system_prompt, message])
    
    try:
        clean_json = response.content.replace('```json', '').replace('```', '').strip()
        evaluation_data = json.loads(clean_json)
        total_score = float(evaluation_data.get("total", 0.0))
    except (json.JSONDecodeError, ValueError):
        evaluation_data = {"error": "Parse failed", "raw": response.content}
        total_score = 0.0
        
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
    
    message = HumanMessage(content=[
        {"type": "text", "text": human_text},
        {"type": "image_url", "image_url": {"url": state["image_url"]}}
    ])
    response = llm.invoke([system_prompt, message])
    
    try:
        clean_json = response.content.replace('```json', '').replace('```', '').strip()
        data = json.loads(clean_json)
        score = float(data.get("consistency_score", 0.0))
        text = data.get("rationale", "No rationale provided.")
    except Exception:
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
    
    OMCS = (0.35 * p_score) + (0.45 * r_score) + (0.20 * c_score)
    
    # Set the status immediately so it's available even if we skip the feedback node
    status = "Pass" if OMCS >= 70 else "Fail"
    
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
    response = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)])
    
    return {"feedback": response.content}

# Conditional Routing Logic
def route_omcs_outcome(state: CeviewValidationState) -> str:
    """Evaluates the OMCS score to decide the next step."""
    if state.get("omcs_score", 0) >= 70:
        return "PASS"  # Immediately terminate on Pass
    else:
        return "FAIL"  # Route to feedback on Fail
