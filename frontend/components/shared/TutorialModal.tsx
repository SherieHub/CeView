/**
 * TutorialModal — a 4-slide walkthrough carousel (Dashboard, Content Studio,
 * Calendar, Performance) shown to a business operator on first login, and
 * again on demand via a "Replay tour" settings link. Purely presentational:
 * it owns only its own slide position, and leaves persistence (has the user
 * seen it before?) and triggering (when to open it) to its caller.
 */
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Sparkles, CalendarDays, TrendingUp } from 'lucide-react';
import Modal from './Modal';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

interface Slide {
  title: string;
  icon: LucideIcon;
  body: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    body: 'Your alert command center. See surge alerts the moment CeView forecasts a spike in travelers from your tracked markets, scoped to your business categories — so you know when demand is coming before it arrives.',
  },
  {
    title: 'Content Studio',
    icon: Sparkles,
    body: 'Turn a surge alert into ready-to-post content. Generate market-localized captions and visual direction, get them checked for compliance, and publish straight to your connected platforms.',
  },
  {
    title: 'Calendar',
    icon: CalendarDays,
    body: "See what's scheduled and when. Track every piece of content you've queued or published, so your posting stays consistent around each surge.",
  },
  {
    title: 'Performance',
    icon: TrendingUp,
    body: 'Know what worked. Feed in your campaign results and get KPIs, a funnel breakdown, and an AI-generated report that tells you exactly what to fix next.',
  },
];

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];
  const Icon = slide.icon;

  return (
    <Modal open={open} onClose={onClose} label="Welcome tour">
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon size={48} strokeWidth={1.5} color="var(--color-navy-primary)" aria-hidden="true" />
        <h2 className="heading-md">{slide.title}</h2>
        <p className="body-sm">{slide.body}</p>

        <div className="flex items-center gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.title}
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  i === step ? 'var(--color-navy-primary)' : 'var(--color-gray-light)',
              }}
            />
          ))}
        </div>

        <div className="mt-2 flex w-full items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-outline">
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" onClick={onClose} className="btn-cta">
                Get started
              </button>
            ) : (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-cta">
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
