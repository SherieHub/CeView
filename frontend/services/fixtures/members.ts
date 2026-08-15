/**
 * Settings → Workspace member fixture — transcribed from
 * ui-ux-prototype.html:1477–1481.
 */

export interface WorkspaceMemberFixture {
  name: string;
  email: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  initials: string;
}

export const MOCK_MEMBERS: WorkspaceMemberFixture[] = [
  { name: 'Maria Lopez', email: 'maria@sunsetcove.ph', role: 'Owner', initials: 'ML' },
  { name: 'Jun Tabares', email: 'jun@sunsetcove.ph', role: 'Editor', initials: 'JT' },
  { name: 'Hana Kim', email: 'hana@sunsetcove.ph', role: 'Viewer', initials: 'HK' },
];
