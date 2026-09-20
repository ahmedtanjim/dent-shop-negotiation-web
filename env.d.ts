/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  /** The CRM web app's origin (default https://app.dentshopmanager.com). */
  readonly VITE_CRM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
