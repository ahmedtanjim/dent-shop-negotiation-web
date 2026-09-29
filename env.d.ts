/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  /** The CRM web app's origin (default https://app.dentshopmanager.com). */
  readonly VITE_CRM_URL?: string
  /** GA4 measurement id (G-…). Unset = no Google Analytics at all. Public pages only. */
  readonly VITE_GA_MEASUREMENT_ID?: string
  /** Sentry DSN for the signed-in app. Unset = Sentry never loads. */
  readonly VITE_SENTRY_DSN?: string
  /** Release/version tag for Sentry (e.g. the git SHA). */
  readonly VITE_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Navigator {
  /** Global Privacy Control (https://globalprivacycontrol.org) — a "do not sell/share" signal. */
  readonly globalPrivacyControl?: boolean
}
