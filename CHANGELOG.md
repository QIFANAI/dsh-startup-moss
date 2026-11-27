# 更新记录

## 0.1.2 · 2026-11-27 · 完整素材开源版

- 仓库与官方 Release 改为**完整素材开源**：`lib/assets/dune-hud.mp4` 与
  `lib/assets/moss-core.mp4` 随仓库提交，`whale.svg` 保持入库；克隆或安装 tgz 后
  即是完整视觉，不再需要本地补素材；
- `.gitignore` 不再排除 `lib/assets/*.mp4`，两段视频随仓库、tag 与 Release 一起发布；
- README / INSTALL / `lib/assets/README.md` 同步为完整开源口径：素材随仓库与 Release
  完整发布，权利归各自权利人，代码的 MIT 授权不覆盖素材；再分发、商用或公开演示前
  自行确认授权，权利人异议可开 Issue 处理；
- `scripts/assets.mjs` 的注释与状态输出改为「随仓库发布 / 可用自有素材替换」；
- 素材缺失时的程序化兜底链路保持不变：存在时按素材路径断言（体积、MP4 容器、Host
  素材路由），缺失时仍验兜底；
- 验证：`npm test` 共 171 项通过（smoke-host 32 + smoke-splash 87 + smoke-client 52）；
  `npm run pack` 产出 `releases/dsh-startup-moss-0.1.2.tgz`（4,429,133 字节，14 个文件），
  `tar -tzf` 确认含 `lib/assets/dune-hud.mp4` 与 `lib/assets/moss-core.mp4`；
  `releases/SHA256SUMS` 记录该包的 SHA-256。

## 0.1.1 — 2026-10-24

- 修复 DSH 桌面端 `dsh-app://` 下视频无法 seek、仪表停在第 0 帧、黑框空白的问题：素材改为 `fetch → Blob → objectURL` 后挂载。
- 减动效只由插件配置 `reducedMotion` 决定，不再被系统“减少动态效果”强制接管。
- 补充素材导入脚本与无素材兜底说明。

## 0.1.0 — 2026-10-24

- 首个版本：DSH 大鲸鱼背景、黑色程序框、Dune 仪表层、550W 核心层、8.8 秒零点击开幕与收尾卡。
- 支持配置读写、会话/每日/每次三种播放模式、素材失败兜底与真实宿主 facts。
