// 在 require 云函数之前必须设置合法的 JWT_SECRET，否则模块顶层校验会抛错。
export const TEST_JWT_SECRET = 'test_jwt_secret_thirty_two_chars_minimum_aaaa'
process.env.MODMIN_JWT_SECRET = TEST_JWT_SECRET
