import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LinkAttributionPanel from './LinkAttributionPanel';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';
import { mockLinks, mockLinkPerformance } from '../../../services/fixtures/attributionLinks';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    attributionLinks: {
      list: vi.fn(),
      performance: vi.fn(),
    }
  }
}));

describe('LinkAttributionPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading initially', () => {
    // Return unresolved promises
    (apiClient.attributionLinks.list as any).mockReturnValue(new Promise(() => {}));
    render(<LinkAttributionPanel />);
    expect(screen.getByText('Loading links...')).toBeInTheDocument();
  });

  it('handles empty links list', async () => {
    (apiClient.attributionLinks.list as any).mockResolvedValue([]);
    render(<LinkAttributionPanel />);
    await waitFor(() => {
      expect(screen.getByText('No tracked campaign links yet.')).toBeInTheDocument();
    });
  });

  it('handles links error and retry', async () => {
    (apiClient.attributionLinks.list as any).mockRejectedValueOnce(new ApiError({ status: 500, method: 'GET', path: '/api/attribution/links', body: { message: 'Links Error' } }))
                                            .mockResolvedValueOnce([]);
    render(<LinkAttributionPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Links Error/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.getByText('No tracked campaign links yet.')).toBeInTheDocument();
    });
  });

  it('selects first link and fetches performance', async () => {
    const links = mockLinks();
    (apiClient.attributionLinks.list as any).mockResolvedValue(links);
    (apiClient.attributionLinks.performance as any).mockResolvedValue(mockLinkPerformance(links[0].linkId));

    render(<LinkAttributionPanel />);
    
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Option exists
    expect(screen.getAllByRole('option')).toHaveLength(links.length);
    // Named by country, without the opaque slug that pushed the window dates out of view.
    expect(screen.getAllByRole('option')[0].textContent).toMatch(/^Accommodation & Staycation • South Korea • \w{3} \d+ – \w{3} \d+$/);

    // The title now sits in the card header from the start, so wait on the
    // fetch and the table rather than on the title.
    await waitFor(() => {
      expect(apiClient.attributionLinks.performance).toHaveBeenCalledWith(links[0].linkId);
    });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Link-attributed evidence')).toBeInTheDocument();
  });

  it('handles performance error and retry separately', async () => {
    const links = mockLinks();
    (apiClient.attributionLinks.list as any).mockResolvedValue(links);
    (apiClient.attributionLinks.performance as any).mockRejectedValueOnce(new ApiError({ status: 500, method: 'GET', path: '/api/attribution/links', body: { message: 'Perf Error' } }))
                                                   .mockResolvedValueOnce(mockLinkPerformance(links[0].linkId));

    render(<LinkAttributionPanel />);
    
    await waitFor(() => {
      expect(screen.getByText(/Perf Error/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.getByText('Link-attributed evidence')).toBeInTheDocument();
    });
  });

  it('allows selection change', async () => {
    const links = mockLinks();
    (apiClient.attributionLinks.list as any).mockResolvedValue(links);
    (apiClient.attributionLinks.performance as any).mockResolvedValue(mockLinkPerformance(links[1].linkId));

    render(<LinkAttributionPanel />);

    // Wait for the panel to settle on its automatic first selection. Changing the
    // select before that effect has run raced it under load: the late auto-select
    // could overwrite the user's choice, so the test failed in the full suite and
    // passed alone.
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue(links[0].linkId);
      expect(apiClient.attributionLinks.performance).toHaveBeenCalledWith(links[0].linkId);
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: links[1].linkId } });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue(links[1].linkId);
      expect(apiClient.attributionLinks.performance).toHaveBeenCalledWith(links[1].linkId);
    });
  });
});
