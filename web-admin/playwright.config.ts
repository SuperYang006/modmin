import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const authFile = 'tests/.auth/user.json'

// 从 .env.e2e.local 读取 e2e 凭证（仅本地，已 gitignore）。已存在的环境变量优先，
// 这样命令行内联 E2E_ADMIN_PASSWORD=xxx 仍可覆盖文件值，CI 也无需该文件。
function loadE2eEnv() {
  try {
    const content = readFileSync('.env.e2e.local', 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      if (process.env[key] !== undefined) continue
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // 文件不存在时忽略，凭证可由命令行环境变量提供
  }
}

loadE2eEnv()

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: './playwright-report' }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 认证准备：登录一次，保存状态
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 登录页测试：不需要认证状态
    {
      name: 'login-tests',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // 需要认证的测试：使用已保存的登录状态
    {
      name: 'authenticated-tests',
      testMatch: /^(?!.*login\.spec\.ts).*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],

  /* 自动启动 dev server */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
