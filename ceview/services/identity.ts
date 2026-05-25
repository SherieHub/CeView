/**
 * Pre-auth operator identifier. The backend GET/PUT /api/v1/business-profile
 * endpoints scope by `operatorId` until JWT is wired. The fixed dev UUID is
 * seeded in Flyway V2 so the FK on tbl_business_profile.user_id resolves.
 */
export const OPERATOR_ID: string =
  (import.meta.env.VITE_OPERATOR_ID as string | undefined) ??
  '00000000-0000-0000-0000-000000000001';
