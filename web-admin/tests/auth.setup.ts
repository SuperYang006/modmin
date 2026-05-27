import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/.auth/user.json'

setup('管理员登录并保存认证状态', async ({ page }) => {
  await page.goto('/#/login')

  // 等待登录表单渲染
  await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible()

  // 填写登录表单
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('admin123...')

  // 点击登录
  await page.getByRole('button', { name: /登\s*录/ }).click()

  // 等待跳转到控制台
  await expect(page).toHaveURL(/\#\/dashboard/, { timeout: 10_000 })

  // 验证登录成功：侧边栏显示用户信息
  await expect(page.getByText('系统管理员')).toBeVisible({ timeout: 5_000 })

  // 保存浏览器状态（localStorage 中的 JWT token）
  await page.context().storageState({ path: authFile })
})
