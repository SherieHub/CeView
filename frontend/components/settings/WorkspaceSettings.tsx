/**
 * CARD — Settings: Workspace
 * Depends on: Foundation — Settings Shell (M3-F3)
 * Prototype reference: ui-ux-prototype.html:4203–4212, 4286–4310
 * Screen doc: docs/shared/workspace.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md (M3-10)
 *
 * Route: /settings/workspace
 *
 * KNOWN GAP (screen doc, flagged not resolved): invite acceptance/expiry/
 * revocation are not modeled — submitting appends an optimistic "pending"
 * row and nothing more. Real product gaps to resolve before this ships for
 * real; not silently invented here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Copy, Info, MoreHorizontal, UserPlus, Users, Workflow, X } from 'lucide-react';
import { useDismiss } from '../shared/useDismiss';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import { isNotAvailable } from '../../services/apiError';
import TutorialModal from '../shared/TutorialModal';
import type { WorkspaceMemberFixture } from '../../types';
import './workspace.css';

type InviteRole = 'Editor' | 'Viewer';

/** "jane.doe" -> "Jane Doe" — the display name for a pending row, derived
 * from the invited email's local part per the screen doc, since there is no
 * real name until the invite is accepted. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const ABOUT_KEY = 'ceview.workspace.aboutDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(ABOUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** The row's "more" menu. Copying the address is the one action there is a
 * backend for; changing a role or removing someone is not modelled yet. */
function MemberMenu({ member }: { member: WorkspaceMemberFixture }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close, triggerRef);

  async function copyEmail() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(member.email);
      showToast(`Copied ${member.email}`);
    } catch {
      showToast('Could not copy — your browser blocked the clipboard');
    }
  }

  return (
    <div className="ws-menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ws-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${member.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="ws-menu" role="menu">
          <button type="button" role="menuitem" onClick={copyEmail}>
            <Copy size={15} aria-hidden="true" /> Copy email
          </button>
        </div>
      )}
    </div>
  );
}

/** Decorative: three member cards fanned out, echoing the list below. */
function HeroArt() {
  return (
    <div className="ws-art" aria-hidden="true">
      {(['navy', 'teal', 'coral'] as const).map((tone) => (
        <span key={tone} className="ws-art-card" data-tone={tone}>
          <span className="ws-art-avatar"><Users size={16} /></span>
          <span className="ws-art-lines"><i /><i /></span>
        </span>
      ))}
    </div>
  );
}

