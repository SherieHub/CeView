import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ActionableScoreCard from '../../ActionableScoreCard';
import ComputeUniquenessButton from '../../ComputeUniquenessButton';
import InferredCategoryBoard, {
  type InferredCategory,
} from '../../InferredCategoryBoard';
export type { InferredCategory };
import OverallScoreCard from '../../OverallScoreCard';
import { useToast } from '../../../shared/Toast';

export const BUSINESS_CATEGORIES = [
  'Coastal & Island',
  'Adventure & Nature',
  'Cultural & Heritage',
  'Theme Parks / Entertainment',
  'Urban & City',
  'Culinary & Gastronomy',
  'Accommodation & Staycation',
];

export const DEFAULT_DEMO_DRAFT = {
  businessName: 'Moalboal Reef & Dive Resort',
  industry: 'Accommodation & Staycation',
  slogan: 'Sanctuary by the Sea',
  vibes: ['Eco-Conscious', 'Serene & Restorative', 'Adventurous'],
  coreServices: [
    'Sardine Run Diving',
    'Private Seafront Villas',
    'Marine Ecology Workshops',
  ],
  description:
    'Moalboal Reef & Dive Resort is an eco-friendly marine sanctuary resort located along Panagsama Beach in Moalboal, Cebu. We specialize in zero-footprint beachfront accommodation and guided diving excursions to the famous Moalboal sardine run and Pescador Island reefs. Our property features 14 private bamboo villas powered by solar energy, an organic sea-view restaurant, and on-site PADI certified dive master services.',
  uvp: 'The only solar-powered luxury dive sanctuary on Panagsama Beach with private house-reef access and zero marine plastic footprint.',
  socials: {
    instagram: '@moalboalreef',
    facebook: 'moalboalreefresort',
    tiktok: '',
    naver: '',
  },
  website: 'https://moalboalreef.com',
  logo: null,
};

/** Deterministic stand-in classification algorithm matching prototype fakeClassify() */
export function fakeClassify(draftInput: typeof DEFAULT_DEMO_DRAFT): InferredCategory[] {
  const text = (
    (draftInput.description || '') +
    ' ' +
    (draftInput.uvp || '') +
    ' ' +
    (draftInput.coreServices || []).join(' ')
  ).toLowerCase();

  const kw: Record<string, string[]> = {
    'Coastal & Island': [
      'beach',
      'sea',
      'reef',
      'island',
      'dive',
      'snorkel',
      'sardine',
      'ocean',
      'shore',
      'coast',
    ],
    'Adventure & Nature': [
      'dive',
      'hike',
      'canyon',
      'trek',
      'nature',
      'reef',
      'wild',
      'adventure',
      'falls',
    ],
    'Cultural & Heritage': [
      'heritage',
      'culture',
      'history',
      'festival',
      'church',
      'barangay',
      'local',
    ],
    'Theme Parks / Entertainment': [
      'park',
      'ride',
      'entertain',
      'show',
      'attraction',
    ],
    'Urban & City': ['city', 'urban', 'mall', 'downtown', 'business'],
    'Culinary & Gastronomy': [
      'food',
      'dining',
      'restaurant',
      'cuisine',
      'farm',
      'table',
      'lechon',
      'eat',
    ],
    'Accommodation & Staycation': [
      'room',
      'resort',
      'stay',
      'villa',
      'hotel',
      'suite',
      'balcony',
      'guest',
      'accommodation',
    ],
  };

  const raw = BUSINESS_CATEGORIES.map((c) => {
    const hits = (kw[c] || []).reduce(
      (n, w) => n + (text.includes(w) ? 1 : 0),
      0
    );
    let s = 0.06 + hits * 0.14;
    if (c === draftInput.industry) s += 0.3;
    return { name: c, score: s };
  });

  const total = raw.reduce((a, b) => a + b.score, 0);
  raw.sort((a, b) => b.score - a.score);

  let used = 0;
  return raw.map((r, i) => {
    let pct: number;
    if (i < raw.length - 1) {
      pct = Math.round((r.score / total) * 100);
      used += pct;
    } else {
      pct = Math.max(0, 100 - used);
    }
    return { name: r.name, percentage: pct, selected: i < 2 };
  });
}

