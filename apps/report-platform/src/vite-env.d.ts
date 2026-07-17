/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REPORT_API_BASE_URL?: string;
  readonly VITE_REPORT_ALLOW_FIXTURE_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
