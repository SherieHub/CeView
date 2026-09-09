import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentBoard from './ContentBoard';
// MOCK_POSTS, not previewFixtures' DEMO_BOARD_POSTS: previewFixtures.ts is
// marked for deletion once the design is signed off, and a permanent test must
// not break when it goes.
import { MOCK_POSTS } from '../../../services/fixtures/posts';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'x', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

describe('ContentBoard publish disclosure', () => {
  it('hides the Publish button entirely before a passing audit', () => {
    render(
      <ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('reveals it once the audit passes', () => {
    render(
      <ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish onPublished={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
  });
});
