/**
 * localStorage key constants shared between auth.tsx (which owns the
 * session lifecycle) and apiClient.ts (which needs to read the token on
 * every request but must not import auth.tsx directly, to avoid a
 * React-context module depending on / being depended on by a plain fetch
 * wrapper).
 */
export const TOKEN_KEY = 'ceview_token';
export const OPERATOR_ID_KEY = 'ceview_operator_id';
