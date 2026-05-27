from app.agents.omcs_agent.graph import app
from app.model.ComplianceScoreInputClass import ComplianceInputClass

def omcs_calculation(input: ComplianceInputClass):
    result = app.invoke(input)
    return result