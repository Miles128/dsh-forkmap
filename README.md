# lumina-dsh-map

DeepSeek Harness Web 插件：在会话区增加 **地图** tab，按 `parentId` 画出 fork 谱系（排除 subagent 子会话）。

点节点打开该 session；点「分叉」调用官方 `sessions.fork`。

## 安装

```bash
dsh plugin --profile web add /absolute/path/to/lumina-dsh-map
```

部分 pnpm profile 需要：

```bash
dsh plugin --profile web add -w /absolute/path/to/lumina-dsh-map
```

重启 `dsh web` 并刷新页面。Chat / Trajectory 旁边应出现 **地图**。

## 行为

| 操作 | DSH API |
|---|---|
| 点节点 | `sessions.open(id)` |
| 分叉 | `sessions.fork({ sessionId, increaseTitle: true })` 后打开子 session |
| 隐藏 | `origin === 'subagent'`；空白 session 只显示当前这条 |

不另存 `parent_id` 树，也不做 Lumina 那种同线程 archived 回滚。

## 开发

```bash
npm test
npm run check
```

- `lib/index.js` — Host 空入口（`dsh.client` 发现用）
- `lib/tree.js` — 谱系与布局（单测覆盖）
- `lib/client.js` — Web client，挂到 `conversation.view`

需要 DeepSeek Harness `>= 0.1.0-rc.6` 的 Web profile。

## License

MIT
