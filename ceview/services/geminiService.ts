import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, GeneratedContent, MarketId, PostPerformance, PerformanceAnalysis } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export interface UniquenessResult {
  descriptionScore: number;
  categoryScore: number;
  overallScore: number;
  descriptionReasoning: string;
  categoryReasoning: string;
}

export const analyzeUniqueness = async (
  businessName: string,
  categories: string[],
  coreServices: string[],
  description: string,
  uvp: string,
): Promise<UniquenessResult> => {
  if (!apiKey) {
    console.warn("No API Key found, returning mock uniqueness scores.");
    return new Promise(resolve => setTimeout(() => {
      const descriptionScore = 72;
      const categoryScore = 58;
      resolve({
        descriptionScore,
        categoryScore,
        overallScore: Math.round((descriptionScore + categoryScore) / 2),
        descriptionReasoning: "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        categoryReasoning: "Align but diversify your category mix to stand out from nearby competitors.",
      });
    }, 1500));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are CeView's Uniqueness Analyst for Philippine tourism businesses. Score this business on two independent dimensions.

Business Name: ${businessName}
Active Operational Categories: ${categories.join(', ')}
Core Service Offerings: ${coreServices.join(', ')}
Full Description: ${description}
Unique Value Proposition: ${uvp}

Task:
1. descriptionScore (0-100): How semantically distinctive are the Full Description AND Unique Value Proposition compared to generic Philippine tourism marketing copy? Higher = more original phrasing, novel hooks, specific sensory or experiential details. Lower = clichéd, interchangeable, derivative.
2. categoryScore (0-100): How rare or differentiated is the Active Operational Categories mix in the Philippine tourism landscape? Higher = uncommon category or rare combination. Lower = saturated, commodity category.
3. For each score, provide one short actionable tip (under 15 words) — generic advice the business can act on to improve that score, not commentary on the submitted text. Example style: "Align but diversify your category mix to stand out from nearby competitors."

Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descriptionScore: { type: Type.NUMBER },
            categoryScore: { type: Type.NUMBER },
            descriptionReasoning: { type: Type.STRING },
            categoryReasoning: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    const parsed = JSON.parse(text) as Omit<UniquenessResult, 'overallScore'>;
    const descriptionScore = Math.max(0, Math.min(100, Math.round(parsed.descriptionScore)));
    const categoryScore = Math.max(0, Math.min(100, Math.round(parsed.categoryScore)));
    return {
      descriptionScore,
      categoryScore,
      overallScore: Math.round((descriptionScore + categoryScore) / 2),
      descriptionReasoning: parsed.descriptionReasoning,
      categoryReasoning: parsed.categoryReasoning,
    };
  } catch (error) {
    console.error("Uniqueness Analysis Error", error);
    throw error;
  }
};

export const analyzeImageAndStrategy = async (base64Image: string, description: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    // Mock response if no API key is present for demo purposes
    console.warn("No API Key found, returning mock analysis.");
    return new Promise(resolve => setTimeout(() => resolve({
      sellingPoints: [
        { point: "Rustic Charm", description: "Authentic local materials and unpolished beauty." },
        { point: "Secluded Nature", description: "Away from the crowds, offering privacy." },
        { point: "Eco-Conscious", description: "Sustainable practices visible in the setting." }
      ],
      suggestedMarket: MarketId.KOREA,
      risingTrend: "Healing & Wellness Travel",
      marketReasoning: "South Korean search trends indicate a 40% spike in 'Healing Travel' and 'Quiet Resorts' for the upcoming season."
    }), 2000));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: `You are the 'Intelligence Loop' for CeView, a tourism AI.
            Analyze this image and the user's description: "${description}".
            
            1. Extract 3 hidden selling points (e.g., Rustic, Sustainable, Instagrammable).
            2. Based on general travel knowledge, suggest the best target market among [South Korea, Japan, USA].
            3. Identify a rising trend relevant to that market (e.g., 'Healing Travel', 'Adventure', 'Solo Dining').
            4. Provide reasoning.

            Return JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sellingPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            suggestedMarket: { type: Type.STRING, enum: [MarketId.KOREA, MarketId.JAPAN, MarketId.USA] },
            risingTrend: { type: Type.STRING },
            marketReasoning: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const generateCampaignContent = async (analysis: AnalysisResult, market: MarketId): Promise<GeneratedContent> => {
  if (!apiKey) {
     return new Promise(resolve => setTimeout(() => resolve({
      caption: "🌿 Escape the noise and find your inner peace. Our rustic villas offer the perfect sanctuary for your healing journey. #Cebu #HealingTravel #Nature",
      translation: "🌿 소음에서 벗어나 내면의 평화를 찾으세요. 우리의 소박한 빌라는 당신의 치유 여행을 위한 완벽한 안식처를 제공합니다.",
      hashtags: ["#Cebu", "#HealingTravel", "#HiddenGem", "#Philippines"],
      suggestedTime: "Friday, 7:00 PM KST (Commute Time)"
    }), 2000));
  }

  try {
     const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a social media post for a tourism business in Cebu.
      Target Market: ${market}.
      Selling Points: ${analysis.sellingPoints.map(p => p.point).join(', ')}.
      Trend to leverage: ${analysis.risingTrend}.

      Output requirements:
      1. Caption: Culturally adapted (emotional for Korea, polite/detailed for Japan, action/value for USA).
      2. Translation: If market is not USA, provide the text in the target language.
      3. Hashtags: Relevant high-traffic tags.
      4. SuggestedTime: Best time to post for that market's timezone.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING },
            translation: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedTime: { type: Type.STRING }
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as GeneratedContent;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

export const generatePerformanceAnalysis = async (posts: PostPerformance[]): Promise<PerformanceAnalysis> => {
  if (!apiKey) {
    return new Promise(resolve => setTimeout(() => resolve({
      summary: "This week showed a clear preference for immersive video content over static promotions. The 'Healing Travel' angle is resonating strongly with high engagement rates (>10%), while generic discount posts are underperforming.",
      strengths: [
        "TikTok POV content is driving the highest reach (Viral potential).",
        "Instagram 'Healing' visuals are generating deep engagement (Comments/Saves).",
        "Sustainable/Local Ingredient stories are building community trust."
      ],
      weaknesses: [
        "Standard discount posts on Facebook have very low engagement (Ad blindness).",
        "Generic captions are failing to stop the scroll.",
        "Repurposed old content is negatively impacting brand perception."
      ],
      recommendations: [
        "Double down on vertical video formats showing the 'experience' rather than the 'room'.",
        "Stop posting standalone discount graphics; integrate offers into lifestyle captions instead.",
        "Experiment with 'Behind the Scenes' content for the restaurant to boost the sustainability angle."
      ]
    }), 2000));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are the Lead Marketing Analyst for CeView. Analyze the following social media performance data for a Tourism Business.
      
      Data: ${JSON.stringify(posts)}
      
      Task:
      1. Identify patterns in what is working (High engagement/Reach) vs what isn't.
      2. Provide specific feedback on content types (Video vs Photo, Emotional vs Transactional).
      3. Give 3 actionable recommendations for next week.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as PerformanceAnalysis;

  } catch (error) {
    console.error("Performance Analysis Error", error);
    throw error;
  }
}