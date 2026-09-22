import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickMatchStep } from './ClickMatchStep';
import { mockUnconvertedClicks, MOCK_LINKS } from '../../../services/fixtures/attributionLinks';
import type { UnconvertedClick } from '../../../types';

const unconvertedClicks = vi.hoisted(() => vi.fn());
vi.mock('../../../services/apiClient', () => ({ apiClient: { attributionLinks: { unconvertedClicks } } }));
const props = { linkId: MOCK_LINKS[0].linkId, from: MOCK_LINKS[0].windowStart, to: MOCK_LINKS[0].windowEnd, value: null };
beforeEach(() => { unconvertedClicks.mockReset().mockResolvedValue(mockUnconvertedClicks()); });

describe('ClickMatchStep', () => {
  it('lists candidates, defaults to None and passes the chosen click ID', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ClickMatchStep {...props} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'None of these' })).toBeChecked();
    fireEvent.click(await screen.findByRole('radio', { name: /Sunset villa/ }));
    const chosen = mockUnconvertedClicks()[0].clickId;
    expect(onChange).toHaveBeenLastCalledWith(chosen);
    // Controlled: the parent feeds the choice back before None can be re-selected.
    rerender(<ClickMatchStep {...props} value={chosen} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'None of these' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(unconvertedClicks).toHaveBeenCalledWith(props.from, props.to);
  });
  it('filters other-link candidates and offers None when empty', async () => {
    unconvertedClicks.mockResolvedValue([{ ...mockUnconvertedClicks()[0], linkId: 'other' }]);
    render(<ClickMatchStep {...props} onChange={vi.fn()} />);
    expect(await screen.findByText(/No unconverted clicks/i)).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });
  it('does not prevent continuing without a match when the request fails and can retry', async () => {
    unconvertedClicks.mockRejectedValueOnce(new Error('offline'));
    render(<ClickMatchStep {...props} onChange={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('radio', { name: 'None of these' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radio', { name: /Sunset villa/ })).toBeVisible();
  });
  it('clears a selected match on window changes and ignores the old request', async () => {
    let resolveOld!: (rows: UnconvertedClick[]) => void;
    unconvertedClicks.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce([]);
    const onChange = vi.fn();
    const { rerender } = render(<ClickMatchStep {...props} value="old-click" onChange={onChange} />);
    rerender(<ClickMatchStep {...props} from="2026-11-01T00:00:00Z" value="old-click" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(null);
    await screen.findByText(/No unconverted clicks/i);
    await act(async () => resolveOld(mockUnconvertedClicks()));
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });
  it('clears a selection that no longer appears in the candidate response', async () => {
    const onChange = vi.fn();
    unconvertedClicks.mockResolvedValue([]);
    render(<ClickMatchStep {...props} value="converted-click" onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
