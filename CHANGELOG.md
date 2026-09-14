# Changelog

## 1.0.0 (2026-09-15)

首个正式版。自 `lumina-dsh-map` 0.1.0 更名而来。

### 改名
- 包名 `lumina-dsh-map` → `dsh-forkmap`，插件 id / 模块 id / CSS 命名空间统一为 `forkmap`

### 新增
- 节点显示最近活动相对时间（`<1m` / `5m` / `3h` / `2d`），自动兼容秒/毫秒时间戳，当前会话不显示
- 节点 hover 描边、分叉按钮 hover 下划线
- `test/consistency.test.js`：内联逻辑副本与 `lib/tree.js` 的深度一致性测试（8 组固定用例 + 200 组随机用例），防止 Module Loader 手工同步产生漂移
- tree 边界用例：self-parent / dangling parent / 深链布局 / 多树不重叠 / id 决胜排序 / 全节点可达性
- `timeAgo` 单测

### 修复
- 无

## 0.1.0 (2026-09-12)

- 首个可用版本：会话区「地图」tab，fork 谱系树，节点点击打开、一键分叉，subagent / 空白会话过滤，中英文案，深色主题。
