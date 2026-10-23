import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CompliancePanel from './CompliancePanel';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import { ApiError } from '../../../services/apiError';
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

  it('shows rubric values as whole percentages whatever precision arrives', () => {
    const result = {
      ...MOCK_OMCS,
      rubricEvaluationData: { scores: { visual_business_context_match: 84.6, platform_suitability: 130 }, total: 85 },
    };
    const { container } = render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'complete', step: 6, result }}
        onAuditChange={vi.fn()}
        recommendations={RECS}
      />,
    );
    const rows = container.querySelectorAll('.omcs-rubric > div');
    expect(rows[0].querySelector('.num')?.textContent).toBe('85%');
    expect((rows[0].querySelector('.bar > i') as HTMLElement).style.width).toBe('85%');
    expect(rows[1].querySelector('.num')?.textContent).toBe('100%');
  });
});

describe('CompliancePanel — spacing audits out', () => {
  const IDLE = { status: 'idle' as const, step: 0, result: null };
  const COMPLETE = { status: 'complete' as const, step: 6, result: MOCK_OMCS };

  /** Runs one audit to the point the panel has been told it finished, and returns the re-renderer. */
  async function finishOneAudit(outcome: () => Promise<unknown>) {
    const { apiClient } = await import('../../../services/apiClient');
    vi.mocked(apiClient.compliance.omcsAnalyze).mockImplementationOnce(outcome as never);
    const onAuditChange = vi.fn();
    const view = render(
      <CompliancePanel draft={READY} audit={{ status: 'running', step: 6, result: null }} onAuditChange={onAuditChange} recommendations={RECS} />,
    );
    await waitFor(() => expect(onAuditChange).toHaveBeenCalled());
    const show = (audit: Parameters<typeof CompliancePanel>[0]['audit']) =>
      view.rerender(<CompliancePanel draft={READY} audit={audit} onAuditChange={onAuditChange} recommendations={RECS} />);
    return { show, onAuditChange };
  }

  it('makes Re-run wait, with a countdown, after a completed audit', async () => {
    const { show } = await finishOneAudit(() => Promise.resolve(MOCK_OMCS));
    show(COMPLETE);

    const rerun = screen.getByRole('button', { name: /Re-run audit \(\d+s\)/ });
    expect(rerun).toBeDisabled();
  });

  it('cannot be skipped by editing the caption, which resets the audit to idle', async () => {
    const { show } = await finishOneAudit(() => Promise.resolve(MOCK_OMCS));
    show(IDLE);

    expect(screen.getByRole('button', { name: /Run Compliance Audit \(\d+s\)/ })).toBeDisabled();
    expect(screen.getByText(/spaced out/i)).toBeInTheDocument();
  });

  it('is available again once the wait is over', async () => {
    const { show } = await finishOneAudit(() => Promise.resolve(MOCK_OMCS));
    show(IDLE);
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeDisabled();

    // A minute passes; the panel's own one-second tick notices and lifts the wait.
    const later = Date.now() + 61_000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Run Compliance Audit' })).toBeEnabled(), { timeout: 3000 });
    } finally {
      clock.mockRestore();
    }
  });

  it('asks for a shorter wait after a rate-limit refusal', async () => {
    const limited = new ApiError({
      status: 503, method: 'POST', path: '/api/compliance/omcs-analyze',
      body: { code: 'MOD33_RATE_LIMITED', dependency: 'groq', cause: 'try again in about 20 seconds' },
    });
    const { show } = await finishOneAudit(() => Promise.reject(limited));
    show({ status: 'error', step: 0, result: null, error: limited });

    expect(screen.getByRole('button', { name: /Re-run audit \(\d+s\)/ })).toBeDisabled();
  });

  it('lets any other failure be retried at once', async () => {
    const offline = new ApiError({ status: 502, method: 'POST', path: '/api/compliance/omcs-analyze', body: {} });
    const { show } = await finishOneAudit(() => Promise.reject(offline));
    show({ status: 'error', step: 0, result: null, error: offline });

    expect(screen.getByRole('button', { name: 'Re-run audit' })).toBeEnabled();
  });
});

describe('CompliancePanel — while the audit runs', () => {
  const states = (container: HTMLElement) =>
    [...container.querySelectorAll('.audit-step')].map((el) => el.getAttribute('data-state'));

  it('walks the steps in order, one active at a time', () => {
    const { container } = render(
      <CompliancePanel draft={READY} audit={{ status: 'running', step: 2, result: null }} onAuditChange={vi.fn()} recommendations={RECS} />,
    );
    expect(states(container)).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending']);
    expect(screen.getByRole('progressbar', { name: 'Audit progress' })).toHaveAttribute('aria-valuenow', '2');
    expect(container.querySelector('.audit-run-bar')).toHaveAttribute('data-waiting', 'false');
  });

  it('keeps the last step active and spinning while the model is still working', async () => {
    const { apiClient } = await import('../../../services/apiClient');
    vi.mocked(apiClient.compliance.omcsAnalyze).mockImplementationOnce(() => new Promise(() => {}));
    const { container } = render(
      <CompliancePanel draft={READY} audit={{ status: 'running', step: 6, result: null }} onAuditChange={vi.fn()} recommendations={RECS} />,
    );

    // Every timed step has run, but the answer has not arrived: the last one must not look finished.
    expect(states(container)).toEqual(['done', 'done', 'done', 'done', 'done', 'active']);
    const last = container.querySelectorAll('.audit-step')[5];
    expect(last.querySelector('.animate-spin')).not.toBeNull();
    expect(last).toHaveTextContent('Working…');
    expect(screen.getByRole('progressbar', { name: 'Audit progress' })).toHaveAttribute('aria-valuenow', '5');
    expect(container.querySelector('.audit-run-bar')).toHaveAttribute('data-waiting', 'true');
    expect(screen.getByText(/Waiting for the AI model/)).toBeInTheDocument();
  });

  it('is replaced by the results when they arrive', () => {
    const view = render(
      <CompliancePanel draft={READY} audit={{ status: 'running', step: 6, result: null }} onAuditChange={vi.fn()} recommendations={RECS} />,
    );
    expect(view.container.querySelector('.audit-run')).not.toBeNull();

    view.rerender(
      <CompliancePanel draft={READY} audit={{ status: 'complete', step: 6, result: MOCK_OMCS }} onAuditChange={vi.fn()} recommendations={RECS} />,
    );
    expect(view.container.querySelector('.audit-run')).toBeNull();
    expect(view.container.querySelector('.omcs-dial')).not.toBeNull();
  });
});
