/**
 * CARD — Foundation: Shared Stores
 * Depends on: Foundation — Fixture Data Layer
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 * Pseudocode: pseudocode/module-3/foundation-shared-stores.ts
 *
 * The published-post list shared across Module 3 (Content Studio, Calendar)
 * and Module 4 (Performance) — one instance per app, seeded once, so every
 * consumer reads the same array with no prop drilling and no refetch on
 * write. Provider/hook shape mirrors services/profileContext.tsx.
 *
 * SCOPE NOTE: the card's milestone says both stores mount above AppShell in
 * App.tsx, but that file isn't in this card's file list — flagged as a gap,
 * not touched here (same discipline as every other card this session).
 *
 * Named .tsx (not .ts, despite the card text) since PostStoreProvider
 * renders JSX — same reasoning as obDraft.tsx in Module 1.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlatformId, PublishedPost } from '../types';
import { apiClient } from './apiClient';

export interface PublishDraft {
  caption: string;
  mediaDataUrl: string | null;
  platforms: PlatformId[];
}

export interface PostStore {
  posts: PublishedPost[] | null;
  publish(draft: PublishDraft): PublishedPost[];
  /** Adds posts a screen built itself (Quick Post's publish or schedule). */
  add(created: PublishedPost[]): void;
  metricsFor(postId: string): PublishedPost | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const PostStoreContext = createContext<PostStore | null>(null);

export function PostStoreProvider({ children, initial }: { children: ReactNode; initial?: PublishedPost[] }) {
  // `initial` seeds the dev preview with its demo board instead of fetching.
  const [posts, setPosts] = useState<PublishedPost[] | null>(initial ?? null);

  useEffect(() => {
    if (initial) return;
    apiClient.posts
      .list()
      .then((list) => setPosts(list as PublishedPost[]))
      .catch(() => setPosts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(created: PublishedPost[]) {
    setPosts((prev) => [...created, ...(prev ?? [])]);
  }

  function publish(draft: PublishDraft): PublishedPost[] {
    const created: PublishedPost[] = draft.platforms.map((platform) => ({
      id: `p-${Date.now()}-${platform}`,
      date: todayISO(),
      platform,
      caption: draft.caption,
      status: 'published',
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
      series: [],
    }));
    add(created);
    return created;
  }

  function metricsFor(postId: string): PublishedPost | null {
    return posts?.find((p) => p.id === postId) ?? null;
  }

  const value = useMemo<PostStore>(
    () => ({ posts, publish, add, metricsFor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts]
  );

  return <PostStoreContext.Provider value={value}>{children}</PostStoreContext.Provider>;
}

/** The store when one is mounted, else null — for screens that also render standalone (tests). */
export function useOptionalPosts(): PostStore | null {
  return useContext(PostStoreContext);
}

export function usePosts(): PostStore {
  const ctx = useContext(PostStoreContext);
  if (!ctx) throw new Error('usePosts must be used within a PostStoreProvider');
  return ctx;
}