export default function WorkspaceSettings() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<WorkspaceMemberFixture[] | null>(null);
  // False when the backend has no workspace feature yet (404). Members and invites
  // are then shown as unavailable instead of an endless skeleton or a fake success.
  const [available, setAvailable] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('Editor');
  const [tourOpen, setTourOpen] = useState(false);
  const [aboutHidden, setAboutHidden] = useState(readDismissed);

  function hideAbout() {
    setAboutHidden(true);
    try {
      localStorage.setItem(ABOUT_KEY, '1');
    } catch {
      // Storage blocked: hidden for this visit only.
    }
  }

  useEffect(() => {
    let cancelled = false;
    apiClient.workspace.members()
      .then((list) => { if (!cancelled) setMembers(list); })
      .catch((error) => {
        if (cancelled) return;
        setMembers([]);
        if (isNotAvailable(error)) setAvailable(false);
        else showToast('Could not load workspace members.');
      });
    return () => { cancelled = true; };
  }, []);

  async function sendInvite() {
    const trimmed = email.trim();
    if (!trimmed || !available) return;

    const name = nameFromEmail(trimmed);
    const pendingMember: WorkspaceMemberFixture = {
      name,
      email: trimmed,
      role,
      initials: initialsFor(name),
      status: 'pending',
    };
    // The row and the "Invite sent" toast appear only once the server accepted the
    // invite — a failed request must not look like a sent one.
    try {
      await apiClient.workspace.invite(trimmed, role);
    } catch (error) {
      if (isNotAvailable(error)) setAvailable(false);
      showToast(`Could not send the invite to ${trimmed}.`);
      return;
    }
    setMembers((current) => [...(current ?? []), pendingMember]);
    showToast(`Invite sent to ${trimmed}`);
    setEmail('');
  }

  return (
    <div className="ws">
      <section className="ws-hero" aria-labelledby="ws-title">
        <div className="ws-hero-main">
          <div className="ws-hero-top">
            <span className="ws-hero-icon" aria-hidden="true"><Users size={30} /></span>
            <div>
              <h1 id="ws-title" className="ws-heading">Workspace members</h1>
              <p className="ws-subhead">Everyone here shares this business profile and its connected platforms.</p>
            </div>
          </div>
          <ul className="ws-perks">
            <li>
              <span className="ws-perk-icon" aria-hidden="true"><Users size={17} /></span>
              <span><strong>Shared access</strong><span>Work together on one profile</span></span>
            </li>
            <li>
              <span className="ws-perk-icon" aria-hidden="true"><BadgeCheck size={17} /></span>
              <span><strong>A role for everyone</strong><span>Owner, Editor or Viewer</span></span>
            </li>
            <li>
              <span className="ws-perk-icon" aria-hidden="true"><Workflow size={17} /></span>
              <span><strong>Better collaboration</strong><span>Create, plan and grow together</span></span>
            </li>
          </ul>
        </div>
        <HeroArt />
      </section>

      <div className="ws-layout">
        <section className="ws-card ws-team" aria-labelledby="ws-team-title">
          <div className="ws-card-head">
            <div>
              <h2 id="ws-team-title" className="ws-card-title">
                Team members{members ? <> <span className="num">({members.length})</span></> : null}
              </h2>
              <p className="ws-card-sub">These people have access to this business profile and its connected platforms.</p>
            </div>
            <button type="button" className="ws-tour" onClick={() => setTourOpen(true)}>
              Replay tour
            </button>
          </div>

          {!available && (
            <p className="ws-note" role="status">
              Team members and invites aren't available yet.
            </p>
          )}

          {members == null ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div className="skel" style={{ height: 56 }} />
              <div className="skel" style={{ height: 56 }} />
              <div className="skel" style={{ height: 56 }} />
            </div>
          ) : members.length === 0 ? (
            available && <p className="ws-empty">No one else is here yet — invite a teammate.</p>
          ) : (
            <div className="ws-table" role="table" aria-label="Team members">
              <div className="ws-tr ws-tr--head" role="row">
                <span role="columnheader">Member</span>
                <span role="columnheader">Email</span>
                <span role="columnheader">Role</span>
                <span role="columnheader"><span className="sr-only">Actions</span></span>
              </div>
              {members.map((member) => (
                <div key={member.email} className="ws-tr" role="row" data-pending={member.status === 'pending' || undefined}>
                  <span role="cell" className="ws-who">
                    <span className="ws-avatar" aria-hidden="true">{member.initials}</span>
                    <span className="ws-name">{member.name}</span>
                  </span>
                  <span role="cell" className="ws-email">{member.email}</span>
                  <span role="cell" className="ws-role-cell">
                    <span className="badge ws-role" data-role={member.role}>{member.role}</span>
                    {member.status === 'pending' && <span className="ws-pending">Invite pending</span>}
                  </span>
                  <span role="cell" className="ws-actions">
                    <MemberMenu member={member} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ws-card ws-invite" aria-labelledby="ws-invite-title">
          <div className="ws-invite-head">
            <span className="ws-invite-icon" aria-hidden="true"><UserPlus size={22} /></span>
            <h2 id="ws-invite-title" className="ws-card-title">Invite new member</h2>
          </div>
          <p className="ws-card-sub">Add a teammate to give them access to this business profile and its connected platforms.</p>
          <form
            className="ws-form"
            onSubmit={(event) => { event.preventDefault(); sendInvite(); }}
          >
            <label className="ws-field">
              <span className="ws-label">Invite by email</span>
              <input
                type="email"
                className="ws-input"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="ws-field">
              <span className="ws-label">Role</span>
              <select className="ws-input ws-select" value={role} onChange={(event) => setRole(event.target.value as InviteRole)}>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
            </label>
            <button type="submit" className="ws-send" disabled={!available}>
              <UserPlus size={17} aria-hidden="true" /> Send invite
            </button>
          </form>
        </section>
      </div>

      {!aboutHidden && (
        <aside className="ws-about" aria-labelledby="ws-about-title">
          <span className="ws-about-icon" aria-hidden="true"><Info size={18} /></span>
          <div>
            <h2 id="ws-about-title" className="ws-about-title">About workspace access</h2>
            <p className="ws-about-text">
              Every member can see and work on this business profile and its connected platforms. Roles are
              labels for now — they don&rsquo;t limit what someone can do yet, so invite only people you trust
              with the whole workspace.
            </p>
          </div>
          <button type="button" className="ws-about-close" onClick={hideAbout} aria-label="Dismiss">
            <X size={18} aria-hidden="true" />
          </button>
        </aside>
      )}

      <TutorialModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
