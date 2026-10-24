/**
 * In-memory stand-in for /api/content/drafts, used only when VITE_USE_FIXTURES is on.
 * Mirrors the backend's rules (one auto-save per market, named drafts newest first).
 */
import type { ContentDraft, ContentDraftSummary } from '../../types';

const drafts = new Map<string, ContentDraft>();
let counter = 0;

function nextId(): string {
  counter += 1;
  return `fixture-draft-${counter}`;
}

function preview(payload: Record<string, unknown>): string {
  const caption = (payload.draft as { caption?: string } | undefined)?.caption?.trim();
  return (caption ?? '').slice(0, 140);
}

export const fixtureDrafts = {
  getAuto(market: string): ContentDraft | null {
    return [...drafts.values()].find((d) => d.kind === 'auto' && d.market === market) ?? null;
  },

  saveAuto(market: string, demandAlertId: string | null, payload: Record<string, unknown>): ContentDraft {
    const now = new Date().toISOString();
    const existing = fixtureDrafts.getAuto(market);
    const draft: ContentDraft = existing
      ? { ...existing, demandAlertId, payload, updatedAt: now }
      : {
          id: nextId(), kind: 'auto', name: 'Auto-saved draft', market, demandAlertId, payload,
          createdAt: now, updatedAt: now,
        };
    drafts.set(draft.id, draft);
    return draft;
  },

  list(market: string): ContentDraftSummary[] {
    return [...drafts.values()]
      .filter((d) => d.kind === 'named' && d.market === market)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => {
        const media = d.payload.media as { kind?: string; publicUrl?: string } | null | undefined;
        const audit = d.payload.audit as { status?: 'Pass' | 'Fail'; omcsScore?: number } | null | undefined;
        return {
          id: d.id, kind: d.kind, name: d.name, market: d.market, demandAlertId: d.demandAlertId,
          captionPreview: preview(d.payload),
          hasMedia: Boolean(media?.publicUrl),
          mediaUrl: media?.kind === 'image' ? media.publicUrl ?? null : null,
          auditStatus: audit?.status ?? null,
          auditScore: typeof audit?.omcsScore === 'number' ? Math.round(audit.omcsScore) : null,
          updatedAt: d.updatedAt,
        };
      });
  },

  get(id: string): ContentDraft {
    const draft = drafts.get(id);
    if (!draft) throw new Error('draft not found');
    return draft;
  },

  create(market: string, demandAlertId: string | null, name: string, payload: Record<string, unknown>): ContentDraft {
    // Like the server: identical content already saved for this market is not saved again.
    const incoming = JSON.stringify(payload);
    const duplicate = [...drafts.values()].find(
      (d) => d.kind === 'named' && d.market === market && JSON.stringify(d.payload) === incoming,
    );
    if (duplicate) return { ...duplicate, existing: true };

    const now = new Date().toISOString();
    const draft: ContentDraft = {
      id: nextId(), kind: 'named', name, market, demandAlertId, payload, createdAt: now, updatedAt: now,
    };
    drafts.set(draft.id, draft);
    return draft;
  },

  update(id: string, changes: { name?: string; payload?: Record<string, unknown> }): ContentDraft {
    const draft: ContentDraft = {
      ...fixtureDrafts.get(id),
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.payload !== undefined ? { payload: changes.payload } : {}),
      updatedAt: new Date().toISOString(),
    };
    drafts.set(id, draft);
    return draft;
  },

  remove(id: string): void {
    drafts.delete(id);
  },
};
