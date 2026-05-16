/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE: 'mock' | 'http' | 'tcb'
  readonly VITE_MODMIN_ENV_ID: string
  readonly VITE_MODMIN_REGION: string
  readonly VITE_MODMIN_FUNCTION_PREFIX: string
  readonly VITE_MODMIN_AUTH_LOGIN_URL: string
  readonly VITE_BASE_PATH: string
  readonly VITE_LOCAL_SERVER_URL: string
}
