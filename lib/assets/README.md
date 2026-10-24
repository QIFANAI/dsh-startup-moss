# 素材与授权边界

仓库只保留 `whale.svg`。两段视频**不入公开仓库、不随公开仓库分发**：

- `moss-core.mp4`：黑底 550W 字标与信号线，用于 550W 核心层。
- `dune-hud.mp4`：仪表环片段，运行时从第 22 秒开始取用。

原因：两段素材含第三方作品元素，公开再分发需要自行取得授权。请用自有素材在本地补齐：

```powershell
npm run assets -- --core "<550W.mp4>" --dune "<dune-hud.mp4>"
npm run assets:check
```

脚本只做本地复制，不上传、不联网。未补齐时，运行时自动回落到程序化仪表环与 550W 文字，不会黑屏。

`whale.svg` 为 DSH 品牌标识，仅作插件内品牌引用；其权利归 DeepSeek / DSH 权利人所有，不随 MIT 许可证授权。

素材路径必须经 Host 白名单 `/dsh-moss/asset/:name` 读取；运行时不直接访问用户目录。
