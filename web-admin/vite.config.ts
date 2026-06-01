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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }
            if (id.includes('/node_modules/@ant-design/icons/')) {
              return 'vendor-antd'
            }
            if (id.includes('/node_modules/antd/')) {
              return 'vendor-antd'
            }
            if (
              id.includes('/node_modules/react/')
              || id.includes('/node_modules/react-dom/')
              || id.includes('/node_modules/react-router')
              || id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react'
            }
            if (
              id.includes('/node_modules/@wangeditor/')
              || id.includes('/node_modules/slate/')
              || id.includes('/node_modules/slate-history/')
              || id.includes('/node_modules/snabbdom/')
            ) {
              return 'vendor-editor'
            }
            if (id.includes('/node_modules/vditor/')) {
              return 'vendor-markdown'
            }
            if (id.includes('/node_modules/@cloudbase/') || id.includes('/node_modules/bson/')) {
              return 'vendor-cloudbase'
            }
            if (
              id.includes('/node_modules/@dnd-kit/')
              || id.includes('/node_modules/immer/')
            ) {
              return 'vendor-dnd'
            }
            return undefined
          },
        },
      },
    },
  }
})
