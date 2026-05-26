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
You are an expert copywriter.

Write social media captions for '{business_name}'.

Context details:
- Description: {business_description}
- Unique Value Proposition (UVP): {business_uvp}
- Relevant Services to highlight: {relevant_services}
- Regional Focus/Market: {country_market}

Generate captions for 3 platforms:
- facebook
- instagram
- tiktok

For EACH platform, provide EXACTLY 3 distinct caption variations.

Each variation must intentionally differ in:
1. Target Audience
2. Tone
3. Intent

Examples:
- Audience: Solo Backpackers vs Luxury Families
- Tone: Casual, Funny, Professional
- Intent: Sell, Engage, Inform

Platform Best Practices:
- TikTok → strong hooks
- Facebook → readable formatting
- Instagram → strong hashtags

Your output MUST be valid JSON.

Schema:
{{
  "facebook": [
    {{
      "target_audience": "...",
      "tone": "...",
      "intent": "...",
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
Write the 3x3 caption matrix about this topic:

{content_topic}
        """
    )
])