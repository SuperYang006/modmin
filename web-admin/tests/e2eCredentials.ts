export function getE2eAdminCredentials() {
  const userName = process.env.E2E_ADMIN_USERNAME ?? 'e2e_admin'
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!password) {
    throw new Error('缺少 E2E_ADMIN_PASSWORD，请设置 e2e_admin 测试账号密码后再运行 Playwright')
  }

  return { userName, password }
}
