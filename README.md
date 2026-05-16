# Modmin

Modmin（中文读法接近摩德敏）是一个基于微信云开发（CloudBase）的模型驱动管理后台模板。

它的目标不是做通用 SaaS 平台，而是帮助单个业务项目更快搭建一套可部署、可鉴权、可按模型生成 CRUD 页面的后台系统。

## 核心能力

1. 模型定义与字段配置
2. 基于模型生成 CRUD 页面
3. 后台账号、角色与权限管理
4. CloudBase 云函数统一承载后端逻辑
5. 审计日志与 Webhook 基础能力

## 适用场景

适合：

1. 基于微信云开发搭建独立业务后台。
2. 需要“模型配置 + 后台生成”能力的项目。
3. 希望前端、权限、CRUD、部署方式保持统一的团队。

不适合：

1. 多租户 SaaS 平台。
2. 完整低代码页面设计器。
3. 无 CloudBase 依赖的通用 Node.js 后台脚手架。

## 技术栈

1. 前端：React 18 + Vite + Ant Design
2. 后端：CloudBase 云函数
3. 数据：CloudBase 数据库（云环境自带的mangoDB）
4. 测试：Vitest

## 仓库结构

```text
doc/                部署指南等公开文档
web-admin/          前端管理后台
cloudfunctions/     云函数
local-server/       本地云函数调试服务器（约等于本地调用云函数的功能，避免本地开发时修改云函数频繁部署更新云函数）
shared/             前后端共享类型
configs/            环境与平台配置
scripts/            部署与辅助脚本
tests/              测试
```

## 文档入口

1. [部署指南](doc/部署指南.md)
2. [运行模式说明](doc/运行模式说明.md)

如果你是第一次接触这个项目，建议先读部署指南，再看运行模式说明。

## 快速开始

### 1. 安装依赖

在仓库根目录执行：

```bash
npm install
```

前端和本地调试服务各自也有独立依赖：

```bash
npm --prefix web-admin install
npm --prefix local-server install
```

### 2. 先完成部署前准备

在真正运行前，至少需要准备：

1. 一个CloudBase环境（微信云开发）
2. 自定义登陆的密钥文件（tcb_custom_login.json）
3. 云开发环境的secretId、secretKey

完整步骤见：

[`doc/部署指南.md`](doc/部署指南.md)

### 3. 选择运行模式

当前项目支持三种模式：

1. `mock`
2. `http`
3. `tcb`

推荐顺序：

1. `http`：日常本地开发
2. `tcb`：真实云端联调
3. `mock`：轻量演示

更详细说明见：

[`doc/运行模式说明.md`](doc/运行模式说明.md)

## 本地开发

### 方式一：Mock 模式

适合轻量 UI 演示，不适合作为主开发模式，因为很多核心功能需要依赖云函数功能，mock很难覆盖。

```bash
cd web-admin
npm run dev
```

### 方式二：本地云函数服务（http模式）

这是当前推荐的日常开发方式。

先启动本地云函数服务：

```bash
cd local-server
npm run dev
```

再启动前端：

```bash
cd web-admin
npm run dev
```

默认情况下，前端开发模式会读取 `web-admin/.env.development`，并请求本地 `http://localhost:3100`。

### 方式三：连接云端环境（tcb模式）

完成部署后，复制并填写：

```bash
cp web-admin/.env.production.example web-admin/.env.production.local
```

然后在启动前端：

```bash
cd web-admin
npm run dev
```

## 常用命令

仓库根目录常用命令如下：

```bash
npm test
npm run test:watch
npm run setup
npm run tcb:login
npm run deploy:fn
npm run deploy:fn:single -- modmin_auth
npm run build:web
npm run deploy:web
npm run deploy:all
```

说明：部署到正式环境的话，强烈建议使用命令`npm run setup`，运行命令后会启动modmin一键部署向导。

## 环境文件约定

前端环境文件职责如下：

1. `web-admin/.env.development`：本地默认开发配置，一般不用改动
2. `web-admin/.env.production.example`：生产模板配置示例
3. `web-admin/.env.production.local`：真实生产配置，部署到云开发的静态托管时会使用本配置

## 测试

运行全部测试：

```bash
npm test
```

监听模式：

```bash
npm run test:watch
```

## 当前公开范围说明

为了保证公开仓库可控，当前仓库只保留公开使用者需要的文档与代码。

以下内容不会进入公开仓库：

1. 私有规划文档
2. 本地凭据
3. CloudBase 自定义登录私钥
4. 本机环境覆盖配置

## 状态说明

当前项目仍处于持续整理阶段，但已经具备：

1. 基础部署路径
2. 云函数与前端主流程
3. 基础测试
4. 模型驱动 CRUD 主链路

如果你准备试用，建议优先按部署指南完整走一遍，而不是直接从页面代码开始看。
