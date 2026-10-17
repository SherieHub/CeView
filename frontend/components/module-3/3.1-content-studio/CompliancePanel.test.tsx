import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CompliancePanel from './CompliancePanel';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import type { PublishDraftState } from './contentStudioTypes';

vi.mock('../../../services/apiClient', () => ({
  apiClient: { compliance: { omcsAnalyze: vi.fn(() => Promise.resolve({})) } },
}));

const RECS = { visual_guide: ['Use warm light'] };

const READY: PublishDraftState = {
  caption: 'A caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

describe('CompliancePanel', () => {
  it('ignores an in-flight audit after the owner edits the content', async () => {
    const { apiClient } = await import('../../../services/apiClient');
    let resolve!: (value: typeof MOCK_OMCS) => void;
    vi.mocked(apiClient.compliance.omcsAnalyze).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const onAuditChange = vi.fn();
    const { rerender } = render(<CompliancePanel draft={READY} audit={{ status: 'running', step: 6, result: null }} onAuditChange={onAuditChange} recommendations={RECS} />);
    rerender(<CompliancePanel draft={{ ...READY, caption: 'New caption' }} audit={{ status: 'idle', step: 0, result: null }} onAuditChange={onAuditChange} recommendations={RECS} />);
    await act(async () => resolve(MOCK_OMCS));
    expect(onAuditChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeEnabled();
  });
  it('does NOT start the audit on its own when the draft becomes ready', () => {
    const onAuditChange = vi.fn();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={onAuditChange}
        recommendations={RECS}
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
        recommendations={RECS}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/ }));
    expect(onAuditChange).toHaveBeenCalledWith({ status: 'running', step: 0, result: null });
  });

  // Before the audit runs, the card is one centred action — the same shape as
  // the Visual guide's "Generate AI shots" on the step before.
  it('centres one Run Compliance Audit action in the idle card', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
      />,
    );
    const run = screen.getByRole('button', { name: /Run Compliance Audit/ });
    expect(run.closest('.audit-start')).not.toBeNull();
    expect(run.classList.contains('btn-cta')).toBe(true);
    expect(container.querySelectorAll('.audit-start button')).toHaveLength(1);
    expect(screen.getByText('Check your post before it goes live')).toBeInTheDocument();
  });

  it('disables the button until the draft is complete', () => {
    render(
      <CompliancePanel
        draft={{ ...READY, mediaDataUrl: null }}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
      />,
    );
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeDisabled();
  });

  it('disables the button and says why when no captions have been generated', () => {
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
        recommendations={null}
      />,
    );
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeDisabled();
    expect(screen.getByText(/Generate captions first/)).toBeInTheDocument();
  });

  it('sends the recommendations with the caption and image', async () => {
    const { apiClient } = await import('../../../services/apiClient');
    const analyze = vi.mocked(apiClient.compliance.omcsAnalyze);
    analyze.mockClear();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'running', step: 6, result: null }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
      />,
    );
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(analyze).toHaveBeenCalledWith({
      caption: 'A caption', imageUrl: 'data:image/png;base64,x', recommendations: RECS,
    });
  });

  // The verdict first — the dial beside what it means — then the bars behind
  // it, for when the verdict surprises you. Re-run sits in the card header.
  it('leads with the score and its meaning, then the rubric, with Re-run in the header', async () => {
    const onAuditChange = vi.fn();
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: MOCK_OMCS }}
        onAuditChange={onAuditChange}
        recommendations={RECS}
      />,
    );

    const summary = container.querySelector('.audit-result > .audit-summary') as HTMLElement;
    expect(summary).not.toBeNull();
    const score = summary.querySelector('.audit-score') as HTMLElement;
    expect(score.querySelector('.omcs-dial b')?.textContent).toBe('84');
    expect(within(score).getByText('OMCS score')).toBeInTheDocument();
    expect((score.querySelector('.omcs-dial') as HTMLElement).style.getPropertyValue('--omcs')).toBe('84');
    expect(score.querySelector('.audit-verdict .chip--success')).not.toBeNull();

    // What the score means, in the audit's own words.
    expect(within(summary).getByText('Your post meets the guidelines.')).toBeInTheDocument();
    expect(within(summary).getByText(MOCK_OMCS.consistencyExplanation)).toBeInTheDocument();

    // The rubric follows the summary rather than sitting inside it.
    expect(summary.querySelector('.omcs-rubric')).toBeNull();
    expect(container.querySelector('.audit-result > .omcs-rubric')).not.toBeNull();

    const rerun = within(container.querySelector('.studio-head') as HTMLElement).getByRole('button', { name: /Re-run audit/ });
    await userEvent.click(rerun);
    expect(onAuditChange).toHaveBeenCalledWith({ status: 'idle', step: 0, result: null });
  });

  it('says the post needs changes when it fails', () => {
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: { ...MOCK_OMCS, status: 'Fail', omcsScore: 52 } }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
      />,
    );
    expect(screen.getByText('Your post needs changes before it can publish.')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  // The insight block was removed; its text must not reappear anywhere.
  it('shows no insight callout', () => {
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result: MOCK_OMCS }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
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
        recommendations={RECS}
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
