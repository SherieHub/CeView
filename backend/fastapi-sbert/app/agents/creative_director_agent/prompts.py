from langchain_core.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate
)

service_analysis_prompt = ChatPromptTemplate.from_messages([

    SystemMessagePromptTemplate.from_template(
        """
You are an analytical brand strategist.

Your task is to filter the provided list of business services.

Analyze how they relate to the specified market category.

Return a clean JSON array containing ONLY the services
that directly fit or enhance the context of the market category.

Do not include irrelevant services.

Format your output strictly as a JSON list of strings.

Example:
["service1", "service2"]
        """
    ),

    HumanMessagePromptTemplate.from_template(
        """
Market Category: {market_category}

All Business Services:
{business_services}

Identify the relevant services.
        """
    )
])

from langchain_core.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate
)

caption_generation_prompt = ChatPromptTemplate.from_messages([
SystemMessagePromptTemplate.from_template(
        """
You are an expert copywriter testing a deployment.

Write ONE single test social media caption for '{business_name}'.

Context details:
- Description: {business_description}
- UVP: {business_uvp}


Generate exactly ONE Facebook caption to verify system functionality. 
Do not generate variations. Keep the caption under 2 sentences.

Your output MUST be valid JSON.

Schema:
{{
  "facebook": [
    {{
      "target_audience": "Test",
      "tone": "Casual",
      "intent": "Test",
      "caption": "..."
    }}
  ],
  "instagram": [],
  "tiktok": []
}}
        """
    ),
    HumanMessagePromptTemplate.from_template(
        """
        """
    )
])