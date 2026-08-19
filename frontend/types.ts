/**
 * Shared domain types for the frontend/ rebuild. Grows as each screen card
 * lands (per docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/).
 * This file currently covers only what the Foundation cards need: auth,
 * business profile, and the Fixture Data Layer's new shapes.
 */

export interface AuthUser {
  id: string;
  email: string;
  businessName: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  /**
   * Whether the operator still needs to go through the one-time "complete
   * your profile" step (missing contactNumber — always true for password
   * signups since /register requires it, sometimes false for a freshly
   * provisioned Google sign-in). See services/auth.tsx's profileCompleted.
   */
  profileCompleted: boolean;
}

export interface BusinessProfile {
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
  uniquenessScore: number | null;
  /** Onboarding — Step 2 Brand Identity fields (card 5, 02-module-1.md). */
  slogan: string;
  industry: string;
  vibes: string[];
  website: string;
  logo: string | null;
  socials: Record<string, string>;
}

/**
 * The real backend's shape (com.ceview.module1.businessinput.dto.BusinessProfileDto,
 * GET/PUT /api/v1/business-profile) — a strict subset of BusinessProfile. The
 * onboarding-only fields (slogan/industry/vibes/website/logo/socials) don't
 * exist in the backend schema yet (see docs/module-1/backend/schema-delta.md),
 * so ProfileProvider merges a fetched BusinessProfileDto over EMPTY_PROFILE
 * rather than assuming the backend returns those fields.
 */
export type BusinessProfileDto = Pick<
  BusinessProfile,
  'businessProfileId' | 'businessName' | 'categories' | 'coreServices' | 'description' | 'uvp' | 'imagePreview' | 'uniquenessScore'
>;

export type PlatformId = 'instagram' | 'tiktok' | 'facebook' | 'naver';

export interface PlatformConnection {
  platform: PlatformId;
  connected: boolean;
  handle: string | null;
  connectedAt: string | null;
}

/**
 * Future real-backend member shape — not what apiClient.workspace.members() returns today.
 * The fixture-backed path returns services/fixtures/members.ts's WorkspaceMemberFixture
 * (role: 'Owner'|'Editor'|'Viewer', initials, no id/status) instead; apiClient.ts is typed
 * against that fixture shape directly. Reconcile the two once a real endpoint exists.
 */
export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt: string;
  status: 'active' | 'invited';
}

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface SocialPost {
  id: string;
  platform: PlatformId;
  status: PostStatus;
  caption: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  marketId: string | null;
}

export interface PostMetric {
  postId: string;
  impressions: number;
  engagements: number;
  clicks: number;
  engagementRate: number;
}
