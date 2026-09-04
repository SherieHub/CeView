/**
 * CARD — Settings: Workspace (M3-10)
 *
 * Covers: the member list (including the "Invite pending" chip), and the
 * invite-submit -> optimistic-row behavior the screen doc calls out
 * explicitly (docs/shared/workspace.md).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceSettings from './WorkspaceSettings';
import { ToastProvider } from '../shared/Toast';
import type { WorkspaceMemberFixture } from '../../types';

const MEMBERS: WorkspaceMemberFixture[] = [
  { name: 'Maria Lopez', email: 'maria@sunsetcove.ph', role: 'Owner', initials: 'ML' },
  { name: 'Jun Tabares', email: 'jun@sunsetcove.ph', role: 'Editor', initials: 'JT' },
];

const membersMock = vi.fn();
const inviteMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    workspace: {
      members: (...args: unknown[]) => membersMock(...args),
      invite: (...args: unknown[]) => inviteMock(...args),
    },
  },
}));

function renderSettings() {
  return render(
    <ToastProvider>
      <WorkspaceSettings />
    </ToastProvider>,
  );
}

beforeEach(() => {
  membersMock.mockReset().mockResolvedValue(MEMBERS);
  inviteMock.mockReset().mockResolvedValue({ ok: true });
});

describe('WorkspaceSettings', () => {
  it('lists the current members with their role', async () => {
    renderSettings();

    expect(await screen.findByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByText('maria@sunsetcove.ph')).toBeInTheDocument();
    expect(screen.getByText('Owner', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByText('Editor', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('Invite pending')).not.toBeInTheDocument();
  });

  it('submitting the invite form appends an optimistic pending row with a derived display name', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.change(screen.getByLabelText(/invite by email/i), {
      target: { value: 'hana.kim@sunsetcove.ph' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'Viewer' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    // Appears immediately — optimistic, not waiting on inviteMock to resolve.
    expect(screen.getByText('Hana Kim')).toBeInTheDocument();
    expect(screen.getByText('hana.kim@sunsetcove.ph')).toBeInTheDocument();
    expect(screen.getByText('Invite pending')).toBeInTheDocument();
    expect(screen.getByText('Viewer', { selector: '.badge' })).toBeInTheDocument();
    expect(inviteMock).toHaveBeenCalledWith('hana.kim@sunsetcove.ph', 'Viewer');

    await waitFor(() => expect(screen.getByText(/invite sent to hana.kim@sunsetcove.ph/i)).toBeInTheDocument());

    // The form clears so a second invite doesn't repeat the first email.
    expect(screen.getByLabelText(/invite by email/i)).toHaveValue('');
  });

  it('does nothing for a blank email', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(inviteMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Invite pending')).not.toBeInTheDocument();
  });
});
