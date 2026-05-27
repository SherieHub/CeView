from langchain_core.prompts import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate
)

generation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """
You are a marketing analytics expert.
You understand the meaning and business impact of CTR, CPC, ROAS, CR, and CAC.
Your role is to interpret marketing performance data and output a strictly structured JSON containing metric conditions, cross-metric logic, and a ranked list of weaknesses.
        """
    ),
    
    HumanMessagePromptTemplate.from_template(
        """
You are a senior marketing analyst AI.

You will be given multiple marketing metrics in a JSON format.
CRITICAL DATA STRUCTURE RULE: 
- The data is in reverse chronological order. 
- Index [0] is the CURRENT WEEK (most recent). 
- The final index in the list is the FIRST WEEK (baseline/start).

Instructions:
1. Identify each metric's trend, peak, low, current condition and provide a 2 - 3 sentences that explains the current condition of this metric and how 
            this values means to the bussiness   (reading from baseline to index 0).
2. Explain the cross-metric logic (e.g., how engagement affected cost and conversions).
3. Identify and rank the weak metrics. Rank 1 is the MOST URGENT metric requiring immediate intervention.
4. For each ranked weakness, explain what it means and provide a specific action to fix it.

Here is the time series data for the campaign:
{metrics_data}
{feedback_context}
        """
    )
])

evaluation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """
You are a strict marketing report quality evaluator.

Your job is to evaluate whether a marketing performance JSON is accurate, complete, and logically consistent. You ONLY evaluate it.
        """
    ),
    
    HumanMessagePromptTemplate.from_template(
        """
Evaluate the generated JSON report based on the input data.

Original time series metrics (Index [0] = CURRENT week, Last index = STARTING week):
{metrics_data}

Generated JSON Report:
{generated_report}

Evaluation Criteria:
1. Data Coverage: Are all input metrics represented in the conditions?
2. Trend Accuracy: Are trends correctly identified (up/down/stable/volatile)? Are peak and low points correctly described given index [0] is current?
3. Cross-Metric Logic: Does it correctly explain relationships between metrics? Are insights logically consistent?
4. Ranking & Actionability: Are the weaknesses ranked correctly with rank 1 being the most urgent? Are recommendations actionable?
        """
    )
])