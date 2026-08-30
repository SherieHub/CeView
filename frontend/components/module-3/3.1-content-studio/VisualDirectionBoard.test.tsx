/**
 * CARD — Task 25: wire VisualDirectionBoard to POST /api/creative-direction/generate.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VisualDirectionBoard from './VisualDirectionBoard';
import { ApiError } from '../../../services/apiError';
import type { CreativeDirection } from '../../../types';

const generateMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    creativeDirection: { generate: (...args: unknown[]) => generateMock(...args) },
  },
}));

const REAL_DIRECTION: CreativeDirection = {
  visualGuide: ['Open on the reef wall at first light.'],
  shots: [{ label: 'Opening Dive', description: 'Diver descending past the drop-off.', lighting: 'Natural, blue-hour' }],
  moodboard: { palette: 'Vibrant turquoise, coral pink, driftwood neutrals', references: ['@moalboal_dive_life'] },
};

describe('VisualDirectionBoard', () => {
  it('renders real shot-list, moodboard, and visual guide data', async () => {
    generateMock.mockResolvedValue(REAL_DIRECTION);

    render(<VisualDirectionBoard activePlatform="instagram" />);

    await waitFor(() => expect(screen.getByText('Opening Dive')).toBeInTheDocument());
    expect(screen.getByText(/Diver descending past the drop-off/)).toBeInTheDocument();
    expect(screen.getByText(/Natural, blue-hour/)).toBeInTheDocument();
    expect(screen.getByText(/Open on the reef wall at first light/)).toBeInTheDocument();
    expect(screen.getByText(/Vibrant turquoise/)).toBeInTheDocument();
    expect(screen.getByText('@moalboal_dive_life')).toBeInTheDocument();
  });

  it('renders an error panel when generate() is rejected', async () => {
    generateMock.mockRejectedValue(
      new ApiError({ status: 500, method: 'POST', path: '/api/creative-direction/generate', body: { message: 'boom' } }),
    );

    render(<VisualDirectionBoard activePlatform="instagram" />);

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
  });
});
