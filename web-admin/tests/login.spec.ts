import { test, expect } from '@playwright/test'
import { getE2eAdminCredentials } from './e2eCredentials'

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/login')
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
  })

  test('页面正常渲染', async ({ page }) => {
    await expect(page.getByText('欢迎回来')).toBeVisible()
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible()
  })

  test('显示本地开发环境初始化提示', async ({ page }) => {
    await expect(page.getByText('本地开发环境已完成初始化')).toBeVisible()
    await expect(page.getByText(/管理员账号.*admin/)).toBeVisible()
  })

  test('显示当前接口模式为 http', async ({ page }) => {
    await expect(page.getByText('当前接口模式：http')).toBeVisible()
  })

  test('错误密码显示错误信息', async ({ page }) => {
    await page.getByPlaceholder('请输入账号').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('wrongpassword')
    await page.getByRole('button', { name: /登\s*录/ }).click()

    await expect(page.getByText('账号或密码错误')).toBeVisible({ timeout: 10_000 })
  })

  test('正确密码登录成功跳转到控制台', async ({ page }) => {
    const { userName, password } = getE2eAdminCredentials()
    await page.getByPlaceholder('请输入账号').fill(userName)
    await page.getByPlaceholder('请输入密码').fill(password)
    await page.getByRole('button', { name: /登\s*录/ }).click()

    await expect(page).toHaveURL(/\#\/dashboard/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: '控制台' })).toBeVisible()
  })
})
