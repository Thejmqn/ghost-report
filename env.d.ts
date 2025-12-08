/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  // add other VITE_ env vars here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
