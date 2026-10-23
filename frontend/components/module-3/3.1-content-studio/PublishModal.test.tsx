import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublishModal, { PREVIEW_FIT_MARGIN } from './PublishModal';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import type { AdConnection, AdInterestOption, AdMinimumBudget, AdSpendLimits, AttributionLink, PublishAd } from '../../../types';

// The paid-ad panel reads the ad account, spending limits, Meta's minimum budget and interest search.
// Defaults describe a business that is fully set up; the paid-ad cases change one thing at a time.
const adListMock = vi.fn();
const limitsGetMock = vi.fn();
const minimumMock = vi.fn();
const interestsMock = vi.fn();
const linksListMock = vi.fn();
vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => adListMock(),
      limits: { get: () => limitsGetMock() },
      minimumBudget: (...args: unknown[]) => minimumMock(...args),
      searchInterests: (...args: unknown[]) => interestsMock(...args),
    },
    attributionLinks: { list: () => linksListMock() },
  },
}));

const META: AdConnection = {
  provider: 'meta', configured: true, status: 'ACTIVE', accountName: 'Cebu Dive Ads', currency: 'PHP',
  campaignId: null, campaignName: null, connectedAt: null, lastSyncedAt: null,
};
const LIMITS: AdSpendLimits = { configured: true, currency: 'PHP', maxDailyMinor: 50_000, maxTotalMinor: 1_000_000, committedMinor: 0 };
const MINIMUM: AdMinimumBudget = { currency: 'PHP', minDailyMinor: 6332 };
const LINK = { linkId: 'link-1', targetMarket: 'korea', category: 'Diving', windowStart: '2026-11-01T00:00:00Z' } as AttributionLink;
const SCUBA: AdInterestOption = { id: '6003020834693', name: 'Scuba diving', path: 'Interests › Sports' };
const SNORKEL: AdInterestOption = { id: '6003139266461', name: 'Snorkeling', path: 'Interests › Sports' };
const PAID_AD: PublishAd = {
  objective: 'OUTCOME_TRAFFIC', dailyBudgetMinor: 10_000, startTime: new Date(Date.now() + 2 * 3_600_000).toISOString(), durationDays: 14,
  interests: [], advantageAudience: false, attributionLinkId: 'link-1', pinCampaign: false,
};

const DRAFT: PublishDraftState = {
  caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};

// Defaults every platform to connected, so the existing cases below — none of
// which are about connection state — see the same unconstrained picker they
// always have. The connection-gating cases set this per test.
let mockIsConnected = (_platform: StudioPlatformId) => true;

vi.mock('../../../services/connectionsStore', () => ({
  useConnections: () => ({
    connections: [], isConnected: (platform: StudioPlatformId) => mockIsConnected(platform),
    connect: vi.fn(), disconnect: vi.fn(), onDisconnect: () => () => {},
  }),
}));

beforeEach(() => {
  mockIsConnected = () => true;
  adListMock.mockReset().mockResolvedValue([META]);
  limitsGetMock.mockReset().mockResolvedValue(LIMITS);
  minimumMock.mockReset().mockResolvedValue(MINIMUM);
  interestsMock.mockReset().mockResolvedValue([]);
  linksListMock.mockReset().mockResolvedValue([LINK]);
});

function setup(
  over: Partial<PublishDraftState> = {}, onConfirm = vi.fn(), onDraftChange = vi.fn(),
  extra: { market?: string; windowOpenDate?: string | null; interestSeeds?: string[] } = {},
) {
  // Spreads the render result so cases can reach `container` as well as the
  // spies — the DOM assertions below query by class, which screen cannot do.
  const view = render(
    <OverlayStackProvider>
      <PublishModal
        open
        draft={{ ...DRAFT, ...over }}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        {...extra}
      />
    </OverlayStackProvider>,
  );
  return { ...view, onConfirm, onDraftChange };
}

