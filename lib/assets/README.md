# 素材与授权边界

`lib/assets/` 随仓库与官方 Release 完整发布，克隆或安装 tgz 后即获得完整观感：

| 文件 | 用途 |
| --- | --- |
| `moss-core.mp4` | 黑底 550W 字标与信号线，用于 550W 核心层 |
| `dune-hud.mp4` | 仪表环片段，运行时从第 22 秒开始取用 |
| `whale.svg` | DSH 品牌标识，仅作插件内品牌引用 |

素材缺失或解码失败时，运行时自动回落到程序化仪表环与 550W 文字，不会黑屏。

## 权利与再分发

两段视频与 `whale.svg` 的权利归各自权利人所有；代码的 MIT 授权**不覆盖**这些素材与商标。
再分发、商用或公开演示前，请自行确认你有权使用，并自行承担相应责任。
若你是权利人并认为随附发布不当，请开 Issue 联系维护者处理：
<https://github.com/QIFANAI/dsh-startup-moss/issues>

## 替换为自有素材

只使用你有权使用的视频。`npm run assets` 只做本地复制，不上传、不联网：

```powershell
npm run assets -- --core "<550W.mp4>" --dune "<dune-hud.mp4>" --force
npm run assets:check
```

素材路径必须经 Host 白名单 `/dsh-moss/asset/:name` 读取；运行时不直接访问用户目录。
