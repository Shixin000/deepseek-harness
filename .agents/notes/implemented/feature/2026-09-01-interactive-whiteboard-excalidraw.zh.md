# Agent Note：交互白板——图表卡片之上的 Excalidraw 编辑器

Status: implemented

[English](2026-09-01-interactive-whiteboard-excalidraw.md) | 中文

## 问题

阶段一产出了只读图表卡片：模型画、用户看。显然的下一步是真正的画布——用户编辑产出的 `.excalidraw` 文件并保存回去，闭合文件契约已打开的回路。客户端 bundle 管线此前没有嵌入重型第三方编辑器的先例，覆盖层的跨 scope 共享状态也未被验证。

## 决策

新增 `packages/client/ui-diagram-canvas`：注册在 `shell.overlay` list 座位的全屏 Excalidraw 编辑器覆盖层，从图表卡片新增的 `diagram.card.open` 打开动作链打开，后端是 `@deepseek-ai/dsh-diagram` 上的 Host Remote 网关（`diagram.save` / `diagram.read`），经会话 `fs` seam 写入。

### 嵌入编辑器：单一可发布产物

`@excalidraw/excalidraw@0.18` 懒加载其图表库；rolldown 会把这些拆成模块加载器无法提供、`files` 清单无法发布的散列 chunk。tsdown 0.22 不透传 `inlineDynamicImports` 输出选项，因此 `clientBundle` 预设新增 `ClientBundleOptions.client`（对象形式 `outputOptions` 并入预设、调用方 `plugins` 扩展管线），canvas 包把每个动态导入以及 dagre-d3-es 对其 graphlib 模块的一个运行时 `import()` 都钉进单一 `lib/client.js`。产物约 12 MB 原始 / ~3 MB gzip——真实的启动代价，记入 Known Limitation。

### 跨两个 scope 的单一画布实例

store handle 不能挂载在两个 scope（`shell.overlay` 是 root，卡片链是 session），因此面板与打开动作共享一个引擎**实例**（`createCanvasStore().create()`），经注册的 inject face 传递——PopupSelectView 先例，而非第二个 store。

### Host 网关

`DiagramRemote`（`TypertRemoteService`，`@Remote('save')` / `@Remote('read')`）位于 host 平面（web 组合里的 `dsh-diagram/host` 入口），因为 Gateway 从 root scope 解析服务，而工具插件留在 agent presets。typert 工件（`./typert`、`./remote`）由构建时的 workspace typert 插件生成；`typert-loader` 自动注册描述符；客户端装配（`api/remotes`）挂载 `diagram` 命名空间。

### 暂无会话事件

画布保存尚未记录到会话日志。model-visible ⟺ logged 规则在内容进入模型请求时生效；那发生在模型读取里程碑（M-C），届时将在同一变更中补事件。

## 为什么没有 cordis-catalog 条目 / 没有 `@mode`

不适用——网关是 Remote 服务，不是类型化会话事件。

## 备选方案

**让卡片 bundle 直接 import 编辑器。** 已拒绝：12 MB 会进入每次会话启动，而多数会话从不打开该功能；独立面板包让卡片 bundle 保持轻量，编辑器位于独立产物之后。

**为编辑器做 `dsh.client.external` 模块表行。** 已拒绝：模块图规则把 external 行保留给基础设施/传输；功能 bundle 私有携带（内联）该编辑器是被认可的形态，`inlineDynamicImports` 让该 bundle 保持可发布。

**通过第二个手动同步的 store 共享状态。** 已拒绝：双数据源；经 inject face 的共享实例是既有模式，保持单一权威状态。

**把保存/读取放在工具插件上。** 已拒绝：工具按 preset 挂载在 Gateway 无法解析的隔离 realm；必须用 host 平面入口。

## 影响

每次 Web 会话的启动下载增加约 3 MB gzip（Known Limitation，留有把编辑器拆成懒加载行的延期选项）。

`diagram` 卡片新增打开动作链；卡片包对面板零依赖，不含 canvas 包的组合自然不渲染打开动作。

web 组合现在挂载 `dsh-diagram/host`，其 typert 描述符与其他 Remote 贡献一样由 `typert-loader` 注册；`api/remotes` 客户端装配挂载 `diagram` 命名空间。

画布保存绕开会话日志直到 M-C；任何让保存内容进入模型请求的里程碑，必须在同一变更中补对应会话事件。

## 验证

- `ui-diagram-canvas`：20 个测试，逐文件 100% 覆盖——store 动作、打开动作 select/挂载、面板状态（进行中/dirty/保存成功/失败/未命名）、注册 + HMR 移除，以及针对 fake `remote.diagram` 的保存桥。
- `dsh-diagram`：35 个测试，逐文件 100% 覆盖，含 Remote 网关（save/read 往返、路径策略、写/读失败、超大读取）。
- bundle 保持单一 `lib/client.js` 且无运行时动态导入（仅剩的 `import(...)` 在 JSDoc 注释里）。