/** Keeps the draft in state, so a change made in the panel shows up in it (the real parent does this). */
function Harness({ ad, market = 'korea', seeds = [] }: { ad: PublishAd; market?: string; seeds?: string[] }) {
  const [draft, setDraft] = useState<PublishDraftState>({ ...DRAFT, agreementChecked: true, paidPartnership: true, ad });
  return (
    <OverlayStackProvider>
      <PublishModal
        open draft={draft} onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onClose={vi.fn()} onConfirm={vi.fn()} market={market} interestSeeds={seeds}
      />
      <output data-testid="ad">{JSON.stringify(draft.ad)}</output>
    </OverlayStackProvider>
  );
}
const savedAd = (): PublishAd => JSON.parse(screen.getByTestId('ad').textContent ?? '{}');

describe('PublishModal', () => {
  // Three steps, left to right: the options, their consequence, the sign-off.
  it('reads as options, preview, then review and confirm', () => {
    setup();
    const options = screen.getByRole('region', { name: 'Publishing options' });
    const preview = screen.getByRole('region', { name: 'Preview' });
    const review = screen.getByRole('region', { name: 'Review and confirm' });

    // Where and how it goes out...
    expect(within(options).getByRole('checkbox', { name: /Instagram/ })).toBeTruthy();
    expect(within(options).getByRole('radiogroup', { name: 'Visibility' })).toBeTruthy();
    expect(within(options).getByRole('checkbox', { name: /Run as Paid Ad/ })).toBeTruthy();

    // ...only the result of it in the preview...
    expect(preview.querySelector('.device-frame')).not.toBeNull();
    expect(within(preview).queryByRole('checkbox')).toBeNull();

    // ...then the final copy and the plan...
    expect(within(review).getByLabelText(/Final caption/)).toBeTruthy();
    expect(within(review).getByText('What will be published')).toBeTruthy();

    // ...and the authorisation closes the options column.
    expect(within(options).getByRole('checkbox', { name: /authorised to publish/ })).toBeTruthy();
  });

  it('says what is still missing while Confirm is disabled', () => {
    setup({ platforms: [] });
    expect(screen.getByText('Choose where to publish.')).toBeTruthy();
  });

  it('points to the confirmation once a platform is chosen', () => {
    setup({ platforms: ['instagram'], agreementChecked: false });
    expect(screen.getByText('Tick the confirmation under Publishing Options.')).toBeTruthy();
  });

  it('summarises what will be published where', () => {
    mockIsConnected = (p) => p !== 'tiktok';
    const { container } = setup({ platforms: ['instagram'], visibility: 'private', paidPartnership: true });
    const rows = [...(container.querySelector('.pubx-plan') as HTMLElement).querySelectorAll('li')];
    const row = (name: string) => rows.find((r) => r.textContent?.includes(name)) as HTMLElement;
    expect(row('Instagram')).toHaveTextContent('Private');
    expect(row('TikTok')).toHaveTextContent('Not connected');
    expect(row('Facebook')).toHaveTextContent('Not selected');
    const facts = container.querySelector('.pubx-facts') as HTMLElement;
    expect(facts).toHaveTextContent('Paid ad');
    expect(facts).toHaveTextContent('Yes');
  });

  it('steps the preview through each chosen platform', async () => {
    const { container } = setup({ platforms: ['instagram', 'facebook'] });
    const aspect = () => (container.querySelector('.device-media') as HTMLElement).style.aspectRatio;
    expect(aspect()).toBe('4 / 5');
    expect(screen.getByText('Instagram preview')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Next platform preview' }));
    expect(aspect()).toBe('1 / 1');
    expect(screen.getByText('Facebook preview')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show Instagram preview' }));
    expect(aspect()).toBe('4 / 5');
  });

  // A disconnected platform cannot be added to "Publish to" without first
  // connecting it (Settings -> Platforms). Destination choice moved into this
  // modal from the composer, and the connection gate had to move with it.
  it('disables a platform not yet connected, and leaves a connected one selectable', () => {
    mockIsConnected = (platform) => platform === 'instagram';
    setup();

    const tiktok = screen.getByRole('checkbox', { name: /TikTok/ });
    expect(tiktok).toBeDisabled();
    const instagram = screen.getByRole('checkbox', { name: /Instagram/ });
    expect(instagram).toBeEnabled();
  });

  it('does not toggle a disabled platform on click', async () => {
    mockIsConnected = (platform) => platform === 'instagram';
    const { onDraftChange } = setup();

    await userEvent.click(screen.getByRole('checkbox', { name: /TikTok/ }));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  // The platform pills used to sit above the phone, which put the control that
  // changes the preview in the same place as the preview it changed. Selection
  // drives it from the left column now.
  it('previews the selected destination rather than carrying its own tabs', () => {
    const { container } = setup({ platforms: ['tiktok'] });

    expect(screen.queryByRole('tab', { name: 'TikTok Feed' })).toBeNull();
    // TikTok's 9/16 crop, taken from the destination.
    expect((container.querySelector('.device-media') as HTMLElement).style.aspectRatio).toBe('9 / 16');
  });

  it('falls back to Instagram before a destination is chosen', () => {
    const { container } = setup({ platforms: [] });
    expect((container.querySelector('.device-media') as HTMLElement).style.aspectRatio).toBe('4 / 5');
  });

  it('swaps the device frame from the size toggle', async () => {
    const { container } = setup();
    const frame = () => container.querySelector('.device-frame') as HTMLElement;

    expect(frame().getAttribute('data-device')).toBe('mobile');
    expect(container.querySelector('.device-notch')).not.toBeNull();
    expect(container.querySelector('.device-titlebar')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    expect(frame().getAttribute('data-device')).toBe('desktop');
    // A browser gets traffic lights, not a notch — that swap IS the signal.
    expect(container.querySelector('.device-titlebar')).not.toBeNull();
    expect(container.querySelector('.device-notch')).toBeNull();
  });

  it('carries the distribution controls that the composer gave up', async () => {
    const { onDraftChange } = setup();

    await userEvent.click(screen.getByRole('radio', { name: 'private' }));
    expect(screen.getByRole('radio', { name: 'private' })).toBeDisabled();

    const paid = screen.getByRole('checkbox', { name: /Run as Paid Ad/ });
    await waitFor(() => expect(paid).toBeEnabled());
    await userEvent.click(paid);
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ paidPartnership: true, visibility: 'public', ad: expect.objectContaining({ objective: 'OUTCOME_TRAFFIC' }) }));
  });

  it('blocks confirm until the agreement is ticked', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks confirm when no platform is selected', () => {
    setup({ agreementChecked: true, platforms: [] });
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeDisabled();
  });

  it('confirms once authorised', async () => {
    const onConfirm = vi.fn();
    setup({ agreementChecked: true }, onConfirm);
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Publish/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  // The desktop frame is 1100px wide by design; rather than overflow into
  // scrollbars it is measured against the canvas and scaled to fit. jsdom has
  // no layout, so these drive the measurement directly.
  it('scales the frame down to fit the canvas', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    // A canvas half the frame's width and a third its height -> the tighter
    // axis wins, so the scale is 1/3.
    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 900 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 1200 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 450 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 400 });

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    // Derived from the constant, not hardcoded: the margin is a design value
    // that may move, and a literal here would just have to be chased.
    expect(canvas.style.getPropertyValue('--preview-scale'))
      .toBe(String((1 / 3) * PREVIEW_FIT_MARGIN));
  });

  it('never scales UP a frame that already fits', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 300 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 500 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 1200 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 900 });

    await userEvent.click(screen.getByRole('tab', { name: 'Tablet' }));

    // Capped at 1 before the margin, so a frame that already fits is never
    // blown up — it just keeps its breathing room.
    expect(canvas.style.getPropertyValue('--preview-scale')).toBe(String(PREVIEW_FIT_MARGIN));
  });

  // A canvas that has not been laid out yet reports 0. Dividing by it would
  // collapse the preview to nothing on first paint.
  it('leaves the scale at 1:1 when nothing has been measured', () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    expect(canvas.style.getPropertyValue('--preview-scale')).toBe('1');
  });

  // The reported bug: pressing the same device button repeatedly produced a
  // different zoom each time, because the frame's `width` was transitioning
  // when the fit measured it. Only the transform animates now, so a given
  // device must always settle on the same scale.
  it('settles on the same scale each time a device is re-selected', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 600 });

    // Stand in for layout: each device reports its own settled size.
    const sizes: Record<string, [number, number]> = {
      mobile: [324, 700],
      tablet: [484, 900],
      desktop: [1100, 1500],
    };
    Object.defineProperty(frame, 'offsetWidth', {
      configurable: true,
      get: () => sizes[frame.getAttribute('data-device') ?? 'mobile'][0],
    });
    Object.defineProperty(frame, 'offsetHeight', {
      configurable: true,
      get: () => sizes[frame.getAttribute('data-device') ?? 'mobile'][1],
    });

    const scaleAfter = async (label: string) => {
      await userEvent.click(screen.getByRole('tab', { name: label }));
      return canvas.style.getPropertyValue('--preview-scale');
    };

    const first = await scaleAfter('Desktop');
    await scaleAfter('Mobile');
    const second = await scaleAfter('Desktop');
    await scaleAfter('Tablet');
    const third = await scaleAfter('Desktop');

    expect(first).toBe(second);
    expect(second).toBe(third);
    // 600/1500 is the tighter axis, so Desktop lands on the same value every
    // time — 0.4, less the fit margin.
    expect(first).toBe(String(0.4 * PREVIEW_FIT_MARGIN));
  });

  // The desktop preview rendered blank because the canvas reported zero height
  // and the old fit bailed out entirely, leaving the frame at 1:1 and
  // overflowing. An axis that reports 0 must simply not constrain.
  it('still fits on width when the canvas has no measurable height', async () => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: 1000 });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: 1400 });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 0 });

    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    // Width still constrains: 500/1000, less the margin. Emphatically not 1.
    expect(canvas.style.getPropertyValue('--preview-scale'))
      .toBe(String(0.5 * PREVIEW_FIT_MARGIN));
  });

  // The property that actually matters, and the one three rounds of clipping
  // kept violating: whatever the canvas and frame measure, the SCALED frame
  // must land inside the canvas on both axes. Checked across shapes that have
  // each caused a visible cut — a tall desktop frame in a short canvas, a wide
  // frame in a narrow one, and a frame already smaller than the space.
  it.each([
    ['tall frame, short canvas', 1100, 1600, 1300, 500],
    ['wide frame, narrow canvas', 1100, 700, 420, 900],
    ['frame already fits', 300, 620, 900, 800],
    ['square-ish canvas', 460, 900, 600, 600],
  ])('keeps the scaled frame inside the canvas — %s', async (_name, fw, fh, cw, ch) => {
    const { container } = setup();
    const canvas = container.querySelector('.pub-canvas') as HTMLElement;
    const frame = container.querySelector('.device-frame') as HTMLElement;

    Object.defineProperty(frame, 'offsetWidth', { configurable: true, value: fw });
    Object.defineProperty(frame, 'offsetHeight', { configurable: true, value: fh });
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: cw });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: ch });

    // Any device switch re-runs the fit against the numbers above.
    await userEvent.click(screen.getByRole('tab', { name: 'Desktop' }));

    const k = Number(canvas.style.getPropertyValue('--preview-scale'));
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(1);
    expect(fw * k).toBeLessThanOrEqual(cw);
    expect(fh * k).toBeLessThanOrEqual(ch);
  });
});

