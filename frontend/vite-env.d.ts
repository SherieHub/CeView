/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIXTURES?: string;
  readonly VITE_API_BASE_URL?: string;
  /** Public landing page — see content/landing.ts `SITE`. */
  readonly VITE_WALKTHROUGH_URL?: string;
  readonly VITE_LEAD_FORM_ENDPOINT?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_TERMS_URL?: string;
  /** "true" turns on SMS phone verification (Firebase Blaze plan). Off when unset. */
  readonly VITE_PHONE_VERIFICATION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
