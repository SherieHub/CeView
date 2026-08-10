# Shared — Workspace (members & invites)

**Route:** `/settings/workspace` · **Owner:** shared (`components/shared/`) + auth, not any single
module 1–4 — a workspace's membership applies across the whole product, not to one module's data.

**Prototype reference:** [`ui-ux-prototype.html:4286–4310`](../../ui-ux-prototype.html#L4286)
(`workspace` panel inside `renderSettings()`), [`:4203–4212`](../../ui-ux-prototype.html#L4203)
(`sendInvite`).

**Component:** `components/shared/settings/WorkspaceSettings.tsx` — new.

## Purpose

One business profile and one set of connected platforms is shared by everyone in a workspace — this
screen manages who that "everyone" is.

## Layout

Member list (avatar initials, name, email, role chip — Owner/Editor/Viewer, "Invite pending" chip for
unaccepted invites), then an invite-by-email form (email + role select, Editor or Viewer only — an
operator cannot invite another Owner from this form).

## Behavior

Submitting the invite form appends a pending member row immediately (optimistic) with a derived
display name from the email's local part, and shows a confirmation toast. The prototype does not
model invite acceptance/expiry/revocation — those are real product gaps to resolve before this ships
for real, not something to silently invent; flag in review.

## API calls (proposed — not yet implemented)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/workspace/members?operatorId=UUID` | List members |
| `POST` | `/api/v1/workspace/invites` | Send an invite (email + role) |
| `DELETE` | `/api/v1/workspace/members/{id}` | Remove a member (not present in the prototype; needed for a real product — flag as a gap) |

## Entities (proposed) — `WorkspaceMember` / `tbl_workspace_member`, `WorkspaceInvite` / `tbl_workspace_invite`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `operator_id` | `UUID` FK | which workspace |
| `user_id` | `UUID` FK, nullable | null while `tbl_workspace_invite` is pending, set once accepted |
| `email` | `TEXT` | |
| `role` | `TEXT` | `Owner` \| `Editor` \| `Viewer` |
| `status` | `TEXT` | `active` \| `pending` |

`tbl_workspace_invite` carries the invite token, expiry, and inviter — kept separate from
`tbl_workspace_member` so an expired/revoked invite doesn't need a member row deleted, only the
invite row.

## Fixture stand-in

Until implemented, `apiClient` reads/writes the fixture-backed member list described in the
[Fixture Data Layer card](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer).
See also the [Settings: Workspace card](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md#card--settings-workspace).

## Relationship to auth

Role (Owner/Editor/Viewer) is presentational only in the prototype — no permission enforcement exists
anywhere in the UI or the API surface it calls. Before this ships, `AuthGate` and the backend's JWT
claims need to actually gate write actions (e.g. a Viewer should not be able to hit Content Studio's
Publish button) — this is out of scope for the current overhaul and is flagged here as a prerequisite
for treating roles as more than a label.
