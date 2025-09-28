/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly ADMIN_USERNAME: string;
  readonly ADMIN_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}