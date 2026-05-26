from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from creative_director_agent.state import SocialAgentState
from core.AgentLLMModel import AgentLLMModel
from creative_director_agent.prompts import service_analysis_prompt, caption_generation_prompt


# Initialize LLM (Gemini 2.5 Flash handles structured JSON tasks perfectly)
llm = AgentLLMModel.get_model()

# 2. Node: Analyze and Filter Services
def analyze_services(state: SocialAgentState):
    """Filters business services to only include those relevant to the market category."""
    
    prompt = service_analysis_prompt
    
    # Force JSON parsing
    chain = prompt | llm | JsonOutputParser()
    filtered_list = chain.invoke({
        "market_category": state["market_category"],
        "business_services": state["business_services"]
    })
    
    return {"relevant_services": filtered_list}

# 3. Node: Generate Matrix of Captions
def generate_platform_captions(state: SocialAgentState):
    """Generates 3 distinct caption variations for Facebook, Instagram, and TikTok."""
    
    prompt = caption_generation_prompt
    
    chain = prompt | llm | JsonOutputParser()
    caption_matrix = chain.invoke(state)
    
    return {"final_captions": caption_matrix}

