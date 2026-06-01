import { test, expect } from '@playwright/test'

test.describe('模型列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/config/models')
    await expect(page.getByRole('heading', { name: '模型列表' })).toBeVisible()
  })

  test('表格渲染模型行', async ({ page }) => {
    const rows = page.locator('.ant-table-row')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThanOrEqual(1)
  })

  test('表格列头完整', async ({ page }) => {
    const headers = ['模型名称', '模型说明', '集合名称', '字段数', '更新时间', '操作']
    for (const header of headers) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible()
    }
  })

  test('每行显示编辑和删除按钮', async ({ page }) => {
    const firstRow = page.locator('.ant-table-row').first()
    await expect(firstRow.getByRole('button', { name: /编辑模型/ })).toBeVisible()
    await expect(firstRow.getByRole('button', { name: /删除模型/ })).toBeVisible()
  })

  test('搜索框可见', async ({ page }) => {
    await expect(page.getByPlaceholder('搜索模型名称、集合名')).toBeVisible()
  })

  test('分页显示总数', async ({ page }) => {
    const total = page.getByText(/共 \d+ 条/)
    await expect(total).toBeVisible()
    const count = Number((await total.innerText()).match(/\d+/)?.[0])
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('面包屑导航正确', async ({ page }) => {
    const breadcrumb = page.getByRole('navigation')
    await expect(breadcrumb.getByText('系统配置')).toBeVisible()
    await expect(breadcrumb.getByText('模型中心')).toBeVisible()
    await expect(breadcrumb.getByText('模型列表')).toBeVisible()
  })

  test('包含预期的模型', async ({ page }) => {
    const models = ['用户数据', '文章', '会员', '资源字段测试', '基础字段测试']
    for (const model of models) {
      await expect(page.getByText(model).first()).toBeVisible()
    }
  })
})
