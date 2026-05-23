# Modmin AI 编码约束

本文档用于约束 AI 编码代理在本项目中的实现方式。所有代码变更必须优先考虑可读性、可维护性、可扩展性、行为稳定性和测试可验证性。

## 总原则

1. 不要为了快速完成需求，把多个职责堆进一个文件或一个函数里。
2. 优先遵循现有代码结构和命名风格。
3. 重构应小步进行，每一步都保持行为不变并运行相关测试。
4. 不引入无必要抽象，但应保留清晰扩展点。
5. 不复制粘贴已有逻辑，优先抽共享函数或模块。

## 指令优先级

当规则之间存在冲突时，按以下优先级处理：

1. 用户本轮明确要求优先。
2. 不破坏现有接口入参、响应结构、错误码、数据库字段和权限语义。
3. 遵循本文档的模块边界、测试要求和构建验证要求。
4. 保持现有代码结构、命名风格和运行方式。

## 文件规模

云函数入口文件只负责：

1. 初始化依赖。
2. 组装模块。
3. action 分发。
4. 顶层错误处理。

建议：

1. `index.js` 控制在 100 行以内。
2. 单个业务模块尽量控制在 300 行以内。
3. 超过 500 行必须优先考虑拆分。
4. 字段、权限、查询、响应、认证、事件等能力必须模块化。

## 推荐云函数结构

```text
src/
  index.js              # 入口、依赖组装、action map
  response.js           # success / fail / parseEvent
  auth.js               # token / operator / session
  actions.js            # action 主流程
  fields.js             # 字段校验和标准化
  query.js              # 查询构造
  permissions.js        # 权限校验
  events.js             # audit / webhook 事件出口
```

具体文件名可以按云函数职责调整，但职责边界必须清晰。

## Action 分发

禁止在入口写长串 `if` 分发：

```js
if (action === 'a') return a()
if (action === 'b') return b()
```

必须优先使用 action map：

```js
const ACTION_HANDLERS = {
  login,
  logout,
}

const handler = ACTION_HANDLERS[action]
return handler ? await handler(request) : fail(requestId, 40002, 'illegal action')
```

## 新增云函数 action

新增云函数 action 时必须同步检查：

1. action 实现必须放入独立职责模块，不直接堆进 `index.js`。
2. `actions.js` 只负责聚合 action 模块。
3. `index.js` 只负责注册 action map 和顶层错误处理。
4. 前端调用必须走 `runtime/loader` 或 `services`，页面和组件不直接写 CloudBase 调用细节。
5. API 入参和响应类型优先放入 `shared/types/`，前端从 `web-admin/src/types/` 导出使用。
6. mock 模式必须补对应 mock handler，保证页面主流程可渲染。
7. 至少补一条正常路径测试和一条权限或异常路径测试。

## 模块边界

优先按职责拆分：

1. 响应格式独立。
2. token / session 独立。
3. 权限校验独立。
4. 查询构造独立。
5. 字段校验独立。
6. CRUD 主流程独立。
7. audit / webhook 事件独立。

不要在一个函数里同时做：

1. 参数解析。
2. 权限判断。
3. 数据校验。
4. 数据库写入。
5. 日志写入。
6. Webhook 投递。
7. 响应格式化。

## 扩展点

所有业务写操作应预留事件出口：

```text
业务操作成功
  -> emitAuditLog
  -> enqueueWebhookDeliveries
```

不要把日志、Webhook、告警逻辑直接散落在 `create/update/delete/login` 等函数中。应通过集中事件模块接入。

## 行为变更

重构时必须遵守：

1. 不改变现有接口入参。
2. 不改变现有响应结构。
3. 不改变现有错误码。
4. 不改变数据库字段。
5. 不改变权限语义。
6. 每一步重构后必须运行相关测试。

## 测试要求

修改云函数后至少运行对应测试：

```bash
npm test -- tests/auth.test.js
npm test -- tests/crud.test.js
npm test
```

按变更类型选择测试：

1. 修改认证、登录态、session：`npm test -- tests/auth.test.js`
2. 修改 CRUD：`npm test -- tests/crud.test.js`
3. 修改权限系统：`npm test -- tests/permission-system.test.js tests/permission-runtime.test.js`
4. 修改 schema 或 runtime schema：`npm test -- tests/permission-schema.test.js tests/permission-runtime.test.js`
5. 修改 webhook：`npm test -- tests/webhook.test.js`
6. 修改 audit：`npm test -- tests/audit.test.js`
7. 修改共享类型、跨模块契约或多个云函数：必须运行 `npm test`

如果没有运行测试，必须在最终说明中明确未验证项和风险。

## 编码风格

1. 优先使用清晰命名，不依赖注释解释混乱逻辑。
2. 只在复杂逻辑前添加必要注释。
3. 默认使用 CommonJS，保持现有云函数风格。
4. 不引入新的构建体系，除非需求明确需要。
5. 不把前端、云函数、部署脚本的职责混在一起。
6. 不在重构中夹带无关格式化或无关行为修改。

## 云函数共享代码

云函数运行时彼此独立，不能依赖运行时共享内存或兄弟目录文件。

共享代码约定：

1. 前后端共享类型放在 `shared/types/`。
2. 云函数运行时共享工具源码通过同步脚本复制到各云函数包内的 `shared/`。
3. 云函数运行时不得 `require` 兄弟云函数目录或仓库根目录源码。

