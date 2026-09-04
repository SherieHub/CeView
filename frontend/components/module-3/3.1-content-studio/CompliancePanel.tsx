import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
// OMCS_RUBRIC_LABELS is a static display map (rubric key -> human label), not
// data the backend serves — kept as a direct fixture import deliberately.
import { OMCS_RUBRIC_LABELS } from '../../../services/fixtures/omcs';
import PanelHead from './PanelHead';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { ComplianceSlotProps } from './contentStudioTypes';

const STEPS = ['Read caption and platform constraints', 'Analyse publication media', 'Match business profile signals', 'Score visual direction consistency', 'Evaluate audience and cultural fit', 'Create compliance recommendation'];

export default function CompliancePanel({ draft, audit, onAuditChange }: ComplianceSlotProps) {
  // Caption + media only. The audit scores caption-to-media consistency; it has
  // no opinion on which platforms the post is bound for, and authorisation is
  // about publishing rather than about running a check. Both of those moved to
  // the publish modal — requiring them here deadlocked the screen, because the
  // modal is only reachable through the audit this gate blocks.
  const ready = Boolean(draft.caption.trim() && draft.mediaDataUrl);
  useEffect(() => {
    if (audit.status !== 'running') return;
    if (audit.step >= STEPS.length) {
      apiClient.compliance
        .omcsAnalyze({ caption: draft.caption, imageUrl: draft.mediaDataUrl ?? '' })
        .then((result) => onAuditChange({ status: 'complete', step: STEPS.length, result }))
        .catch((e) => onAuditChange({ status: 'error', step: 0, result: null, error: e }));
      return;
    }
    const timer = window.setTimeout(() => onAuditChange({ ...audit, step: audit.step + 1 }), 420);
    return () => window.clearTimeout(timer);
  }, [audit, onAuditChange, draft.caption, draft.mediaDataUrl]);

  const result = audit.result;
  const passed = result?.status === 'Pass';

  return (
    <section className="card" aria-labelledby="compliance-title">
      <div className="studio-head">
        <span className="conn-ico" aria-hidden="true"><ShieldCheck /></span>
        <div className="studio-head-text">
          <h2 id="compliance-title" className="heading-md">Compliance audit</h2>
          <p className="body-sm">Checks the caption and selected media before publishing.</p>
        </div>
      </div>

      {audit.status === 'idle' && (
        <>
          <p className="studio-note">
            Add a caption, media, and a publish destination, then confirm authorisation to begin the six-step audit.
          </p>
          {/* Right-aligned and sized down to match the caption grid's Select:
              both are the forward action of their block, so they should look
              like the same kind of commitment. */}
          <div className="audit-foot mt-4">
            <button
              type="button"
              className="btn-cta btn-cta--sm"
              disabled={!ready}
              onClick={() => onAuditChange({ status: 'running', step: 0, result: null })}
            >
              <ShieldCheck size={15} aria-hidden="true" /> Run Compliance Audit
            </button>
          </div>
        </>
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
          {/* Score on the left, the detail it summarises on the right. The two
              read at different distances: the dial is the verdict you take in
              at a glance, the bars are what you study if the verdict surprises
              you — so stacking them made the page long for no gain. */}
          <div className="audit-score">
            {/* The dial's ring is driven by --omcs, so the figure is shown as
                well as printed — the flat 8px border it replaced said nothing
                about how close the score was to the pass threshold. */}
            <div
              className="omcs-dial"
              data-pass={passed}
              style={{ '--omcs': Math.round(result.omcsScore) } as CSSProperties}
            >
              <b className="num">{Math.round(result.omcsScore)}</b>
            </div>
            <div className="min-w-0">
              <p className="audit-verdict">
                <span>OMCS score</span>
                <span className={`chip ${passed ? 'chip--success' : 'chip--critical'}`}>
                  <CheckCircle2 aria-hidden="true" />{result.status}
                </span>
              </p>
              <p className="text-meta">Pass threshold: 70</p>
            </div>
          </div>

          {/* Its own query container: the rubric splits into two sub-columns on
              the width of THIS box, not of the card, which is now roughly a
              third wider than the space the bars actually get. */}
          <div className="audit-metrics">
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

            <p className="body-xs">{result.consistencyExplanation}</p>

            <div className="audit-foot">
              <button
                type="button"
                className="btn-outline btn-outline--sm"
                onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}
              >
                <RefreshCw size={15} aria-hidden="true" />Re-run audit
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
