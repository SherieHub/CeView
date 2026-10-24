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
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublishRequest, PublishedPost } from '../types';
import { apiClient } from './apiClient';

export type PublishDraft = PublishRequest;

export interface PostStore {
  posts: PublishedPost[] | null;
  publish(draft: PublishDraft): Promise<PublishedPost[]>;
  error: string | null;
  refresh(): Promise<void>;
  /** Adds posts a screen built itself (Quick Post's publish or schedule). */
  add(created: PublishedPost[]): void;
  metricsFor(postId: string): PublishedPost | null;
}

const PostStoreContext = createContext<PostStore | null>(null);

export function PostStoreProvider({ children, initial }: { children: ReactNode; initial?: PublishedPost[] }) {
  // `initial` seeds the dev preview with its demo board instead of fetching.
  const [posts, setPosts] = useState<PublishedPost[] | null>(initial ?? null);

  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  async function refresh() {
    const seq = ++requestSeq.current;
    try {
      const list = await apiClient.posts.list();
      if (seq !== requestSeq.current) return;
      setPosts(list); setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setPosts((current) => current ?? []);
      setError(err instanceof Error ? err.message : 'Unable to load posts');
    }
  }
  useEffect(() => {
    if (initial) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initial) return;
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [initial]);

  function add(created: PublishedPost[]) {
    requestSeq.current += 1; // A pre-publication read must not erase the confirmed write.
    setError(null);
    setPosts((prev) => [...created, ...(prev ?? []).filter((p) => !created.some((n) => n.id === p.id))]);
  }

  async function publish(draft: PublishDraft): Promise<PublishedPost[]> {
    const created = await apiClient.posts.publish(draft);
    add(created);
    return created;
  }

  function metricsFor(postId: string): PublishedPost | null {
    return posts?.find((p) => p.id === postId) ?? null;
  }

  const value = useMemo<PostStore>(
    () => ({ posts, publish, add, metricsFor, error, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, error]
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