describe('PublishModal — scheduling', () => {
  it('switches to scheduling with a suggested date and time', async () => {
    const { onDraftChange } = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Schedule/ }));
    const patch = onDraftChange.mock.calls.at(-1)?.[0];
    expect(patch.scheduledFor).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
  });

  it('schedules rather than publishes when a future time is set', () => {
    setup({ scheduledFor: '2099-03-14T10:30', agreementChecked: true });
    expect(screen.getByLabelText('Date')).toHaveValue('2099-03-14');
    expect(screen.getByLabelText('Time')).toHaveValue('10:30');
    expect(screen.getByRole('button', { name: /Confirm & Schedule/ })).toBeEnabled();
    expect((document.querySelector('.pubx-facts') as HTMLElement).textContent).toMatch(/Scheduled ·/);
  });

  it('refuses a time in the past', () => {
    setup({ scheduledFor: '2001-01-01T09:00', agreementChecked: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date and time in the future.');
    expect(screen.getByRole('button', { name: /Confirm & Schedule/ })).toBeDisabled();
  });

  it('goes back to publishing now', async () => {
    const { onDraftChange } = setup({ scheduledFor: '2099-03-14T10:30' });
    await userEvent.click(screen.getByRole('radio', { name: /Publish now/ }));
    expect(onDraftChange).toHaveBeenCalledWith({ scheduledFor: null });
  });
});


