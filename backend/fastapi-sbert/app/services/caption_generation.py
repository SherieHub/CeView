from agents.creative_director_agent.graph import caption_generation_agent
from model.CaptionInputClass import CaptionInputClass

async def caption_generation(input: CaptionInputClass):
    result = await caption_generation_agent.ainvoke(input)
    return result