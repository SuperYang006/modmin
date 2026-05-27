import { test, expect } from '@playwright/test'

test.describe('控制台', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/dashboard')
    await expect(page.getByRole('heading', { name: '控制台' })).toBeVisible()
  })

  test('统计卡片正常渲染', async ({ page }) => {
    const stats = [
      { label: '模型总数', value: '5' },
      { label: '角色数量', value: '3' },
      { label: '后台用户', value: '2' },
      { label: '字段总数', value: '39' },
    ]

    for (const stat of stats) {
      const card = page.locator(`text=${stat.label}`).locator('..').locator('strong')
      await expect(card).toHaveText(stat.value)
    }
  })

  test('快捷入口按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: /创建模型/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /模型列表/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /角色管理/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Webhook' })).toBeVisible()
    await expect(page.getByRole('button', { name: /操作日志/ })).toBeVisible()
  })

  test('最近模型列表显示 5 个模型', async ({ page }) => {
    await expect(page.getByText('最近模型')).toBeVisible()
    const models = ['用户数据', '基础字段测试', '会员', '资源字段测试', '文章']
    for (const model of models) {
      await expect(page.getByRole('button', { name: new RegExp(model) })).toBeVisible()
    }
  })

  test('待处理项显示未分组模型和权限提醒', async ({ page }) => {
    await expect(page.getByText('存在未分组模型')).toBeVisible()
    await expect(page.getByText('模型权限待确认')).toBeVisible()
  })

  test('点击"模型列表"快捷按钮跳转到模型列表页', async ({ page }) => {
    await page.getByRole('button', { name: /模型列表/ }).click()
    await expect(page).toHaveURL(/\#\/config\/models/, { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: '模型列表' })).toBeVisible()
  })
})