第一阶段云函数共享工具推荐采用：

```text
共享源码 + 部署前同步 + 云函数包内直接调用
```

也就是：

1. 维护唯一共享源码。
2. 部署前同步到需要使用的云函数目录。
3. 云函数运行时只 `require` 自己包内的共享模块。

不要让业务云函数为了基础工具能力同步调用另一个云函数，除非该调用本身就是业务边界。

## 权限边界

1. 系统配置、后台用户、角色权限、Webhook、审计日志默认只允许超级管理员访问。
2. 普通角色只能获取自己有权限的业务模型、业务字段和业务数据。
3. 新增聚合接口时，不能把系统级统计、敏感配置或其他角色权限数据暴露给普通角色。
4. 前端隐藏入口不能替代后端权限校验。
5. 权限相关变更必须优先补测试，至少覆盖超级管理员、普通角色和无权限路径。

## 项目重点规则

本项目最重要的长期规则：

```text
index.js 只做入口，业务逻辑一律进模块。
```

## 前端工程约束

前端代码必须优先保证页面结构清晰、状态可控、数据流可追踪。

### 页面职责

页面文件只负责：

1. 页面级数据加载。
2. 页面级状态组织。
3. 页面布局。
4. 组合业务组件。

页面文件不应长期承担：

1. 复杂表单字段构造。
2. 复杂数据转换。
3. API 请求细节。
4. 大量表格列定义。
5. 深层业务判断。
6. 可复用交互逻辑。

页面超过 300 行应优先考虑拆分。

### 推荐目录结构

```text
src/pages/<feature>/
  <FeaturePage>.tsx
  components/
  hooks/
  services/
  normalizers/
  constants.ts
  types.ts
```

跨页面能力应放到：

```text
src/components/
src/runtime/
src/services/
src/types/
```

### 数据访问

页面和组件不要直接写 CloudBase 调用细节。

推荐调用链：

```text
页面 / hook
  -> runtime/loader 或 services
  -> services/cloud / services/tcb
```

API 入参、响应结构应有明确类型。

### Mock 模式

新增前端 loader 或云函数 action 时，应同步补 mock handler。

mock 数据不要求完整复刻真实后端逻辑，但必须保证：

1. 页面主流程可渲染。
2. loading、empty、error 等关键状态不被 mock 阻塞。
3. mock 响应结构和真实接口响应结构一致。

### 表单

复杂表单必须拆分。

推荐：

```text
<FieldConfigModal />
<SystemFieldSettingsCard />
<RolePermissionDrawer />
```

表单规则、默认值、字段转换不应散落在 JSX 中。

建议拆到：

```text
fieldValueBuilders.ts
fieldValueValidators.ts
normalizers/
```

### 表格

复杂 columns 不应长期内联在页面里。

推荐：

```text
columns.tsx
components/
```

表格行操作应封装成清晰函数，不要在 `render` 内写复杂业务流程。

### 状态管理

优先使用局部状态。

只有跨页面共享时才放到：

```text
context/
runtime/
services/
```

不要为了单页面状态引入全局状态。

### 组件设计

组件应保持单一职责：

1. 展示组件只负责展示。
2. 表单组件只负责输入和校验。
3. 容器组件负责数据加载和状态组织。
4. 运行时组件负责基于 schema 渲染，不承载具体业务模型逻辑。

组件 props 应清晰，不传巨大对象让组件内部猜行为。

### 运行时引擎

`runtime` 目录属于核心能力，修改时必须谨慎。

涉及以下内容必须优先补测试或手动验证：

1. 字段类型渲染。
2. 字段值标准化。
3. CRUD loader。
4. 权限可见性。
5. 运行时 schema normalize。
6. 关系字段加载。

### 富文本与资源 URL

1. 富文本图片当前以公开可访问 URL 写入 `img.src`，客户端依赖该 URL 直接渲染。
2. 不要在保存富文本时把 `img.src` 强制替换为 `fileID`、`cloud://` 或其他客户端无法直接访问的资源标识。
3. 如果未来要切换为 `fileID` 存储策略，必须同步修改客户端渲染、后台预览、详情展示、mock 数据和迁移方案。
4. 修改富文本相关逻辑后，应至少验证上传图片、粘贴图片、保存、重新打开和详情页展示。

### UI 风格

前端 UI 必须保持现有后台系统风格：

1. 信息密度适中。
2. 不做营销型 hero。
3. 不使用过度装饰。
4. 优先使用 Ant Design 现有组件。
5. 表单、表格、抽屉、弹窗保持一致交互。
6. 错误提示必须靠近操作区域，长页面需要底部汇总或定位能力。

### 可访问性和可用性

1. 保存、删除、禁用等危险操作必须有确认。
2. 长表单保存失败时必须让用户能定位错误字段。
3. loading、empty、error 状态必须完整。
4. 按钮文案要明确，不使用模糊动作。
5. 表格操作列要保持稳定宽度。

### 构建验证

前端变更后至少运行：

```bash
npm --prefix web-admin run build
```

如果改了复杂交互，应说明是否做过手动验证。

## 交付前检查

完成变更前必须检查：

1. 运行 `git status --short`，确认只改了与任务相关的文件。
2. 说明已运行的测试和构建命令。
3. 如果启动了 dev server，最终说明访问地址。
4. 不再需要的本轮临时进程应停止；用户已有服务不要随意停止。
5. 如果存在未验证项，必须说明风险和原因。