/** Calculate uniqueness score matching prototype obCompute() */
export function calculateUniquenessScore(
  draftInput: typeof DEFAULT_DEMO_DRAFT,
  categoriesInput: InferredCategory[]
) {
  const sel = categoriesInput.filter((c) => c.selected);
  const selSum = sel.reduce((a, c) => a + c.percentage, 0) / 100;
  const categoryScore = Math.round(Math.max(0, Math.min(100, selSum * 100)));

  const fullText = (draftInput.description || '') + ' ' + (draftInput.uvp || '');
  const wordMatches = fullText.trim().split(/\s+/).filter(Boolean);
  const wordsCount = wordMatches.length;
  const distinctWords = new Set(
    fullText.toLowerCase().match(/[a-z]{4,}/g) || []
  ).size;

  const semanticsScore = Math.round(
    Math.max(35, Math.min(100, 34 + distinctWords * 0.42 + wordsCount * 0.05))
  );

  const overallScore = Math.round((categoryScore + semanticsScore) / 2);

  return { overallScore, semanticsScore, categoryScore };
}

export interface AnalysisStepProps {
  obDraft?: typeof DEFAULT_DEMO_DRAFT;
  obPhase?: 'idle' | 'analyzing' | 'categories' | 'computing' | 'scored';
  setObPhase?: (
    phase: 'idle' | 'analyzing' | 'categories' | 'computing' | 'scored'
  ) => void;
  categories?: InferredCategory[];
  setCategories?: (categories: InferredCategory[]) => void;
  scores?: {
    overallScore: number;
    semanticsScore: number;
    categoryScore: number;
  } | null;
  setScores?: (
    scores: {
      overallScore: number;
      semanticsScore: number;
      categoryScore: number;
    } | null
  ) => void;
  onFinishWizard?: () => void;
  onJumpToStep?: (stepIndex: number) => void;
}

