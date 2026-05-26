from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.agents.creative_director_agent.state import SocialAgentState
from app.core.AgentLLMModel import AgentLLMModel
from app.agents.creative_director_agent.node import analyze_services, generate_platform_captions
# 4. Build the Graph Workflow
workflow = StateGraph(SocialAgentState)

# Add processing steps
workflow.add_node("analyze_services", analyze_services)
workflow.add_node("generate_platform_captions", generate_platform_captions)

# Map linear flow
workflow.set_entry_point("analyze_services")
# workflow.add_edge("analyze_services", "generate_platform_captions")
workflow.add_edge("generate_platform_captions", END)

# Compile the agent
caption_generation_agent = workflow.compile()
