from app.agents.creative_director_agent.graph import caption_generation_agent
from app.model.CaptionInputClass import CaptionInputClass

async def caption_generation_service(input: CaptionInputClass):
    result = await caption_generation_agent.ainvoke(input)
    return result