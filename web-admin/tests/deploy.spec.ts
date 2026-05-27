import { test, expect } from '@playwright/test'

test.describe('本地部署工具', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/dev/deploy')
    await expect(page.getByRole('heading', { name: '本地部署工具' })).toBeVisible()
  })

  test('页面标题和 DEV ONLY 标签', async ({ page }) => {
    const banner = page.getByRole('banner')
    await expect(banner.getByText('DEV ONLY')).toBeVisible()
  })

  test('环境概览区域显示配置状态', async ({ page }) => {
    await expect(page.getByText('环境概览')).toBeVisible()
    await expect(page.getByText('执行入口')).toBeVisible()
    await expect(page.getByText('http://localhost:3100')).toBeVisible()
    await expect(page.getByText('配置回填')).toBeVisible()
  })

  test('显示已检测到现有部署配置提示', async ({ page }) => {
    await expect(page.getByText('已检测到现有部署配置')).toBeVisible()
    await expect(page.getByText(/已从 local-server/)).toBeVisible()
  })

  test('基础连接区域字段完整', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '目标环境与执行凭据' })).toBeVisible()
    await expect(page.getByText('CloudBase 环境 ID')).toBeVisible()
    await expect(page.getByText('上海（ap-shanghai）')).toBeVisible()
  })

  test('"改为手动输入"按钮切换后显示输入框', async ({ page }) => {
    const envIdSection = page.locator('#envId')
    await envIdSection.getByRole('button', { name: '改为手动输入' }).click()

    await expect(envIdSection.getByRole('textbox')).toBeVisible()
    await expect(envIdSection.getByRole('button', { name: '改回沿用' })).toBeVisible()

    // 点击"改回沿用"恢复
    await envIdSection.getByRole('button', { name: '改回沿用' }).click()
    await expect(envIdSection.getByText(/已检测到现有环境 ID/)).toBeVisible()
  })

  test('JWT 密钥区域完整', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'JWT、触发器与前端路径' })).toBeVisible()
    await expect(page.getByPlaceholder(/至少 32 字符/)).toBeVisible()
    await expect(page.getByRole('button', { name: '生成新 JWT 密钥' })).toBeVisible()
  })

  test('"生成新 JWT 密钥"按钮更新密钥值', async ({ page }) => {
    const jwtInput = page.getByPlaceholder(/至少 32 字符/)
    const oldValue = await jwtInput.inputValue()

    await page.getByRole('button', { name: '生成新 JWT 密钥' }).click()

    await expect(jwtInput).not.toHaveValue(oldValue, { timeout: 3_000 })
    const newValue = await jwtInput.inputValue()
    expect(newValue.length).toBeGreaterThanOrEqual(32)
  })

  test('管理员初始化区域完整', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '首个管理员与覆盖策略' })).toBeVisible()
    // 管理员账号输入框（placeholder 为 admin）
    await expect(page.getByPlaceholder('admin')).toBeVisible()
    // 管理员显示名输入框
    await expect(page.getByPlaceholder('系统管理员')).toBeVisible()
    // 覆盖复选框
    await expect(page.getByRole('checkbox', { name: /覆盖已存在的管理员账号/ })).toBeVisible()
  })

  test('勾选覆盖管理员后密码变为必填', async ({ page }) => {
    // 初始状态：密码框 placeholder 为"已有管理员且不覆盖时可留空"
    await expect(page.getByPlaceholder('已有管理员且不覆盖时可留空')).toBeVisible()

    // 勾选覆盖
    await page.getByRole('checkbox', { name: /覆盖已存在的管理员账号/ }).check()

    // placeholder 变为"覆盖管理员账号时必填"
    await expect(page.getByPlaceholder('覆盖管理员账号时必填')).toBeVisible()
  })

  test('未勾选覆盖时风险提醒显示未覆盖', async ({ page }) => {
    await expect(page.getByText(/当前未勾选覆盖管理员账号/)).toBeVisible()
  })

  test('JWT 密钥为空时提交显示校验错误', async ({ page }) => {
    const jwtInput = page.getByPlaceholder(/至少 32 字符/)
    await jwtInput.fill('')

    await page.getByRole('button', { name: /提交部署任务/ }).click()
    await expect(page.getByText('请输入 JWT 密钥')).toBeVisible({ timeout: 5_000 })
  })

  test('任务状态区域初始显示', async ({ page }) => {
    await expect(page.getByText('任务状态', { exact: true })).toBeVisible()
    await expect(page.getByText('尚未提交部署任务')).toBeVisible()
  })

  test('本次提交影响区域显示', async ({ page }) => {
    await expect(page.getByText('本次提交影响')).toBeVisible()
  })

  test('填写建议区域显示', async ({ page }) => {
    await expect(page.getByText('填写建议')).toBeVisible()
  })

  test('部署日志区域初始显示', async ({ page }) => {
    await expect(page.getByText('部署日志', { exact: true })).toBeVisible()
    await expect(page.getByText(/提交后这里会持续显示/)).toBeVisible()
  })
})
