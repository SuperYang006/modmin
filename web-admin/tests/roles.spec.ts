import { test, expect } from '@playwright/test'

test.describe('角色管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/config/roles')
    await expect(page.getByRole('heading', { name: '角色管理' })).toBeVisible()
  })

  test('表格正确渲染 3 个角色', async ({ page }) => {
    const rows = page.locator('.ant-table-row')
    await expect(rows).toHaveCount(3)
  })

  test('表格列头完整', async ({ page }) => {
    const headers = ['角色编码', '角色名称', '描述', '状态', '操作']
    for (const header of headers) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible()
    }
  })

  test('包含超级管理员角色', async ({ page }) => {
    const table = page.getByRole('table').first()
    await expect(table.getByText('role_super_admin')).toBeVisible()
    await expect(table.getByText('超级管理员', { exact: true })).toBeVisible()
    await expect(table.getByText('内置').first()).toBeVisible()
  })

  test('包含运营人员角色', async ({ page }) => {
    await expect(page.getByText('role_operator')).toBeVisible()
    await expect(page.getByText('运营人员')).toBeVisible()
  })

  test('超级管理员的"配置权限"按钮禁用', async ({ page }) => {
    const rows = page.locator('.ant-table-row')
    // 超级管理员是第二行
    const superAdminRow = rows.nth(1)
    await expect(superAdminRow.getByText('role_super_admin')).toBeVisible()
    await expect(superAdminRow.getByRole('button', { name: /配置权限/ })).toBeDisabled()
  })

  test('普通角色的"配置权限"按钮可用', async ({ page }) => {
    const rows = page.locator('.ant-table-row')
    // 运营人员是第三行
    const operatorRow = rows.nth(2)
    await expect(operatorRow.getByText('role_operator')).toBeVisible()
    await expect(operatorRow.getByRole('button', { name: /配置权限/ })).toBeEnabled()
  })

  test('新建角色按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: /新建角色/ })).toBeVisible()
  })

  test('分页显示正确', async ({ page }) => {
    await expect(page.getByText('共 3 条')).toBeVisible()
  })
})
