# 安装 / 升级 / 回退

## 0. 前置

| 项 | 要求 |
| --- | --- |
| 平台 | DSH web profile 或 DeepSeek Harness Desktop |
| Node.js | >= 20（安装、打包与测试） |
| 权限 | 能执行 `dsh plugin`，并能写入 `~/.dsh/profiles/<profile>` |
| 状态 | 安装前完全退出 DSH |

## 1. 准备素材（可选）

仓库不含两段私有视频。需要完整视觉效果时，用自有素材在本地补齐：

```powershell
npm run assets -- --core "<550W.mp4>" --dune "<dune-hud.mp4>"
npm run assets:check
```

不补齐也可以继续，运行时会显示程序化仪表环与 550W 文字。

## 2. 打包

```powershell
npm run pack
```

产物在 `releases/dsh-startup-moss-<版本>.tgz`。

## 3. 安装

```powershell
dsh plugin --profile desktop add .\releases\dsh-startup-moss-0.1.1.tgz
```

没有全局 `dsh` 时：

```powershell
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add .\releases\dsh-startup-moss-0.1.1.tgz
```

安装后重启 DSH。配置在 `~/.dsh/dsh-startup-moss.json`；设置页入口为 `设置 → MOSS 启动动画`。

## 4. 与旧启动插件冲突

同一个 profile 只能保留一个启动层。如果 `~/.dsh/profiles/desktop/package.json` 仍依赖 `dsh-startup-yomi` 或 `dsh-startup-screen`，先停用或移除旧插件：

- 多个插件都会尝试 `tapIndex` 注入根节点。
- 多套 `*-lock` 会争抢 `html` / `body`。
- 多套看门狗会互相移除对方的根节点或提前解锁。

## 5. 回退

1. 关闭 DSH。
2. 移除 `dsh-startup-moss` 依赖。
3. 还原安装前的 `package.json` 与 `pnpm-lock.yaml`。
4. 重启 DSH。

插件配置在 `~/.dsh/dsh-startup-moss.json`，删除该文件即可回到默认值；卸载插件不会自动删除它。

## 6. 排错

- 黑框里只有收尾卡、没有仪表：确认 `lib/assets/*.mp4` 存在，并检查 DSH 版本是否走 `dsh-app://`；0.1.1 起运行时已改用 Blob 挂载。
- 设置页看不到入口：profile 的 `@deepseek-ai/dsh-client-ui-settings` 可能被禁用，直接编辑配置文件即可。
- 升级后动画不出现：`mode` 为 `session` 时每个 DSH 进程只播一次，重启后再看。
