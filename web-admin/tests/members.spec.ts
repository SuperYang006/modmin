import { test, expect } from '@playwright/test'

test.describe('会员管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/generated/member_list')
    await expect(page.getByRole('columnheader', { name: '昵称' })).toBeVisible({ timeout: 10_000 })
  })

  test('表格列头完整', async ({ page }) => {
    const headers = ['昵称', '手机号', '会员等级', '积分', '文档 ID', '系统创建时间', '系统更新时间', '操作']
    for (const header of headers) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible()
    }
  })

  test('筛选条件栏默认展开', async ({ page }) => {
    await expect(page.getByText('筛选条件')).toBeVisible()
    await expect(page.getByRole('button', { name: '查 询' })).toBeVisible()
  })

  test('每行显示操作按钮', async ({ page }) => {
    const firstRow = page.locator('.ant-table-row').first()
    await expect(firstRow.getByRole('button', { name: /详\s*情/ })).toBeVisible()
    await expect(firstRow.getByRole('button', { name: /编\s*辑/ })).toBeVisible()
    await expect(firstRow.getByRole('button', { name: /删\s*除/ })).toBeVisible()
  })

  test('新增按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: /新\s*增/ })).toBeVisible()
  })

  test('点击详情打开只读弹窗', async ({ page }) => {
    const firstRow = page.locator('.ant-table-row').first()
    await firstRow.getByRole('button', { name: /详\s*情/ }).click()

    const drawer = page.locator('.ant-drawer')
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    await expect(drawer.getByText('记录详情')).toBeVisible()
    await expect(drawer.getByText('只读查看')).toBeVisible()
    await expect(drawer.getByText('系统字段', { exact: true })).toBeVisible()
    await expect(drawer.getByText('业务信息', { exact: true })).toBeVisible()

    // 关闭弹窗
    await drawer.getByRole('button', { name: /关\s*闭/ }).first().click()
    await expect(drawer).not.toBeVisible({ timeout: 5_000 })
  })

  test('点击详情后点编辑跳转到编辑页', async ({ page }) => {
    const firstRow = page.locator('.ant-table-row').first()
    await firstRow.getByRole('button', { name: /详\s*情/ }).click()

    const drawer = page.locator('.ant-drawer')
    await expect(drawer).toBeVisible({ timeout: 5_000 })

    await drawer.getByRole('button', { name: /编\s*辑/ }).click()
    await expect(page).toHaveURL(/\/edit$/, { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: '编辑记录' })).toBeVisible()
  })
})

test.describe('会员编辑表单', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/generated/member_list')
    await expect(page.getByRole('columnheader', { name: '昵称' })).toBeVisible({ timeout: 10_000 })

    const firstRow = page.locator('.ant-table-row').first()
    await firstRow.getByRole('button', { name: /编\s*辑/ }).click()
    await expect(page.getByRole('heading', { name: '编辑记录' })).toBeVisible({ timeout: 5_000 })
  })

  test('系统字段为只读', async ({ page }) => {
    await expect(page.getByText('系统字段')).toBeVisible()
    await expect(page.getByText('文档 ID').first()).toBeVisible()
    await expect(page.getByText('系统创建时间')).toBeVisible()
  })

  test('业务字段可编辑', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: /最多 50 个字符/ })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /长度需为 11 个字符/ })).toBeVisible()
  })

  test('保存和取消按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: /保\s*存/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /取\s*消/ })).toBeVisible()
  })

  test('返回列表按钮可用', async ({ page }) => {
    await expect(page.getByRole('button', { name: /返回列表/ })).toBeVisible()
  })
})
