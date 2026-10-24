#!/usr/bin/env node
/**
 * 本地素材导入 / 自检。
 *
 * 两段视频不入公开仓库；需要完整视觉效果时，用本脚本把自有素材复制到
 * lib/assets/。缺失时插件仍可运行，会显示程序化仪表环与 550W 文字。
 *
 *   npm run assets -- --core <550W.mp4> --dune <dune-hud.mp4> [--force]
 *   npm run assets:check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET_DIR = path.join(ROOT, 'lib', 'assets')
const ASSETS = {
  core: { name: 'moss-core.mp4', label: '550W 核心层' },
  dune: { name: 'dune-hud.mp4', label: 'Dune 仪表层' }
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const force = args.includes('--force')
const valueOf = (flag) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args[at + 1] || '' : ''
}

function printStatus() {
  for (const key of Object.keys(ASSETS)) {
    const item = ASSETS[key]
    const file = path.join(TARGET_DIR, item.name)
    const present = fs.existsSync(file)
    const size = present ? fs.statSync(file).size : 0
    const detail = present ? (size / 1024 / 1024).toFixed(2) + ' MB' : '缺失（使用程序化兜底）'
    console.log(`${present ? '✓' : '·'} ${item.name}  ${detail}`)
  }
  console.log('\n完整视觉效果需要两段本地视频；缺失时插件仍可运行，显示程序化仪表环与 550W 文字。')
}

if (checkOnly) {
  printStatus()
  process.exit(0)
}

const pairs = [
  ['core', valueOf('--core')],
  ['dune', valueOf('--dune')]
].filter(([, src]) => src)

if (!pairs.length) {
  console.error('用法：npm run assets -- --core <550W.mp4> --dune <dune-hud.mp4> [--force]')
  console.error('      npm run assets:check')
  process.exit(1)
}

for (const [key, src] of pairs) {
  const item = ASSETS[key]
  const from = path.resolve(src)
  if (!fs.existsSync(from)) {
    console.error(`✗ 找不到源文件：${from}`)
    process.exit(1)
  }
  if (!fs.statSync(from).isFile()) {
    console.error(`✗ 不是文件：${from}`)
    process.exit(1)
  }
  if (path.extname(from).toLowerCase() !== '.mp4') {
    console.error(`✗ 只接受 .mp4：${from}`)
    process.exit(1)
  }
  const size = fs.statSync(from).size
  if (size < 64 * 1024) {
    console.error(`✗ 文件过小，可能不是有效视频：${from}`)
    process.exit(1)
  }
  const target = path.join(TARGET_DIR, item.name)
  if (fs.existsSync(target) && !force) {
    console.log(`· 已存在，跳过：${item.name}（加 --force 覆盖）`)
    continue
  }
  fs.copyFileSync(from, target)
  console.log(`✓ ${item.label} → lib/assets/${item.name}（${(size / 1024 / 1024).toFixed(2)} MB）`)
}

printStatus()
