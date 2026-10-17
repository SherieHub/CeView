/**
 * CARD — Settings: Workspace (M3-10)
 *
 * Covers: the member list (including the "Invite pending" chip), and the
 * invite-submit behavior (the row and toast appear only once the server
 * accepted the invite), and the screen's honest state when the backend has no
 * workspace feature.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiError';
import WorkspaceSettings from './WorkspaceSettings';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';
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
    <OverlayStackProvider>
      <ToastProvider>
        <WorkspaceSettings />
      </ToastProvider>
    </OverlayStackProvider>,
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

  it('submitting the invite form appends a pending row with a derived display name once the invite is accepted', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.change(screen.getByLabelText(/invite by email/i), {
      target: { value: 'hana.kim@sunsetcove.ph' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'Viewer' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('Hana Kim')).toBeInTheDocument();
    expect(screen.getByText('hana.kim@sunsetcove.ph')).toBeInTheDocument();
    expect(screen.getByText('Invite pending')).toBeInTheDocument();
    expect(screen.getByText('Viewer', { selector: '.badge' })).toBeInTheDocument();
    expect(inviteMock).toHaveBeenCalledWith('hana.kim@sunsetcove.ph', 'Viewer');

    await waitFor(() => expect(screen.getByText(/invite sent to hana.kim@sunsetcove.ph/i)).toBeInTheDocument());

    // The form clears so a second invite doesn't repeat the first email.
    expect(screen.getByLabelText(/invite by email/i)).toHaveValue('');
  });

  it('a rejected invite adds no row and never claims it was sent', async () => {
    inviteMock.mockRejectedValue(new ApiError({ status: 500, method: 'POST', path: '/api/workspace/invite', body: {} }));
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.change(screen.getByLabelText(/invite by email/i), { target: { value: 'hana.kim@sunsetcove.ph' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => expect(screen.getByText(/could not send the invite/i)).toBeInTheDocument());
    expect(screen.queryByText('Hana Kim')).not.toBeInTheDocument();
    expect(screen.queryByText(/invite sent to/i)).not.toBeInTheDocument();
  });

  it('with no workspace backend (404) it says so, stops loading and disables invites', async () => {
    membersMock.mockRejectedValue(new ApiError({ status: 404, method: 'GET', path: '/api/workspace/members', body: undefined }));
    renderSettings();

    expect(await screen.findByText(/aren't available yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled();
  });

  it('does nothing for a blank email', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(inviteMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Invite pending')).not.toBeInTheDocument();
  });

  it('each row has a menu that copies the member email', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Jun Tabares' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /copy email/i }));

    expect(writeText).toHaveBeenCalledWith('jun@sunsetcove.ph');
    expect(await screen.findByText('Copied jun@sunsetcove.ph')).toBeInTheDocument();
  });

  it('the access note says roles do not limit anything yet, and can be dismissed', async () => {
    localStorage.removeItem('ceview.workspace.aboutDismissed');
    renderSettings();
    await screen.findByText('Maria Lopez');

    expect(screen.getByText(/roles are\s+labels for now/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/about workspace access/i)).not.toBeInTheDocument();
    localStorage.removeItem('ceview.workspace.aboutDismissed');
  });

  it('"Replay tour" opens the tutorial modal, and it can be closed again', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.click(screen.getByRole('button', { name: /replay tour/i }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
