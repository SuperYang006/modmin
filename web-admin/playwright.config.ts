import { defineConfig, devices } from '@playwright/test'

const authFile = 'tests/.auth/user.json'

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
