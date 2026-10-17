/**
 * One campaign in the campaigns list: a photo for what it features, its name
 * and stage, the essentials, and how far through approval it is.
 *
 * The photo is a sample from the app's licensed Cebu set, picked to match the
 * campaign's focus (slotFor) — decoration, not the owner's own media.
 */
import { CalendarRange, ChevronRight, FileText } from 'lucide-react';
import { LandingImage } from '../../../landing/ui';
import { BrandMark } from '../ContentBoard';
import { slotFor } from '../captionShots';
import { activePosts, dateRange, objectiveLabel } from './campaignTypes';
import type { CampaignDraft } from './campaignTypes';

type Tone = 'draft' | 'progress' | 'planned' | 'ready';

/** Where the campaign stands, in the owner's terms. */
export function campaignStage(c: CampaignDraft): { label: string; tone: Tone } {
  const live = activePosts(c.posts);
  const approved = live.filter((p) => p.status === 'approved').length;
  if (c.stage === 'strategy' || c.stage === 'plan') return { label: 'Draft', tone: 'draft' };
  if (c.stage === 'prepare') return { label: 'In progress', tone: 'progress' };
  if (live.length > 0 && approved === live.length) return { label: 'Ready', tone: 'ready' };
  if (approved > 0) return { label: 'In progress', tone: 'progress' };
  return { label: 'Planned', tone: 'planned' };
}

function Ring({ pct }: { pct: number }) {
  const r = 15;
  const len = 2 * Math.PI * r;
  return (
    <svg className="cl-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} className="cl-ring-track" />
      {/* Only with progress: a zero-length arc with round caps still draws a dot. */}
      {pct > 0 && <circle cx="18" cy="18" r={r} className="cl-ring-fill" strokeDasharray={`${(pct / 100) * len} ${len}`} />}
    </svg>
  );
}

export default function CampaignCard({ campaign: c, onOpen }: { campaign: CampaignDraft; onOpen: () => void }) {
  const live = activePosts(c.posts);
  const approved = live.filter((p) => p.status === 'approved').length;
  const pct = live.length ? Math.round((approved / live.length) * 100) : 0;
  const stage = campaignStage(c);

  return (
    <li className="cl-card">
      <div className="cl-photo" aria-hidden="true">
        <LandingImage slot={slotFor(`${c.focus.join(' ')} ${c.category} ${c.name}`)} fill decorative sizes="220px" />
      </div>
      <div className="cl-body">
        <div className="cl-title-row">
          <h3 className="cl-title">{c.name}</h3>
          <span className="cl-stage" data-tone={stage.tone}>{stage.label}</span>
        </div>
        <p className="cl-meta">
          {objectiveLabel(c.objective)} · {c.marketName || 'Any market'} · {c.category}
        </p>
        <div className="cl-plats" aria-label={`Platforms: ${c.platforms.join(', ')}`}>
          {c.platforms.map((p) => <BrandMark key={p} platform={p} />)}
        </div>
        <p className="cl-facts">
          <span><CalendarRange size={14} aria-hidden="true" /> {dateRange(c)}</span>
          <span><FileText size={14} aria-hidden="true" /> <span className="num">{live.length}</span> post{live.length === 1 ? '' : 's'}</span>
        </p>
        <div className="cl-foot">
          <Ring pct={pct} />
          <div className="cl-progress">
            <span className="cl-progress-label"><span className="num">{approved}/{live.length}</span> approved</span>
            <span className="cl-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
          </div>
          <span className="cl-pct num">{pct}%</span>
          <button type="button" className="cl-open" onClick={onOpen} aria-label={`Open ${c.name}`}>
            {c.stage === 'done' ? 'Open' : 'Continue'} <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}