export default function AnalysisStep({
  obDraft = DEFAULT_DEMO_DRAFT,
  obPhase: propPhase,
  setObPhase: propSetPhase,
  categories: propCategories,
  setCategories: propSetCategories,
  scores: propScores,
  setScores: propSetScores,
  onFinishWizard,
  onJumpToStep,
}: AnalysisStepProps) {
  const { showToast } = useToast();

  // Internal state fallback for standalone use
  const [internalPhase, setInternalPhase] = useState<
    'idle' | 'analyzing' | 'categories' | 'computing' | 'scored'
  >('idle');
  const [internalCategories, setInternalCategories] = useState<
    InferredCategory[]
  >([]);
  const [internalScores, setInternalScores] = useState<{
    overallScore: number;
    semanticsScore: number;
    categoryScore: number;
  } | null>(null);

  const currentPhase = propPhase ?? internalPhase;
  const setPhase = propSetPhase ?? setInternalPhase;

  const currentCategories = propCategories ?? internalCategories;
  const setCategories = propSetCategories ?? setInternalCategories;

  const currentScores = propScores ?? internalScores;
  const setScores = propSetScores ?? setInternalScores;

  // Auto-run analysis when mounting step 5
  useEffect(() => {
    if (currentPhase === 'idle') {
      setPhase('analyzing');
    }
    if (currentPhase === 'analyzing') {
      const timer = setTimeout(() => {
        const classified = fakeClassify(obDraft);
        setCategories(classified);
        setPhase('categories');
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, obDraft, setCategories, setPhase]);

  // Handle category toggle with mandatory >= 1 selected rule
  const handleToggleCategory = (name: string) => {
    const target = currentCategories.find((c) => c.name === name);
    if (!target) return;

    const selectedCount = currentCategories.filter((c) => c.selected).length;

    // Rule: At least 1 category must remain selected
    if (target.selected && selectedCount === 1) {
      showToast('At least one category must stay selected');
      return;
    }

    const updated = currentCategories.map((c) =>
      c.name === name ? { ...c, selected: !c.selected } : c
    );

    setCategories(updated);

    // Reset scores if category selection changes after scoring
    if (currentPhase === 'scored') {
      setPhase('categories');
      setScores(null);
    }
  };

  // Run uniqueness compute calculation
  const handleCompute = () => {
    setPhase('computing');
    setTimeout(() => {
      const calculatedScores = calculateUniquenessScore(
        obDraft,
        currentCategories
      );
      setScores(calculatedScores);
      setPhase('scored');
    }, 1500);
  };

  // Render Phase 1: Analyzing (Loading skeleton)
  if (currentPhase === 'idle' || currentPhase === 'analyzing') {
    return (
      <div className="w-full max-w-[640px] animate-fade-in">
        <p className="eyebrow">Step 5 — Analysis</p>
        <h2 className="h-xl mt-1.5 mb-2 text-ink">
          Analyzing your business profile
        </h2>
        <p className="body-sm mb-6 max-w-prose">
          Your description and UVP are being embedded and classified across the
          seven Cebu tourism categories.
        </p>

        {/* Skeleton rows */}
        <div className="grid gap-2.5">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="h-[58px] bg-panel-sunk border border-line rounded-md animate-pulse"
              />
            ))}
        </div>

        {/* E5 Embedding Banner */}
        <div className="banner banner-info flex items-center gap-3 p-4 rounded-md bg-[rgba(15,40,84,0.04)] border border-line mt-6 text-sm text-navy">
          <Loader2 size={18} className="animate-spin text-navy flex-shrink-0" />
          <div className="text-ink-2 font-medium">
            Running multilingual E5 embedding, then the Dense(256→128→7)
            classifier head…
          </div>
        </div>
      </div>
    );
  }

  // Render Phase 2 & 3: Categories & Scored
  return (
    <div className="w-full max-w-[640px] animate-fade-in">
      <p className="eyebrow">Step 5 — Analysis</p>
      <h2 className="h-xl mt-1.5 mb-2 text-ink">
        Confirm how CeView reads your business
      </h2>
      <p className="body-sm mb-6 max-w-prose">
        The classifier scored all seven categories. Keep the ones that genuinely
        describe you — everything downstream, from market ranking to caption
        tone, keys off this selection.
      </p>

      {/* Inferred Category Board */}
      <InferredCategoryBoard
        categories={currentCategories}
        onToggle={handleToggleCategory}
      />

      {/* Computing Spinner State */}
      {currentPhase === 'computing' && (
        <div className="card p-6 border border-line bg-panel text-center rounded-md mt-6 shadow-1">
          <Loader2 size={24} className="animate-spin text-navy mx-auto mb-3" />
          <p className="h-sm text-navy">
            Running semantic evaluation against regional MSME vectors…
          </p>
          <p className="body-xs mt-1 text-muted">
            Comparing your embedding against every other Cebu profile in the
            corpus.
          </p>
        </div>
      )}

      {/* Scored Results State */}
      {currentPhase === 'scored' && currentScores && (
        <div className="mt-8 animate-fade-in">
          <p className="eyebrow mb-3">Your uniqueness calibration</p>

          {/* 3 Score Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <OverallScoreCard score={currentScores.overallScore} />
            <ActionableScoreCard
              title="Description semantics"
              score={currentScores.semanticsScore}
              variant="teal"
            />
            <ActionableScoreCard
              title="Category confidence"
              score={currentScores.categoryScore}
              variant="gold"
            />
          </div>

          {/* Pass Banner (>=70) vs Warning Banner (<70) */}
          <div
            className={`banner p-4 rounded-md border flex items-start gap-3 mt-5 ${
              currentScores.overallScore >= 70
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {currentScores.overallScore >= 70 ? (
              <ShieldCheck
                size={20}
                className="text-emerald-600 flex-shrink-0 mt-0.5"
              />
            ) : (
              <AlertTriangle
                size={20}
                className="text-amber-600 flex-shrink-0 mt-0.5"
              />
            )}

            <div className="text-xs leading-relaxed">
              {currentScores.overallScore >= 70 ? (
                <span>
                  <b>Well differentiated.</b> Your description sits far from the
                  Cebu MSME cohort in embedding space, and the classifier
                  independently agrees with the categories you selected.
                </span>
              ) : (
                <span>
                  <b>Room to sharpen.</b> Your wording overlaps heavily with other
                  Cebu operators. Go back to Structured Inputs and name what is
                  physically specific to your property — distances, credentials,
                  things a competitor cannot copy.
                </span>
              )}
            </div>
          </div>

          {/* Strengthen UVP link if score < 70 */}
          {currentScores.overallScore < 70 && (
            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(2)}
              className="btn btn-ghost btn-sm mt-3 text-navy font-bold flex items-center gap-1.5 hover:underline text-xs"
            >
              <ArrowLeft size={14} />
              <span>Strengthen my UVP</span>
            </button>
          )}
        </div>
      )}

      {/* Compute Button (shown when in categories phase) */}
      {currentPhase === 'categories' && (
        <ComputeUniquenessButton onClick={handleCompute} />
      )}
    </div>
  );
}
