import { Check, Info } from 'lucide-react';

export interface OnboardingStepInfo {
  id: string;
  title: string;
  sub: string;
}

export const ONBOARDING_STEPS: OnboardingStepInfo[] = [
  { id: 'basic', title: 'Basic Info', sub: 'Name, industry, slogan' },
  { id: 'brand', title: 'Brand Identity', sub: 'Vibe and core services' },
  { id: 'structured', title: 'Structured Inputs', sub: 'Description and UVP' },
  { id: 'assets', title: 'Assets & Links', sub: 'Socials, logo, website' },
  { id: 'analysis', title: 'Analysis', sub: 'Categories and uniqueness' },
];

interface OnboardingSidebarProps {
  currentStepIndex: number;
  completedSteps?: boolean[];
  onStepClick?: (index: number) => void;
}

export default function OnboardingSidebar({
  currentStepIndex,
  completedSteps = [],
  onStepClick,
}: OnboardingSidebarProps) {
  return (
    <aside className="w-full md:w-[320px] lg:w-[340px] flex-shrink-0 border-b md:border-b-0 md:border-r border-line bg-panel p-6 lg:p-8 flex flex-col justify-between md:sticky md:top-0 md:h-screen md:overflow-y-auto z-10">
      <div>
        {/* Brand Mark Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-navy text-gold grid place-items-center font-extrabold text-base shadow-1">
            Ce
          </div>
          <div>
            <b className="text-[14.5px] font-extrabold tracking-tight block leading-tight text-navy">
              CeView
            </b>
            <span className="text-[10px] tracking-[0.13em] uppercase color-muted font-bold block text-muted">
              Set up your profile
            </span>
          </div>
        </div>

        {/* Eyebrow */}
        <p className="eyebrow mb-3">Required steps</p>

        {/* Steps List */}
        <div className="flex flex-col gap-1.5">
          {ONBOARDING_STEPS.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isDone = completedSteps[idx] ?? idx < currentStepIndex;
            const isPending = !isCurrent && !isDone;

            let stateAttr = 'pending';
            if (isCurrent) stateAttr = 'current';
            else if (isDone) stateAttr = 'done';

            return (
              <div
                key={step.id}
                data-state={stateAttr}
                onClick={() => onStepClick && onStepClick(idx)}
                className={`ob-step flex items-start gap-3 p-3 rounded-md transition-colors ${
                  isCurrent
                    ? 'bg-gold-wash border border-gold/30 shadow-1'
                    : 'hover:bg-panel-sunk cursor-pointer'
                }`}
              >
                {/* Dot Badge */}
                <div
                  className={`ob-dot w-6 h-6 rounded-full flex-shrink-0 grid place-items-center text-[11.5px] font-extrabold border transition-all mt-0.5 ${
                    isDone
                      ? 'bg-success border-success text-white'
                      : isCurrent
                      ? 'bg-navy border-navy text-white shadow-1'
                      : 'bg-panel border-line-strong text-muted'
                  }`}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : idx + 1}
                </div>

                {/* Labels */}
                <div>
                  <b
                    className={`block text-[12.5px] font-bold leading-snug ${
                      isCurrent
                        ? 'text-navy font-extrabold'
                        : isDone
                        ? 'text-ink'
                        : 'text-muted'
                    }`}
                  >
                    {step.title}
                  </b>
                  <span className="text-[11px] text-muted leading-tight block mt-0.5">
                    {step.sub}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Banner at bottom */}
      <div className="banner banner-info flex items-start gap-3 p-3.5 rounded-md bg-[rgba(15,40,84,0.04)] border border-line text-xs text-navy mt-8 md:mt-6">
        <Info size={18} className="text-navy flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[12px] text-ink-2">
          Every field feeds the AI. Complete answers produce sharper forecasts and better captions.
        </div>
      </div>
    </aside>
  );
}