describe('publishing validation', () => {
  it('disables private visibility for Meta publishing', () => {
    setup({ platforms: ['facebook'] });
    expect(screen.getByRole('radio', { name: 'private' })).toBeDisabled();
  });
  it('blocks a paid ad without complete budget and attribution details', async () => {
    setup({ agreementChecked: true, paidPartnership: true, ad: { ...PAID_AD, dailyBudgetMinor: 0, attributionLinkId: '' } }, vi.fn(), vi.fn(), { market: 'korea' });
    expect(screen.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
    expect(await screen.findByText(/Enter a daily budget above zero/)).toBeInTheDocument();
    expect(screen.getByText(/Choose a campaign tracking link/)).toBeInTheDocument();
  });
  it('explains the TikTok video inbox handoff', () => {
    setup({ platforms: ['tiktok'], mediaType: 'video' });
    expect(screen.getByText(/Video drafts do not include the caption/)).toBeInTheDocument();
  });
});

describe('paid Meta ad: who may run one', () => {
  it('blocks the paid tick until the business has saved its spending limits, and points to Settings', async () => {
    limitsGetMock.mockResolvedValue({ ...LIMITS, configured: false, maxDailyMinor: null, maxTotalMinor: null });
    setup();
    expect(await screen.findByText(/set your ad spending limits/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Run as Paid Ad/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings/platforms');
  });

  it('blocks the paid tick without a connected Meta ad account', async () => {
    adListMock.mockResolvedValue([]);
    limitsGetMock.mockRejectedValue(new Error('409'));
    setup();
    expect(await screen.findByText(/connect a meta ad account in settings/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Run as Paid Ad/ })).toBeDisabled();
  });

  it('starts the ad at the surge window, for 14 days, with no interests and no widening', async () => {
    const { onDraftChange } = setup({}, vi.fn(), vi.fn(), { windowOpenDate: '2099-01-01T00:00:00Z', market: 'korea' });
    const paid = screen.getByRole('checkbox', { name: /Run as Paid Ad/ });
    await waitFor(() => expect(paid).toBeEnabled());
    await userEvent.click(paid);
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      paidPartnership: true,
      ad: expect.objectContaining({
        objective: 'OUTCOME_TRAFFIC', startTime: '2099-01-01T00:00:00.000Z', durationDays: 14,
        interests: [], advantageAudience: false, pinCampaign: false,
      }),
    }));
  });

  it('lets an already-ticked draft be unticked even if the limits have since gone', async () => {
    limitsGetMock.mockResolvedValue({ ...LIMITS, configured: false, maxDailyMinor: null, maxTotalMinor: null });
    setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'korea' });
    expect(screen.getByRole('checkbox', { name: /Run as Paid Ad/ })).toBeEnabled();
    expect(await screen.findByText(/set your ad spending limits/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
  });
});

