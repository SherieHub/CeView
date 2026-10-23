import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
// OMCS_RUBRIC_LABELS is a static display map (rubric key -> human label), not
// data the backend serves — kept as a direct fixture import deliberately.
import { OMCS_RUBRIC_LABELS } from '../../../services/fixtures/omcs';
import PanelHead from './PanelHead';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { ComplianceSlotProps } from './contentStudioTypes';
import { hasNonEnglishScript } from './captionLanguage';
import { getTranslation, requestTranslation } from './captionTranslationStore';

/**
 * Breathing room between audits. Each one makes two vision-model calls, and the model's host
 * meters output tokens per minute, so audits fired back to back are what trips its rate limit.
 * 60 s is one metering window; after a run that was refused for rate-limiting, 30 s is enough
 * on top of the server's own wait-and-retry.
 */
export const AUDIT_COOLDOWN_AFTER_RUN_MS = 60_000;
export const AUDIT_COOLDOWN_AFTER_RATE_LIMIT_MS = 30_000;

/** How long the model may take before the audit admits it is slower than usual. */
const STILL_WORKING_AFTER_S = 20;

function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'MOD33_RATE_LIMITED' || error.dependency === 'groq');
}

const STEPS = ['Read caption and platform constraints', 'Analyse publication media', 'Match business profile signals', 'Score visual direction consistency', 'Evaluate audience and cultural fit', 'Create compliance recommendation'];

/** How many steps the audit has; a finished audit sits at this step. */
export const AUDIT_STEP_COUNT = STEPS.length;

