/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPSEEK_API_KEY: string
  readonly VITE_DEEPSEEK_API_BASE: string
  readonly VITE_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
