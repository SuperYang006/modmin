# Modmin

模型驱动的管理后台，基于微信云开发，提供模型定义、权限管理、CRUD 自动生成等能力。

## 目录结构

```text
doc/                设计文档
web-admin/          前端管理后台 (React + Ant Design)
cloudfunctions/     云函数
local-server/       本地云函数调试服务器
shared/             前后端共享类型
configs/            环境与平台配置
scripts/            辅助脚本
```

## 设计文档

| 文档 | 说明 |
|------|------|
| [部署指南](doc/部署指南.md) | 初次部署安装说明，集合与云函数介绍 |
| [运行模式说明](doc/运行模式说明.md) | `mock / http / tcb` 三种运行模式的定位、适用场景与限制 |


## 开发

### 模式一：Mock（仅适合轻量 UI 演示）

```bash
cd web-admin
npm install
npm run dev
# 默认使用 mock 数据，直接访问 http://localhost:5173
```

说明：

1. `mock` 模式不适合作为当前项目的主开发模式。
2. 它更适合极早期静态界面演示，不保证完整覆盖登录、审计、Webhook、定时处理等真实链路。

### 模式二：本地云函数服务（连接真实数据库，推荐日常开发）

确保已完成 [部署指南](doc/部署指南.md) 中的第 1 步（获取自定义登录私钥并放置到 `cloudfunctions/modmin_auth/tcb_custom_login.json`）。

```bash
# 终端 1：启动本地云函数服务
cd local-server
npm install
npm run dev   # nodemon 热重启，修改云函数代码后自动生效

# 终端 2：启动前端
cd web-admin
npm install
npm run dev
```

前端开发模式默认读取 `web-admin/.env.development`，其中已配置 `VITE_API_MODE=http`，会请求本地 `local-server`：

```bash
# 可按需复制为本机覆盖配置，文件不会提交
cp web-admin/.env.development web-admin/.env.development.local
```

说明：

1. `http` 是当前推荐的本地开发模式。
2. 该模式最适合日常功能开发、云函数调试、权限链路验证、审计与 Webhook 联调。
3. `web-admin/.env.development` 作为仓库默认开发配置；如需本机覆盖，请使用 `web-admin/.env.development.local`。

### 模式三：连接云端云函数（tcb 模式）

参考 [部署指南](doc/部署指南.md) 完成完整部署后，复制 `web-admin/.env.production.example` 为 `web-admin/.env.production.local` 并填入云端配置。`npm run build` 会默认使用 production 模式，因此打包时会读取 `VITE_API_MODE=tcb`。

说明：

1. `tcb` 是当前推荐的真实云端联调模式。
2. 首次登录仍依赖 `modmin_auth` 的 HTTP 触发器获取 Ticket。
3. `web-admin/.env.production.example` 用作模板，应提交到仓库；`web-admin/.env.production.local` 用作本机真实配置，不应提交到仓库。

## 运行模式建议

当前项目建议按以下方式使用：

1. `http`：日常本地开发
2. `tcb`：真实云端联调与发布前验证
3. `mock`：有限 UI 演示，不建议承担主开发职责

更详细说明见 [运行模式说明](doc/运行模式说明.md)。

## 环境文件约定

前端环境文件建议按以下职责使用：

1. `web-admin/.env.development`
   仓库默认开发配置。
2. `web-admin/.env.development.local`
   本机开发覆盖配置，不提交到仓库。
3. `web-admin/.env.production.example`
   生产模板配置，提交到仓库供复制参考。
4. `web-admin/.env.production.local`
   本机或当前部署环境的真实生产配置，不提交到仓库。

项目根 `.gitignore` 当前已忽略：

```text
.env.local
.env.*.local
```

因此 `*.local` 文件会自动排除在版本控制之外。
