import requests
from langchain_core.tools import tool

@tool
def fetch_trending_hashtags(query: str, platform: str) -> list[str]:
    """
    Fetches the top trending hashtags for a specific topic and platform from an external API.
    
    Args:
        query: The main topic (e.g., "beach", "sustainable tourism").
        platform: The target platform ("instagram", "tiktok", "facebook").
    """
    # --- PRODUCTION API CALL EXAMPLE ---
    # api_url = f"https://api.social-tracker.com/v1/hashtags?q={query}&network={platform}"
    # headers = {"Authorization": f"Bearer {os.getenv('HASHTAG_API_KEY')}"}
    # response = requests.get(api_url, headers=headers)
    # return response.json().get("top_tags", [])
    
    # --- SIMULATED API RESPONSE FOR THIS EXAMPLE ---
    query = query.lower()
    simulated_database = {
        "instagram": {
            "beach": ["#BeachVibes", "#IslandLife", "#VitaminSea", "#TropicalGetaway"],
            "cebu": ["#CebuPh", "#Sugbo", "#DiscoverCebu", "#CebuTourism"]
        },
        "tiktok": {
            "beach": ["#BeachTok", "#TravelHacks", "#HiddenGems", "#OceanAesthetic"],
            "cebu": ["#CebuEats", "#TravelPh", "#CebuTravel", "#FYPphilippines"]
        },
        "facebook": {
            "beach": ["#FamilyVacation", "#WeekendGetaway", "#TravelGoals"],
            "cebu": ["#CebuCity", "#SupportLocalPh", "#CebuEvents"]
        }
    }
    
    # Return simulated tags based on the inputs
    platform_tags = simulated_database.get(platform.lower(), {})
    
    # Try to find a match for the query (e.g., if query contains 'cebu' or 'beach')
    for key, tags in platform_tags.items():
        if key in query:
            return tags
            
    return ["#TrendingNow", "#Explore", "#Viral"]