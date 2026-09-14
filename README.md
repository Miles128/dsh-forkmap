# dsh-forkmap

DeepSeek Harness Web 插件：在会话区增加 **地图** tab，按 `parentId` 画出 fork 谱系（排除 subagent 子会话），一眼看清对话分叉的全貌。

点节点打开该 session；点「分叉」调用官方 `sessions.fork` 开出新分支；节点上显示状态（当前 / 进行中 / 待确认 / 完成）和最近活动时间。

## 安装

```bash
dsh plugin --profile web add /absolute/path/to/dsh-forkmap
```

部分 pnpm profile 需要：

```bash
dsh plugin --profile web add -w /absolute/path/to/dsh-forkmap
```

重启 `dsh web` 并刷新页面。Chat / Trajectory 旁边应出现 **地图**。

## 功能

- **谱系树**：按 `updatedAt` 排序的 fork 树，多棵树纵向排列
- **状态标识**：当前（高亮）/ 进行中（蓝）/ 待确认（橙）/ 完成
- **相对时间**：每个节点显示 `5m` / `3h` / `2d` 级别的最近活动时间
- **一键分叉**：任意节点上直接 fork 并跳转到新分支
- **深浅色主题**：跟随 DSH Web 主题（`data-ds-dark-theme`）

## 行为约定

| 操作 | DSH API |
|---|---|
| 点节点 | `sessions.open(id)` |
| 分叉 | `sessions.fork({ sessionId, increaseTitle: true })` 后打开子 session |
| 隐藏 | `origin === 'subagent'`；空白 session 只显示当前这条 |

不另存 `parent_id` 树，也不做同线程 archived 回滚——地图只反映 DSH session 的真实谱系。

## 开发

```bash
npm test
npm run check
```

- `lib/index.js` — Host 空入口（`dsh.client` 发现用）
- `lib/tree.js` — 谱系与布局（纯函数，单测覆盖）
- `lib/client.js` — Web client，挂到 `conversation.view`；内联了 tree.js 的逻辑副本（Module Loader 不支持 ESM import），`test/consistency.test.js` 用 200 个随机用例保证两边不漂移

需要 DeepSeek Harness `>= 0.1.0-rc.6` 的 Web profile。

## 发布

```bash
npm version patch|minor|major
git push --tags
npm publish
```

## License

MIT
