import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useId } from 'react';
import type { CSSProperties } from 'react';
// OMCS_RUBRIC_LABELS is a static display map (rubric key -> human label), not
// data the backend serves — kept as a direct fixture import deliberately.
import { OMCS_RUBRIC_LABELS } from '../../../services/fixtures/omcs';
import PanelHead from './PanelHead';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { ComplianceSlotProps } from './contentStudioTypes';

const STEPS = ['Read caption and platform constraints', 'Analyse publication media', 'Match business profile signals', 'Score visual direction consistency', 'Evaluate audience and cultural fit', 'Create compliance recommendation'];

export default function CompliancePanel({ draft, audit, onAuditChange, recommendations }: ComplianceSlotProps) {
  // Caption + media only. The audit scores caption-to-media consistency; it has
  // no opinion on which platforms the post is bound for, and authorisation is
  // about publishing rather than about running a check. Both of those moved to
  // the publish modal — requiring them here deadlocked the screen, because the
  // modal is only reachable through the audit this gate blocks. The image is also
  // judged against the generated captions' visual guidance, so that must exist too.
  const ready = Boolean(draft.caption.trim() && draft.mediaDataUrl && recommendations);
  useEffect(() => {
    if (audit.status !== 'running') return;
    if (audit.step >= STEPS.length) {
      let cancelled = false;
      apiClient.compliance
        .omcsAnalyze({ caption: draft.caption, imageUrl: draft.mediaDataUrl ?? '', recommendations: recommendations ?? {} })
        .then((result) => { if (!cancelled) onAuditChange({ status: 'complete', step: STEPS.length, result }); })
        .catch((e) => { if (!cancelled) onAuditChange({ status: 'error', step: 0, result: null, error: e }); });
      return () => { cancelled = true; };
    }
    const timer = window.setTimeout(() => onAuditChange({ ...audit, step: audit.step + 1 }), 420);
    return () => window.clearTimeout(timer);
  }, [audit, onAuditChange, draft.caption, draft.mediaDataUrl, recommendations]);

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
            onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}
          >
            <RefreshCw size={15} aria-hidden="true" />Re-run audit
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
            disabled={!ready}
            onClick={() => onAuditChange({ status: 'running', step: 0, result: null })}
          >
            <ShieldCheck size={18} aria-hidden="true" /> Run Compliance Audit
          </button>
        </div>
      )}

      {audit.status === 'running' && (
        <div className="audit-steps" aria-live="polite">
          {STEPS.map((step, index) => {
            const state = index < audit.step ? 'done' : index === audit.step ? 'active' : 'pending';
            return (
              <div key={step} className="audit-step" data-state={state}>
                <span className="audit-step-no">
                  {state === 'done' ? <CheckCircle2 size={14} aria-hidden="true" />
                    : state === 'active' ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                    : index + 1}
                </span>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      )}

      {audit.status === 'error' && (
        <div>
          <ApiErrorPanel error={audit.error} label="Compliance audit" />
          <button
            type="button"
            className="btn-outline btn-outline--sm mt-4"
            onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}
          >
            <RefreshCw size={15} aria-hidden="true" />Re-run audit
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
            {Object.entries(result.rubricEvaluationData.scores).map(([key, value]) => (
              <div key={key}>
                <div className="omcs-rubric-head">
                  <span>{OMCS_RUBRIC_LABELS[key]}</span>
                  <span className="num">{value}/100</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
