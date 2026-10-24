# dsh-startup-moss

DeepSeek Harness（DSH）的零点击启动动画「MOSS CORE 550W」。

[![test](https://github.com/QIFANAI/dsh-startup-moss/actions/workflows/test.yml/badge.svg)](https://github.com/QIFANAI/dsh-startup-moss/actions/workflows/test.yml)

白色 DSH 大鲸鱼固定在左上角作背景；黑色程序框内放入 Dune 仪表层，550W 以 `screen` 混合压在上层；8.8 秒后收进收尾卡并自动释放宿主。第一帧自动开始，不需要点击，不显示 SKIP / REPLAY 按钮。

> 非官方社区插件。DeepSeek / DSH 名称与鲸鱼标识归其权利人所有；「MOSS / 550W」为作品致敬性引用。

## 效果

- 总时长固定 8.8 秒，自动播放、自动释放宿主。
- 大鲸鱼背景固定 `1920×1920`、左上角原点、透明度 `0.18`，不随动画位移。
- 黑色程序框 `1200×675`，仪表层在框内、550W 之下；550W 使用 `mix-blend-mode: screen`。
- 收尾卡保留在黑色程序框内部。
- 550W 原声自动尝试播放；被浏览器策略拦截时静音继续。
- 素材缺失或解码失败时回落为程序化仪表环与 550W 文字，不会黑屏。
- 素材经 Blob 挂载，规避 `dsh-app://` 直连视频无法 seek 的问题。

时间轴：

| 时间 | 内容 |
| --- | --- |
| 0–0.8s | DSH 外壳就位，仪表层淡入 |
| 1.2–1.8s | 550W 核心淡入 |
| 1.8–6.7s | 双素材完整停留 |
| 6.7–7.3s | 仪表层与 550W 依次退场 |
| 7.15–7.65s | 收尾卡交叉淡入 |
| 8.8s | 自动释放宿主 |

## 环境

- DSH 桌面端（web profile 亦可）。
- Node.js >= 20（安装、打包与测试需要；插件运行时零依赖）。

## 安装

### 1. 获取代码

```powershell
git clone https://github.com/QIFANAI/dsh-startup-moss.git
cd dsh-startup-moss
```

### 2. 导入本地素材（可选，但决定是否完整视觉）

仓库不包含两段私有视频，见「素材说明」。准备好自有素材后：

```powershell
npm run assets -- --core "D:\clips\550w.mp4" --dune "D:\clips\dune-hud.mp4"
npm run assets:check
```

不导入也能安装，插件会以程序化仪表环 + 550W 文字兜底运行。

### 3. 打包并安装

```powershell
npm run pack
dsh plugin --profile desktop add .\releases\dsh-startup-moss-0.1.1.tgz
```

没有全局 `dsh` 命令时，使用桌面端 CLI：

```powershell
& "<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add .\releases\dsh-startup-moss-0.1.1.tgz
```

安装后重启 DSH。设置页入口：`设置 → MOSS 启动动画`。

> 同一个 profile 只能启用一个启动层。若已启用 `dsh-startup-yomi` 或 `dsh-startup-screen`，必须先停用旧插件，否则多个首屏注入会互相锁屏。

详细步骤见 [INSTALL.md](INSTALL.md)。

## 素材说明

仓库只保留 `lib/assets/whale.svg`。`moss-core.mp4` 与 `dune-hud.mp4` **不入库、不随公开仓库分发**：前者含 550W 字标，后者取自影视片段，公开再分发需要自行取得授权。

`npm run assets` 只做本地文件复制，不上传、不联网。素材授权由使用者自行确认。缺失时运行时自动使用程序化兜底，功能不受影响。

`whale.svg` 是 DSH 品牌标识，仅用于本插件内的品牌引用，不随 MIT 许可证授权。

## 配置

配置文件：`~/.dsh/dsh-startup-moss.json`

```json
{
  "enabled": true,
  "mode": "session",
  "instrumentOpacity": 0.55,
  "whaleOpacity": 0.18,
  "coreShade": 0.62,
  "sound": true,
  "volume": 0.85,
  "allowSkip": true,
  "reducedMotion": false
}
```

- `mode`：`session` / `daily` / `always`
- `instrumentOpacity`：仪表层最大透明度，默认 `0.55`
- `whaleOpacity`：白色大鲸鱼背景透明度，默认 `0.18`
- `coreShade`：程序框中心暗化，默认 `0.62`
- `allowSkip`：只控制隐藏的 Esc，不显示按钮
- `reducedMotion`：暂停视频持续运动，保留静帧与淡入淡出；只认本配置，不跟随系统“减少动态效果”

右上角 `REV / SESSIONS / BUNDLES / MODEL` 在正式运行时读取宿主真实 facts；取不到显示 `—`。预览页中的数值仅为静态 Mock。

## 运行时 API

```js
window.__DSH_MOSS_API__ = {
  replay(),
  skip(),
  finish(),
  state,     // boot | intro | core | outro | done | disabled | preview
  progress   // 0–1
}
```

预览页调试参数：

```text
?t=4.5          冻结在 4.5 秒
?fail=core      550W 视频失败兜底
?fail=core,dune 两段视频同时失败兜底
?motion=1       强制正常动态
```

## 开发

```powershell
node --check lib/index.js
node --check lib/splash.js
node --check lib/client.js
npm test
npm run pack
```

`npm test` 在没有两段 mp4 时同样通过：素材相关断言会自动降级为“缺失时 404 / 程序化兜底”。CI 在 Node 20 / 22 / 24 上运行。

实时预览：直接打开 `preview/index.html`，或访问运行中的 `/dsh-moss/preview`。

## 已知问题

- DSH 桌面端使用 `dsh-app://`，媒体元素直连该协议时 `seekable` 为 0；本插件统一先取 Blob 再挂载，Web 与桌面端行为一致。
- 设置页入口由 profile 的 `@deepseek-ai/dsh-client-ui-settings` 控制；若该模块被禁用，可直接编辑 `~/.dsh/dsh-startup-moss.json`。

## 授权

代码以 [MIT](LICENSE) 发布。素材、商标与第三方作品的授权边界见 [lib/assets/README.md](lib/assets/README.md)。
