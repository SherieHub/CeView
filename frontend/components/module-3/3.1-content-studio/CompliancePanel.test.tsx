import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CompliancePanel from './CompliancePanel';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import type { PublishDraftState } from './contentStudioTypes';

vi.mock('../../../services/apiClient', () => ({
  apiClient: { compliance: { omcsAnalyze: vi.fn(() => Promise.resolve({})) } },
}));

const READY: PublishDraftState = {
  caption: 'A caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

describe('CompliancePanel', () => {
  it('does NOT start the audit on its own when the draft becomes ready', () => {
    const onAuditChange = vi.fn();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={onAuditChange}
      />,
    );
    expect(onAuditChange).not.toHaveBeenCalled();
  });

  it('starts the audit only when the button is pressed', async () => {
    const onAuditChange = vi.fn();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={onAuditChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/ }));
    expect(onAuditChange).toHaveBeenCalledWith({ status: 'running', step: 0, result: null });
  });

  // The trigger is the forward action of this block, the same as Select is in
  // the caption grid, so it carries the same button object rather than a
  // page-level .btn-primary — and sits at the same end of its row.
  it('styles the audit trigger like the caption grid Select', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
      />,
    );
    const run = screen.getByRole('button', { name: /Run Compliance Audit/ });
    expect(run.classList.contains('btn-cta')).toBe(true);
    expect(run.classList.contains('btn-cta--sm')).toBe(true);
    expect(run.classList.contains('btn-primary')).toBe(false);
    // Right-aligned by the same .audit-foot the Re-run control uses.
    expect(run.closest('.audit-foot')).not.toBeNull();
    expect(container.querySelectorAll('.audit-foot')).toHaveLength(1);
  });

  it('disables the button until the draft is complete', () => {
    render(
      <CompliancePanel
        draft={{ ...READY, mediaDataUrl: null }}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeDisabled();
  });

  // Verdict on the left, the detail it summarises on the right — the dial is
  // read at a glance, the bars only if the verdict surprises you.
  it('splits the result into a score column and a metrics column', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: MOCK_OMCS }}
        onAuditChange={vi.fn()}
      />,
    );

    const result = container.querySelector('.audit-result') as HTMLElement;
    const score = result.querySelector(':scope > .audit-score') as HTMLElement;
    const metrics = result.querySelector(':scope > .audit-metrics') as HTMLElement;
    expect(score).not.toBeNull();
    expect(metrics).not.toBeNull();

    // Score column: the dial and its verdict, nothing else.
    expect(score.querySelector('.omcs-dial b')?.textContent).toBe('84');
    expect((score.querySelector('.omcs-dial') as HTMLElement).style.getPropertyValue('--omcs')).toBe('84');
    expect(score.querySelector('.audit-verdict .chip--success')).not.toBeNull();
    expect(score.querySelector('.omcs-rubric')).toBeNull();

    // Metrics column: the bars, the explanation, and the Re-run control.
    expect(metrics.querySelector('.omcs-rubric')).not.toBeNull();
    expect(metrics.querySelector('.audit-foot')).not.toBeNull();
    expect(within(metrics).getByRole('button', { name: /Re-run audit/ })).toBeTruthy();
  });

  // The insight block was removed; its text must not reappear anywhere.
  it('shows no insight callout', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: MOCK_OMCS }}
        onAuditChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('.audit-insight')).toHaveLength(0);
    expect(container.querySelectorAll('.studio-note')).toHaveLength(0);
    expect(screen.queryByText(/^Insight:/)).toBeNull();
    expect(container.textContent).not.toContain(MOCK_OMCS.feedback);
  });

  it('lists every rubric metric with a bar in the grid', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: MOCK_OMCS }}
        onAuditChange={vi.fn()}
      />,
    );
    const metrics = container.querySelectorAll('.omcs-rubric > div');
    expect(metrics).toHaveLength(Object.keys(MOCK_OMCS.rubricEvaluationData.scores).length);
    expect(container.querySelectorAll('.omcs-rubric .bar')).toHaveLength(metrics.length);
    // Each bar's fill is the metric's own value, not a shared constant.
    const first = container.querySelector('.omcs-rubric .bar > i') as HTMLElement;
    expect(first.style.width).toBe('88%');
  });
});
