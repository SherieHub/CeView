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
import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { WorkspaceMemberFixture } from '../../types';

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

export default function WorkspaceSettings() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<WorkspaceMemberFixture[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('Editor');

  useEffect(() => {
    let cancelled = false;
    apiClient.workspace.members().then((list) => { if (!cancelled) setMembers(list); });
    return () => { cancelled = true; };
  }, []);

  function sendInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;

    const name = nameFromEmail(trimmed);
    const pendingMember: WorkspaceMemberFixture = {
      name,
      email: trimmed,
      role,
      initials: initialsFor(name),
      status: 'pending',
    };
    // Optimistic per the screen doc — the row appears immediately, before the
    // request resolves. No invite acceptance/expiry/revocation is modeled, so
    // there is nothing to reconcile the row against later; a failed request
    // is not surfaced (same fire-and-forget posture as other optimistic
    // writes in this codebase, e.g. useDashboardState's markRead).
    setMembers((current) => [...(current ?? []), pendingMember]);
    void apiClient.workspace.invite(trimmed, role).catch(() => {});
    showToast(`Invite sent to ${trimmed}`);
    setEmail('');
  }

  return (
    <div className="card p-6">
      <h2 className="heading-lg mb-1">Workspace members</h2>
      <p className="body-sm mb-5">Everyone here shares this business profile and its connected platforms.</p>

      {members == null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
        </div>
      ) : (
        <ul className="mb-6 flex flex-col gap-3">
          {members.map((member) => (
            <li
              key={member.email}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-gray-light)] p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-navy-primary)] text-xs font-semibold text-[var(--color-text-inverse)]">
                  {member.initials}
                </span>
                <div>
                  <p className="font-semibold text-navy-dark">{member.name}</p>
                  <p className="body-xs text-[var(--color-text-muted)]">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.status === 'pending' && <span className="chip chip--attention">Invite pending</span>}
                <span className="badge badge--teal">{member.role}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => { event.preventDefault(); sendInvite(); }}
      >
        <label className="field min-w-[220px] flex-1">
          <span className="field-label">Invite by email</span>
          <input
            type="email"
            className="input"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select className="input" value={role} onChange={(event) => setRole(event.target.value as InviteRole)}>
            <option value="Editor">Editor</option>
            <option value="Viewer">Viewer</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          <UserPlus size={16} aria-hidden="true" /> Send invite
        </button>
      </form>
    </div>
  );
}