describe('paid Meta ad: the fields', () => {
  it('shows the audience the forecast fixes, with no country box to type into', async () => {
    const { container } = setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'korea' });
    const panel = container.querySelector('.pubx-ad') as HTMLElement;
    const audience = within(panel).getByRole('group', { name: 'Audience' });
    expect(audience).toHaveTextContent('South Korea');
    expect(audience).toHaveTextContent('People using Facebook in Korean');
    expect(within(panel).queryByLabelText(/^Countries/)).toBeNull();
    expect(within(panel).queryByLabelText(/Ad ends/)).toBeNull();
    for (const name of [/^Objective/, /^Daily budget/, /^Ad starts/, /^Campaign tracking link/]) {
      expect(within(panel).getByLabelText(name)).toBeTruthy();
    }
    expect(within(panel).getByRole('checkbox', { name: /Performance reports/ })).toBeTruthy();
    expect(within(panel).getByRole('checkbox', { name: /Advantage\+ audience/ })).not.toBeChecked();
  });

  it('offers Traffic, Awareness and Engagement', () => {
    setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'korea' });
    const options = within(screen.getByLabelText(/^Objective/)).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Traffic', 'Awareness', 'Engagement']);
  });

  it('says the USA has no language limit and Japan is Japanese', () => {
    const { unmount } = setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'usa' });
    expect(screen.getByRole('group', { name: 'Audience' })).toHaveTextContent('No language limit');
    unmount();
    setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'japan' });
    expect(screen.getByRole('group', { name: 'Audience' })).toHaveTextContent('People using Facebook in Japanese');
  });

  it('shows Meta\'s minimum and the daily limit beside the budget once they are known', async () => {
    setup({ paidPartnership: true, ad: PAID_AD }, vi.fn(), vi.fn(), { market: 'korea' });
    expect(await screen.findByText(/Meta's minimum: more than .*63\.32/)).toBeInTheDocument();
    expect(screen.getByText(/Your daily limit: .*500\.00/)).toBeInTheDocument();
    expect(minimumMock).toHaveBeenCalledWith('OUTCOME_TRAFFIC');
  });

  it('asks Meta for the new minimum when the objective changes', async () => {
    render(<Harness ad={PAID_AD} />);
    await waitFor(() => expect(minimumMock).toHaveBeenCalledWith('OUTCOME_TRAFFIC'));
    await userEvent.selectOptions(screen.getByLabelText(/^Objective/), 'OUTCOME_AWARENESS');
    await waitFor(() => expect(minimumMock).toHaveBeenCalledWith('OUTCOME_AWARENESS'));
    expect(savedAd().objective).toBe('OUTCOME_AWARENESS');
  });
});

