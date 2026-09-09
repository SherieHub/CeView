/**
 * Guards the provider stack behind /preview/content.
 *
 * ContentStudioView reads FOUR contexts — profile, posts, connections and the
 * target selection — and every one of them throws rather than degrades when
 * its provider is absent. The dev preview route composes them by hand in
 * App.tsx, separately from the authenticated tree, so the two can drift: they
 * did, and /preview/content died on "useTargetSelection must be used within a
 * TargetSelectionProvider" with nothing but an error boundary on screen.
 *
 * No unit test could see it. Every other case in this folder mocks the stores
 * it needs, which is exactly what makes them silent about a route that forgets
 * to mount one. This mounts the REAL providers in the same order App.tsx does
 * and asserts the studio actually renders — so dropping one here fails loudly.
 *
 * Also covers the seed: the studio gates its whole screen behind an explicit
 * surge + market pick, so an unseeded provider is only half a fix — the route
 * would mount cleanly and still show step 1 of the picker instead of the
 * screen the preview exists to show.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { DEMO_DRAFT, DEMO_BOARD_POSTS, DEMO_TARGET } from './previewFixtures';
import { AuthProvider } from '../../../services/auth';
import { ProfileProvider } from '../../../services/profileContext';
import { PostStoreProvider } from '../../../services/postStore';
import { ConnectionsStoreProvider } from '../../../services/connectionsStore';
import { TargetSelectionProvider } from '../../../services/targetSelectionStore';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { DEMO_PROFILE } from '../../../services/fixtures/profile';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { buildContentResponse } from './testFixtures';

// The stores are real here — that is the point. Only the network is stubbed,
// including the calls the post and connection stores make on mount: leaving
// either out would fail this for the wrong reason and hide a real drift.
vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    posts: { list: vi.fn(() => Promise.resolve([])) },
    connections: {
      list: vi.fn(() => Promise.resolve([])),
      connect: vi.fn(() => Promise.resolve()),
      disconnect: vi.fn(() => Promise.resolve()),
    },
    markets: { forCategory: vi.fn(() => Promise.resolve(MOCK_MARKETS)) },
    content: { generate: vi.fn(() => Promise.resolve(buildContentResponse('groq'))) },
    creativeDirection: {
      generate: vi.fn(() => Promise.resolve({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } })),
    },
    compliance: { omcsAnalyze: vi.fn(() => Promise.reject(new Error('not used here'))) },
  },
}));

// Mirrors App.tsx's `/preview` route element, plus the AuthProvider (index.tsx)
// and OverlayStackProvider (App) that sit above the router. Kept in this shape
// deliberately: it should read as a copy of the route, so a drift between them
// is obvious in a diff.
function renderPreviewRoute() {
  return render(
    <AuthProvider>
      <OverlayStackProvider>
        <ProfileProvider initial={DEMO_PROFILE}>
          <PostStoreProvider>
            <ConnectionsStoreProvider>
              <TargetSelectionProvider initial={DEMO_TARGET}>
                <ContentStudioView initialDraft={DEMO_DRAFT} initialPosts={DEMO_BOARD_POSTS} />
              </TargetSelectionProvider>
            </ConnectionsStoreProvider>
          </PostStoreProvider>
        </ProfileProvider>
      </OverlayStackProvider>
    </AuthProvider>,
  );
}

describe('/preview/content provider stack', () => {
  it('mounts every context the studio reads, without throwing', () => {
    expect(() => renderPreviewRoute()).not.toThrow();
  });

  it('lands on the studio itself rather than the target picker', async () => {
    renderPreviewRoute();

    expect(await screen.findByRole('heading', { level: 1, name: /Create content that fits the market/ }))
      .toBeTruthy();
    // The picker's step 1 heading — present only when the seed is missing.
    expect(screen.queryByText(/pick a surge alert/i)).toBeNull();
  });

  it('seeds the market the rest of the preview fixtures are written for', async () => {
    renderPreviewRoute();

    const select = await screen.findByLabelText('Target market') as HTMLSelectElement;
    expect(select.value).toBe('korea');
  });
});
