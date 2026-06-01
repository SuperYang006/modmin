# 前端 E2E 测试说明

使用 Playwright，跑在 `http` 模式（`.env.development` 里 `VITE_API_MODE=http`），
请求打到本地 server（默认 `http://localhost:3100`）。运行前需先启动 `local-server`。

## 专用测试账号 e2e_admin

测试的真实登录统一使用 `e2e_admin`，**不要用日常开发的 `admin`**。
原因：后端登录会删除该用户已有的全部 session（`cloudfunctions/modmin_auth/src/actions.js`
登录时清旧 session 再建新的），若测试登录 `admin`，会把你浏览器里 `admin` 的登录态踢掉。

账号要求：
- 用户名 `e2e_admin`，角色与 `admin` 一致（超级管理员），否则 `authenticated-tests`
  可能因权限看不到模型列表等数据而失败。
- 密码通过环境变量 `E2E_ADMIN_PASSWORD` 传入（不写死在 spec 里）。
  用户名可用 `E2E_ADMIN_USERNAME` 覆盖，默认 `e2e_admin`。

## 运行

凭证通过环境变量传入，有两种方式（命令行优先级更高）：

**方式一：`.env.e2e.local` 文件（推荐）**

```bash
cd web-admin
cp .env.e2e.local.example .env.e2e.local
# 编辑 .env.e2e.local 填入 E2E_ADMIN_PASSWORD
npx playwright test
```

`.env.e2e.local` 已 gitignore，不会提交。`playwright.config.ts` 启动时自动读取它；
已存在的同名环境变量优先，因此命令行仍可临时覆盖。

**方式二：命令行内联**

```bash
cd web-admin
E2E_ADMIN_PASSWORD='你的密码' npx playwright test
```

`setup` project 只执行一次真实登录并把状态存到 `tests/.auth/user.json`（已 gitignore），
其余 `authenticated-tests` 复用该状态，不重复登录。

## 注意

- 跑 e2e 只会影响 `e2e_admin` 的登录态，不影响日常浏览器里的 `admin`。
- 云开发是共享真实环境、无独立本地库，数据会持续增长。涉及全局数量的断言
  （模型 / 角色 / 后台用户总数、列表行数、「共 N 条」）统一用下界（`>=`），
  避免正常新增数据导致测试假失败；具体内容存在性校验仍保留。
