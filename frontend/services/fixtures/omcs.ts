/**
 * Module 3.3 OMCS (compliance audit) fixture — transcribed from
 * ui-ux-prototype.html:1396–1426 (OmcsAuditResultDTO).
 */

export const OMCS_RUBRIC_LABELS: Record<string, string> = {
  visual_business_context_match: 'Visual ↔ business context match',
  visual_intent_consistency: 'Visual intent consistency',
  tone_visual_mood_alignment: 'Tone ↔ visual mood alignment',
  psychological_strategy_support: 'Psychological strategy support',
  target_audience_fit: 'Target audience fit',
  platform_suitability: 'Platform suitability',
  attribute_coverage_consistency: 'Attribute coverage consistency',
};

export interface OmcsAuditResult {
  profileSemanticScore: number;
  rubricEvaluationData: {
    scores: Record<keyof typeof OMCS_RUBRIC_LABELS, number>;
    total: number;
  };
  recommendationsPictureScore: number;
  pubmatConsistencyScore: number;
  consistencyExplanation: string;
  omcsScore: number;
  status: 'Pass' | 'Fail';
  feedback: string;
}

export const MOCK_OMCS: OmcsAuditResult = {
  profileSemanticScore: 85.5,
  rubricEvaluationData: {
    scores: {
      visual_business_context_match: 88,
      visual_intent_consistency: 82,
      tone_visual_mood_alignment: 90,
      psychological_strategy_support: 79,
      target_audience_fit: 86,
      platform_suitability: 84,
      attribute_coverage_consistency: 75,
    },
    total: 83.4,
  },
  recommendationsPictureScore: 83.4,
  pubmatConsistencyScore: 81.0,
  consistencyExplanation:
    "The caption promises stillness and unstructured rest; the image delivers warm golden-hour light and an uncluttered frame, which supports that promise. The sardine run — the caption's strongest concrete claim — is not visible in the asset, which is the main source of drift.",
  omcsScore: 83.8,
  status: 'Pass',
  feedback:
    "Passes comfortably. To push above 90, swap in an underwater frame that shows the sardine shoal so the image evidences the caption's central claim rather than only its mood.",
};
