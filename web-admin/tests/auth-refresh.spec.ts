import { test, expect } from '@playwright/test'

// 验证 cloud.ts 的反应式兜底：业务请求拿到 40102（access token 过期）时，
// 应自动刷新一次并重发原请求，而不是直接把用户踢回登录页。
// e2e 跑在 http 模式（.env.development），请求打到本地 server，可用 page.route 拦截。

function readAction(request: import('@playwright/test').Request): string {
  try {
    return (request.postDataJSON() as { action?: string })?.action ?? ''
  } catch {
    return ''
  }
}

test.describe('登录态无感刷新', () => {
  test('业务请求收到 40102 时自动刷新并重发，不跳登录页', async ({ page }) => {
    let schemaHits = 0
    let injectedExpiry = false

    // 第一次 listCollectionSchemas 强制返回过期，重发时放行到真实 server 拿真实数据渲染页面。
    // 刷新接口被 stub（见下），不轮换服务端 session，因此这条测试不依赖其它并行 spec 的登录态。
    await page.route('**/modmin_schema', async (route) => {
      const request = route.request()
      if (readAction(request) === 'listCollectionSchemas') {
        schemaHits += 1
        if (!injectedExpiry) {
          injectedExpiry = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: 40102, message: '登录态已过期', data: null }),
          })
          return
        }
      }
      await route.continue()
    })

    let refreshCalled = false
    await page.route('**/modmin_auth', async (route) => {
      if (readAction(route.request()) !== 'refreshToken') {
        await route.continue()
        return
      }

      refreshCalled = true
      const session = await page.evaluate(() => JSON.parse(window.localStorage.getItem('modmin_auth_session') ?? '{}'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { ...session, expireTime: Date.now() + 15 * 60 * 1000 },
        }),
      })
    })

    await page.goto('/#/config/models')

    // 重发成功后页面正常渲染，且没有被踢到登录页
    await expect(page.getByRole('heading', { name: '模型列表' })).toBeVisible()
    await expect(page).not.toHaveURL(/\#\/login/)

    expect(injectedExpiry).toBe(true)
    expect(refreshCalled).toBe(true)
    // 同一请求被发了至少两次：首次 40102 + 刷新后重发
    expect(schemaHits).toBeGreaterThanOrEqual(2)
  })

  test('刷新失败时跳转登录页', async ({ page }) => {
    // 业务请求恒返回过期，刷新接口恒失败 → 无法挽救 → 应跳登录页
    await page.route('**/modmin_schema', async (route) => {
      if (readAction(route.request()) === 'listCollectionSchemas') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 40102, message: '登录态已过期', data: null }),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/modmin_auth', async (route) => {
      if (readAction(route.request()) === 'refreshToken') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 40102, message: '登录态已过期，请重新登录', data: null }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/#/config/models')

    await expect(page).toHaveURL(/\#\/login/, { timeout: 10_000 })
  })
})
