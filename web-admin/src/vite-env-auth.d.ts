interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'tcb'
  readonly VITE_MODMIN_ENV_ID?: string
  readonly VITE_MODMIN_REGION?: string
  readonly VITE_MODMIN_FUNCTION_PREFIX?: string
  readonly VITE_MODMIN_AUTH_LOGIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
