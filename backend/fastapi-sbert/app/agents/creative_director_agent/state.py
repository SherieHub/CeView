from typing import TypedDict, List, Dict, Any

# 1. Define the State Structure
class SocialAgentState(TypedDict):
    # Core Business Context Inputs
    business_name: str
    business_description: str
    business_uvp: str
    business_services: List[str]  # Complete list of services
    market_category: str          # Current focus (e.g., "beach", "mountain", "city")
    country_market: str           # Target geographic market (e.g., "Philippines")
    content_topic: str            # Current post topic
    
    # Derived or Generated States
    relevant_services: List[str]   # Dynamically filtered by the agent
    final_captions: Dict[str, List[Dict[str, str]]] # Final 3x3 platform matrix