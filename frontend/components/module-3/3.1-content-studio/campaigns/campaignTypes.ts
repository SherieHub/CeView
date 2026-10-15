/**
 * Content campaigns — FRONTEND-ONLY planning model.
 *
 * There is no campaign API, persistence, scheduler or AI campaign planner
 * yet. A campaign here lives in React state for the current session only:
 * it is lost on refresh, never sent to the backend, and nothing publishes or
 * schedules from it. The UI says so wherever it matters.
 *
 * INTEGRATION BOUNDARY: when a campaign API exists, `useCampaignDrafts`
 * is the one place to swap — replace its in-memory list with fetch/mutate
 * calls and keep the same shape (or map to it).
 */
import { useCallback, useState } from 'react';
import type { StudioPlatformId } from '../contentStudioTypes';

export type CampaignObjective = 'awareness' | 'experience' | 'seasonal' | 'market' | 'inquiries';

export const OBJECTIVES: { id: CampaignObjective; label: string }[] = [
  { id: 'awareness', label: 'Increase brand awareness' },
  { id: 'experience', label: 'Promote a specific tourism experience' },
  { id: 'seasonal', label: 'Promote a seasonal offer' },
  { id: 'market', label: 'Attract travelers from a target market' },
  { id: 'inquiries', label: 'Increase inquiries' },
];

export function objectiveLabel(id: CampaignObjective): string {
  return OBJECTIVES.find((o) => o.id === id)?.label ?? id;
}

/** The operator's own progress marker for a planned post — not a publish state. */
export type PlannedPostStatus = 'planned' | 'drafting' | 'reviewed';

export const POST_STATUSES: { id: PlannedPostStatus; label: string }[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'drafting', label: 'In draft' },
  { id: 'reviewed', label: 'Reviewed' },
];

export function postStatusLabel(id: PlannedPostStatus): string {
  return POST_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export interface PlannedPost {
  id: string;
  /** ISO date (yyyy-mm-dd) the operator intends to publish on. */
  date: string;
  platform: StudioPlatformId;
  topic: string;
  status: PlannedPostStatus;
}

export interface CampaignDraft {
  id: string;
  name: string;
  objective: CampaignObjective;
  marketId: string;
  marketName: string;
  category: string;
  platforms: StudioPlatformId[];
  startDate: string;
  endDate: string;
  description: string;
  posts: PlannedPost[];
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function emptyCampaign(category: string): CampaignDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: newId('cmp'),
    name: '',
    objective: 'market',
    marketId: '',
    marketName: '',
    category,
    platforms: [],
    startDate: today,
    endDate: today,
    description: '',
    posts: [],
  };
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateRange(c: Pick<CampaignDraft, 'startDate' | 'endDate'>): string {
  return `${formatDate(c.startDate)} – ${formatDate(c.endDate)}`;
}

export function sortedPosts(posts: PlannedPost[]): PlannedPost[] {
  return [...posts].sort((a, b) => a.date.localeCompare(b.date));
}

/** In-memory campaign list for this session. See the integration note above. */
export function useCampaignDrafts() {
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([]);

  const upsert = useCallback((campaign: CampaignDraft) => {
    setCampaigns((list) => {
      const i = list.findIndex((c) => c.id === campaign.id);
      if (i < 0) return [campaign, ...list];
      const next = [...list];
      next[i] = campaign;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCampaigns((list) => list.filter((c) => c.id !== id));
  }, []);

  const setPostStatus = useCallback((campaignId: string, postId: string, status: PlannedPostStatus) => {
    setCampaigns((list) =>
      list.map((c) =>
        c.id !== campaignId ? c : { ...c, posts: c.posts.map((p) => (p.id === postId ? { ...p, status } : p)) },
      ),
    );
  }, []);

  return { campaigns, upsert, remove, setPostStatus };
}
