import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import OnboardingSidebar, { ONBOARDING_STEPS } from './OnboardingSidebar';
import BasicInfoStep from './steps/BasicInfoStep';
import BrandIdentityStep from './steps/BrandIdentityStep';
import StructuredInputsStep from './steps/StructuredInputsStep';
import AssetsLinksStep from './steps/AssetsLinksStep';
import AnalysisStep, { DEFAULT_DEMO_DRAFT } from './steps/AnalysisStep';
import type { InferredCategory } from '../InferredCategoryBoard';
import { useProfile } from '../../../services/profileContext';

export default function OnboardingWizard() {
  const { setProfile } = useProfile();
  const navigate = useNavigate();

  // Active step index (defaulting to 4 - Step 5 Analysis for current card execution)
  const [obIndex, setObIndex] = useState<number>(4);

  // Step 5 state machine
  const [obPhase, setObPhase] = useState<
    'idle' | 'analyzing' | 'categories' | 'computing' | 'scored'
  >('idle');
  const [categories, setCategories] = useState<InferredCategory[]>([]);
  const [scores, setScores] = useState<{
    overallScore: number;
    semanticsScore: number;
    categoryScore: number;
  } | null>(null);

  // Wizard profile draft state (pre-populated with sample resort profile for standalone execution)
  const [obDraft, setObDraft] = useState(DEFAULT_DEMO_DRAFT);

  // Track completed steps
  const completedSteps = [
    Boolean(obDraft.businessName && obDraft.industry),
    (obDraft.vibes?.length ?? 0) > 0 && (obDraft.coreServices?.length ?? 0) > 0,
    Boolean(obDraft.description && obDraft.uvp),
    true, // Assets & Links is optional
    obPhase === 'scored',
  ];

  const currentStep = ONBOARDING_STEPS[obIndex];
  const isLastStep = obIndex === 4;

  const handleNext = () => {
    if (obIndex < ONBOARDING_STEPS.length - 1) {
      setObIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (obIndex > 0) {
      setObIndex((prev) => prev - 1);
    }
  };

  const handleFinishWizard = () => {
    if (!scores) return;

    const selectedCategories = categories
      .filter((c) => c.selected)
      .map((c) => c.name);

    setProfile({
      businessProfileId: 'profile-1',
      businessName: obDraft.businessName,
      industry: obDraft.industry,
      slogan: obDraft.slogan,
      vibes: obDraft.vibes,
      coreServices: obDraft.coreServices,
      description: obDraft.description,
      uvp: obDraft.uvp,
      categories: selectedCategories,
      uniquenessScore: scores.overallScore,
      imagePreview: null,
      website: obDraft.website,
      logo: obDraft.logo,
      socials: obDraft.socials,
    });

    navigate('/dashboard', { replace: true });
  };

  const renderActiveStep = () => {
    switch (obIndex) {
      case 0:
        return <BasicInfoStep />;
      case 1:
        return <BrandIdentityStep />;
      case 2:
        return <StructuredInputsStep />;
      case 3:
        return <AssetsLinksStep />;
      case 4:
        return (
          <AnalysisStep
            obDraft={obDraft}
            obPhase={obPhase}
            setObPhase={setObPhase}
            categories={categories}
            setCategories={setCategories}
            scores={scores}
            setScores={setScores}
            onFinishWizard={handleFinishWizard}
            onJumpToStep={(stepIdx) => setObIndex(stepIdx)}
          />
        );
      default:
        return null;
    }
  };

  // Calculate percentage width for top progress bar
  const progressPercent = ((obIndex + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-page flex flex-col md:flex-row max-w-[1280px] mx-auto w-full">
      {/* Reusable Sidebar */}
      <OnboardingSidebar
        currentStepIndex={obIndex}
        completedSteps={completedSteps}
        onStepClick={(idx) => setObIndex(idx)}
      />

      {/* Main Content Area */}
      <main className="ob-main flex-1 p-6 md:p-10 lg:p-12 flex flex-col min-h-screen justify-between overflow-y-auto">
        <div>
          {/* Top Progress Bar */}
          <div className="ob-progress h-1 bg-line rounded-full overflow-hidden mb-8 w-full max-w-[640px]">
            <div
              className="h-full bg-gold transition-all duration-300 ease-brand"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Step Panel */}
          <div className="ob-panel w-full max-w-[640px] flex-1">
            {renderActiveStep()}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="ob-foot flex items-center justify-between gap-4 max-w-[640px] w-full mt-10 pt-5 border-t border-line">
          <button
            type="button"
            onClick={handleBack}
            disabled={obIndex === 0}
            className="btn btn-quiet flex items-center gap-2 text-xs font-bold text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-4">
            <span className="body-xs text-muted text-[12px] font-semibold">
              Step {obIndex + 1} of {ONBOARDING_STEPS.length}
            </span>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleFinishWizard}
                disabled={obPhase !== 'scored' || !scores}
                className="btn btn-primary flex items-center gap-2 py-2.5 px-5 rounded-md bg-navy hover:bg-navy-light text-white font-bold text-xs shadow-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span>Finish Setup</span>
                <Check size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="btn btn-primary flex items-center gap-2 py-2.5 px-5 rounded-md bg-navy hover:bg-navy-light text-white font-bold text-xs shadow-1 transition-all"
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