export default function CompliancePanel({ draft, audit, onAuditChange, recommendations }: ComplianceSlotProps) {
  // Caption + media only. The audit scores caption-to-media consistency; it has
  // no opinion on which platforms the post is bound for, and authorisation is
  // about publishing rather than about running a check. Both of those moved to
  // the publish modal — requiring them here deadlocked the screen, because the
  // modal is only reachable through the audit this gate blocks. The image is also
  // judged against the generated captions' visual guidance, so that must exist too.
  const ready = Boolean(draft.caption.trim() && draft.mediaDataUrl && recommendations);

  // When the next audit may start. Held here rather than in `audit`, so editing the caption
  // (which resets the audit to idle) cannot be used to skip the wait.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= cooldownUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const cooling = secondsLeft > 0;
  const wait = cooling ? ` (${secondsLeft}s)` : '';

  // The timed steps run out and the request is then in flight: the last one keeps animating.
  const waiting = audit.status === 'running' && audit.step >= STEPS.length;
  const stepsDone = waiting ? STEPS.length - 1 : Math.min(audit.step, STEPS.length - 1);
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  useEffect(() => {
    if (!waiting) { setWaitedSeconds(0); return; }
    const timer = window.setInterval(() => setWaitedSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  useEffect(() => {
    if (audit.status !== 'running') return;
    if (audit.step >= STEPS.length) {
      let cancelled = false;
      // The profile-similarity sub-score compares the caption with an English
      // profile, so a Korean/Japanese caption is scored via its English meaning.
      // A failed translation never blocks the audit — it just scores the native text.
      const send = (captionEn?: string) =>
        apiClient.compliance.omcsAnalyze({
          caption: draft.caption,
          ...(captionEn ? { captionEn } : {}),
          imageUrl: draft.mediaDataUrl ?? '',
          recommendations: recommendations ?? {},
        });
      const known = draft.captionEn || getTranslation(draft.caption);
      const call =
        !known && hasNonEnglishScript(draft.caption)
          ? requestTranslation(draft.caption).catch(() => undefined).then(send)
          : send(known);
      call
        .then((result) => {
          if (cancelled) return;
          setCooldownUntil(Date.now() + AUDIT_COOLDOWN_AFTER_RUN_MS);
          onAuditChange({ status: 'complete', step: STEPS.length, result });
        })
        .catch((e) => {
          if (cancelled) return;
          // Only a rate-limit refusal earns a wait; a network error should be retryable at once.
          if (isRateLimited(e)) setCooldownUntil(Date.now() + AUDIT_COOLDOWN_AFTER_RATE_LIMIT_MS);
          onAuditChange({ status: 'error', step: 0, result: null, error: e });
        });
      return () => { cancelled = true; };
    }
    const timer = window.setTimeout(() => onAuditChange({ ...audit, step: audit.step + 1 }), 420);
    return () => window.clearTimeout(timer);
  }, [audit, onAuditChange, draft.caption, draft.captionEn, draft.mediaDataUrl, recommendations]);

  // Unique per instance: a campaign post's audit can be mounted beside Quick Post's.
  const titleId = useId();
  const result = audit.result;
  const passed = result?.status === 'Pass';

  return (
    <section className="card" aria-labelledby={titleId}>
      <div className="studio-head">
        <span className="conn-ico" aria-hidden="true"><ShieldCheck /></span>
        <div className="studio-head-text">
          <h2 id={titleId} className="heading-md">Compliance audit</h2>
          <p className="body-sm">Checks the caption and selected media before publishing.</p>
        </div>
        {result && (
          <button
            type="button"
            className="btn-outline btn-outline--sm audit-rerun"
            disabled={cooling}
            title={cooling ? 'Audits are spaced out so the AI model’s rate limit isn’t hit' : undefined}
            onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}
          >
            <RefreshCw size={15} aria-hidden="true" />Re-run audit{wait}
          </button>
        )}
      </div>

      {audit.status === 'idle' && (
        // One action, centred in the card — the same shape as the Visual
        // guide's "Generate AI shots" on the step before.
        <div className="audit-start">
          <span className="audit-start-glyph" aria-hidden="true"><ShieldCheck size={26} /></span>
          <p className="audit-start-title">Check your post before it goes live</p>
          <p className="audit-start-sub">
            Add a caption and media, then run the six-step audit.
            {!recommendations && ' Generate captions first — the audit checks the image against their visual guidance.'}
          </p>
          <button
            type="button"
            className="btn-cta audit-start-btn"
            disabled={!ready || cooling}
            onClick={() => onAuditChange({ status: 'running', step: 0, result: null })}
          >
            <ShieldCheck size={18} aria-hidden="true" /> Run Compliance Audit{wait}
          </button>
          {cooling && (
            <p className="audit-start-sub" aria-live="polite">
              Audits are spaced out so the AI model’s rate limit isn’t hit.
            </p>
          )}
        </div>
      )}

      {audit.status === 'running' && (
        <div className="audit-run" aria-live="polite">
          <div className="audit-run-head">
            <span className="audit-run-glyph" aria-hidden="true"><ShieldCheck size={22} /></span>
            <div className="audit-run-text">
              <p className="audit-run-title">Running compliance audit</p>
              <p className="audit-run-sub">
                {!waiting
                  ? 'Checking your caption and media against your guidelines…'
                  : waitedSeconds >= STILL_WORKING_AFTER_S
                    ? 'Still working — the AI model can be slow when it’s busy.'
                    : 'Waiting for the AI model — this usually takes 10–20 seconds.'}
              </p>
            </div>
            <span className="audit-run-count" aria-hidden="true">{stepsDone} of {STEPS.length}</span>
          </div>
          <div
            className="audit-run-bar"
            role="progressbar"
            aria-label="Audit progress"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepsDone}
            data-waiting={waiting}
            style={{ '--audit-pct': `${Math.round((stepsDone / STEPS.length) * 100)}%` } as CSSProperties}
          >
            <i />
          </div>
          <div className="audit-steps">
            {STEPS.map((step, index) => {
              // The last step stays active, spinning, for as long as the model is working: the
              // timed ticks run out long before its answer arrives, and a row that has already
              // turned into a tick says "finished" while the audit is still going. The results
              // replace this whole block when they land.
              const state =
                waiting && index === STEPS.length - 1 ? 'active'
                : index < audit.step ? 'done'
                : index === audit.step ? 'active'
                : 'pending';
              return (
                <div key={step} className="audit-step" data-state={state}>
                  <span className="audit-step-no">
                    {state === 'done' ? <CheckCircle2 size={14} aria-hidden="true" />
                      : state === 'active' ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                      : index + 1}
                  </span>
                  <span className="audit-step-label">{step}</span>
                  {state === 'active' && waiting && <span className="audit-step-note">Working…</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {audit.status === 'error' && (
        <div>
          <ApiErrorPanel error={audit.error} label="Compliance audit" />
          <button
            type="button"
            className="btn-outline btn-outline--sm mt-4"
            disabled={cooling}
            onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}
          >
            <RefreshCw size={15} aria-hidden="true" />Re-run audit{wait}
          </button>
        </div>
      )}

      {result && (
        <div className="audit-result">
          {/* The verdict you take in at a glance — the dial and what it means —
              then the detail behind it, for when the verdict surprises you. */}
          <div className="audit-summary">
            <div className="audit-score">
              {/* The ring is driven by --omcs, so the figure is shown as well as
                  printed: how close the score sits to the pass threshold. */}
              <div
                className="omcs-dial"
                data-pass={passed}
                style={{ '--omcs': Math.round(result.omcsScore) } as CSSProperties}
              >
                <span className="omcs-dial-copy">
                  <b className="num">{Math.round(result.omcsScore)}</b>
                  <span>OMCS score</span>
                </span>
              </div>
              <p className="audit-verdict">
                <span className={`chip ${passed ? 'chip--success' : 'chip--critical'}`}>
                  {passed ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                  {result.status}
                </span>
              </p>
              <p className="text-meta">Pass threshold: 70</p>
            </div>

            <div className="audit-explain" data-pass={passed}>
              <span className="audit-explain-icon" aria-hidden="true">
                {passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              </span>
              <div>
                <p className="audit-explain-title">
                  {passed ? 'Your post meets the guidelines.' : 'Your post needs changes before it can publish.'}
                </p>
                <p className="audit-explain-text">{result.consistencyExplanation}</p>
              </div>
            </div>
          </div>

          <div className="omcs-rubric">
            {Object.entries(result.rubricEvaluationData.scores).map(([key, value]) => {
              // A whole-number percentage, whatever precision the service sent.
              const pct = Math.max(0, Math.min(100, Math.round(value)));
              return (
                <div key={key}>
                  <div className="omcs-rubric-head">
                    <span>{OMCS_RUBRIC_LABELS[key]}</span>
                    <span className="num">{pct}%</span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