describe('paid Meta ad: constraints stop invalid input', () => {
  const alerts = () => screen.getByRole('alert');
  const confirm = () => screen.getByRole('button', { name: 'Confirm & Publish' });
  // The budget hint appears once Meta's minimum has loaded (the alert below it can quote it too).
  const settled = async () => { await screen.findByText(/Meta's minimum: more than/); };

  it('lets a valid ad through', async () => {
    render(<Harness ad={PAID_AD} />);
    await settled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(confirm()).toBeEnabled();
  });

  it('refuses a budget at or below Meta\'s minimum, the ₱10 that Meta rejected before', async () => {
    render(<Harness ad={{ ...PAID_AD, dailyBudgetMinor: 1000 }} />);
    await settled();
    expect(alerts()).toHaveTextContent(/more than .*63\.32/);
    expect(confirm()).toBeDisabled();
  });

  it('refuses a daily budget above the business\'s daily limit', async () => {
    render(<Harness ad={{ ...PAID_AD, dailyBudgetMinor: 50_001, durationDays: 1 }} />);
    await settled();
    expect(alerts()).toHaveTextContent(/daily limit of .*500\.00/);
    expect(confirm()).toBeDisabled();
  });

  it('refuses a total above what is left of the total limit, counting ads already running', async () => {
    limitsGetMock.mockResolvedValue({ ...LIMITS, committedMinor: 900_000 });
    render(<Harness ad={{ ...PAID_AD, dailyBudgetMinor: 10_000, durationDays: 14 }} />); // 140,000 > 100,000 left
    await settled();
    expect(alerts()).toHaveTextContent(/total limit/);
    expect(confirm()).toBeDisabled();
  });

  it('refuses a start that is not in the future', async () => {
    render(<Harness ad={{ ...PAID_AD, startTime: new Date(Date.now() - 60_000).toISOString() }} />);
    await settled();
    expect(alerts()).toHaveTextContent(/must start in the future/);
    expect(confirm()).toBeDisabled();
  });

  it('refuses a market CeView has no forecast for', async () => {
    render(<Harness ad={PAID_AD} market="philippines" />);
    await settled();
    expect(alerts()).toHaveTextContent(/forecast market/);
    expect(confirm()).toBeDisabled();
  });
});

describe('paid Meta ad: how long it runs', () => {
  const confirm = () => screen.getByRole('button', { name: 'Confirm & Publish' });

  it('picks 14, 30 or 90 days and shows the end date and the total', async () => {
    render(<Harness ad={PAID_AD} />);
    await screen.findByText(/Meta's minimum: more than/);
    expect(screen.getByRole('radio', { name: '14 days' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: '30 days' }));
    expect(savedAd().durationDays).toBe(30);
    expect(screen.getByText(/Ends .* about .*3,000\.00 in total/i)).toBeInTheDocument();
  });

  it('accepts any whole number of days from a custom box', async () => {
    render(<Harness ad={PAID_AD} />);
    await screen.findByText(/Meta's minimum: more than/);
    await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const days = screen.getByRole('spinbutton', { name: 'Number of days' });
    await userEvent.clear(days);
    await userEvent.type(days, '7');
    expect(savedAd().durationDays).toBe(7);
    expect(confirm()).toBeEnabled();
  });

  it('refuses an empty, zero or fractional number of days', async () => {
    render(<Harness ad={PAID_AD} />);
    await screen.findByText(/Meta's minimum: more than/);
    await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const days = screen.getByRole('spinbutton', { name: 'Number of days' });
    for (const bad of ['', '0', '2.5']) {
      await userEvent.clear(days);
      if (bad) await userEvent.type(days, bad);
      expect(screen.getByRole('alert')).toHaveTextContent(/number of days/i);
      expect(confirm()).toBeDisabled();
    }
  });

  it('starts on Custom when the saved draft has an unusual length', () => {
    render(<Harness ad={{ ...PAID_AD, durationDays: 45 }} />);
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Number of days' })).toHaveValue(45);
  });
});

describe('paid Meta ad: interests', () => {
  it('suggests interests drawn from the business, and adds one on a click', async () => {
    interestsMock.mockResolvedValue([SCUBA]);
    render(<Harness ad={PAID_AD} seeds={['Scuba Diving']} />);

    await userEvent.click(await screen.findByRole('button', { name: '+ Scuba diving' }));

    expect(savedAd().interests).toEqual([{ id: SCUBA.id, name: 'Scuba diving' }]);
    expect(within(screen.getByRole('list', { name: 'Chosen interests' })).getByText('Scuba diving')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Scuba diving' })).toBeNull();
  });

  it('removes a chosen interest', async () => {
    render(<Harness ad={{ ...PAID_AD, interests: [{ id: SCUBA.id, name: 'Scuba diving' }] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Scuba diving' }));
    expect(savedAd().interests).toEqual([]);
  });

  it('searches Meta\'s catalogue as the operator types, and adds a result', async () => {
    interestsMock.mockImplementation(async (q: string) => (q === 'snorkel' ? [SNORKEL] : []));
    render(<Harness ad={PAID_AD} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search Meta interests' }), 'snorkel');
    await userEvent.click(await screen.findByRole('button', { name: 'Add Snorkeling' }));

    expect(interestsMock).toHaveBeenCalledWith('snorkel');
    expect(savedAd().interests).toEqual([{ id: SNORKEL.id, name: 'Snorkeling' }]);
  });

  it('says when the search finds nothing and when it fails', async () => {
    render(<Harness ad={PAID_AD} />);
    const box = screen.getByRole('searchbox', { name: 'Search Meta interests' });
    await userEvent.type(box, 'zzzz');
    expect(await screen.findByText('No interests found.')).toBeInTheDocument();

    interestsMock.mockRejectedValue(new Error('502'));
    await userEvent.clear(box);
    await userEvent.type(box, 'diving');
    expect(await screen.findByText(/could not search meta interests/i)).toBeInTheDocument();
  });

  it('stops at ten interests', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ id: String(6000 + i), name: `Interest ${i}` }));
    render(<Harness ad={{ ...PAID_AD, interests: ten }} />);
    expect(screen.getByRole('searchbox', { name: 'Search Meta interests' })).toBeDisabled();
    expect(screen.getByText(/most Meta allows \(10\)/)).toBeInTheDocument();
  });

  it('lets Meta widen the audience only when the operator ticks Advantage+', async () => {
    render(<Harness ad={PAID_AD} />);
    const box = screen.getByRole('checkbox', { name: /Advantage\+ audience/ });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(savedAd().advantageAudience).toBe(true);
  });
});

