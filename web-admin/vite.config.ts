import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const base = command === 'build' ? (env.VITE_BASE_PATH || '/') : '/'
  const isBuild = command === 'build'

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        ...(isBuild
          ? {
              '@/app/devOnlyNavigation': path.resolve(__dirname, './src/app/devOnlyNavigation.empty.ts'),
              '@/pages/dev-deploy/DevDeployPage': path.resolve(__dirname, './src/pages/dev-deploy/empty.ts'),
            }
          : {}),
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
