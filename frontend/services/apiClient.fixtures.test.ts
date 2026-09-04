import { beforeEach, describe, expect, it, vi } from 'vitest';

// VITE_USE_FIXTURES must be set before apiClient.ts is imported, since it
// reads import.meta.env once at module-eval time.
vi.stubEnv('VITE_USE_FIXTURES', 'true');

describe('apiClient (fixture mode)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('markets.list resolves the MOCK_MARKETS shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_MARKETS } = await import('./fixtures/markets');
    await expect(apiClient.markets.list()).resolves.toEqual(MOCK_MARKETS);
  });

  it('notifications.list resolves the MOCK_NOTIFICATIONS shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_NOTIFICATIONS } = await import('./fixtures/notifications');
    await expect(apiClient.notifications.list()).resolves.toEqual(MOCK_NOTIFICATIONS);
  });

  it('content.generate resolves the MOCK_CONTENT shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_CONTENT } = await import('./fixtures/content');
    await expect(
      apiClient.content.generate({
        market: 'korea',
        businessName: 'Moalboal FreeDive Cebu',
        description: 'Freediving in Moalboal.',
        categories: ['Coastal & Island'],
        trend: 'surging',
      }),
    ).resolves.toEqual(MOCK_CONTENT);
  });

  it('compliance.omcsAnalyze resolves the MOCK_OMCS shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_OMCS } = await import('./fixtures/omcs');
    await expect(
      apiClient.compliance.omcsAnalyze({ caption: 'caption', imageUrl: 'https://example.invalid/x.jpg' }),
    ).resolves.toEqual(MOCK_OMCS);
  });

  it('campaign.report resolves the MOCK_REPORT shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_REPORT } = await import('./fixtures/campaign');
    await expect(apiClient.campaign.report()).resolves.toEqual(MOCK_REPORT);
  });

  it('posts.list resolves the MOCK_POSTS shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_POSTS } = await import('./fixtures/posts');
    await expect(apiClient.posts.list()).resolves.toEqual(MOCK_POSTS);
  });

  it('workspace.members resolves the MOCK_MEMBERS shape', async () => {
    const { apiClient } = await import('./apiClient');
    const { MOCK_MEMBERS } = await import('./fixtures/members');
    await expect(apiClient.workspace.members()).resolves.toEqual(MOCK_MEMBERS);
  });

  it('connections.list resolves without a network call', async () => {
    const { apiClient } = await import('./apiClient');
    const connections = await apiClient.connections.list();
    expect(connections.length).toBeGreaterThan(0);
  });
});
