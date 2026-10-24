import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const ROOT = path.resolve(import.meta.dirname, '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))

let pass = 0
const failures = []
function ok(name, fn) {
  try {
    fn()
    pass++
  } catch (err) {
    failures.push(name + ': ' + (err && err.message ? err.message : String(err)))
  }
}

const splash = read('lib/splash.js')
const css = read('lib/splash.css')
const host = read('lib/index.js')
const client = read('lib/client.js')
const preview = read('preview/index.html')
const pkg = JSON.parse(read('package.json'))

ok('splash.js 可被 vm 编译', () => {
  new vm.Script(splash, { filename: 'splash.js' })
})
ok('client.js 可被 vm 编译', () => {
  new vm.Script(client, { filename: 'client.js' })
})
ok('运行时带重复加载保护', () => {
  assert.match(splash, /__DSH_MOSS_BOOTED__/)
  assert.match(splash, /\(function \(\) \{/)
})

for (const token of [
  'dsh-moss-root',
  '__DSH_MOSS__',
  '__DSH_MOSS_FACTS__',
  '__DSH_MOSS_API__',
  'dsh-startup-moss:shown',
  'dsh-startup-moss:day',
  'moss-lock',
  'moss-core.mp4',
  'dune-hud.mp4',
  'whale.svg',
  'DURATION = 8.8',
  'DUNE_START = 22',
  'DUNE_FADE_OUT = 6.7',
  'CORE_FADE_IN = 1.2',
  'CORE_FADE_OUT = 6.9',
  'END_FADE = 7.15',
  'LOCAL FALLBACK / SIGNAL DEGRADED',
  'MOSS CORE ONLINE',
  'SYNTHESIZE INTELLIGENCE',
  'requestVideoFrameCallback',
  'createObjectURL',
  'core.muted = true'
]) {
  ok('splash.js 含契约 ' + token, () => assert.ok(splash.includes(token), '缺少 ' + token))
}

ok('减动效只由插件配置决定，不被系统偏好强制触发', () => {
  assert.doesNotMatch(splash, /matchMedia\('\(prefers-reduced-motion/)
  assert.match(splash, /var reduced = forceMotion \? false : cfg\.reducedMotion/)
  assert.match(splash, /reduced = forceMotion \? false : cfg\.reducedMotion/)
})

ok('素材先转 blob 再播放，保证 dsh-app:// 下可 seek', () => {
  assert.match(splash, /function loadBlob\(url\)/)
  assert.match(splash, /window\.URL\.createObjectURL\(blob\)/)
  assert.match(splash, /core\.src = objectUrl \|\| CORE_URL/)
  assert.match(splash, /dune\.src = objectUrl \|\| DUNE_URL/)
})

ok('时间轴公式与已验收版本一致', () => {
  assert.match(splash, /var coreIn = Math\.max\(0, Math\.min\(1, \(t - CORE_FADE_IN\) \/ 0\.6\)\)/)
  assert.match(splash, /var coreOut = 1 - Math\.max\(0, Math\.min\(1, \(t - CORE_FADE_OUT\) \/ 0\.4\)\)/)
  assert.match(splash, /var duneOut = 1 - Math\.max\(0, Math\.min\(1, \(t - DUNE_FADE_OUT\) \/ 0\.5\)\)/)
  assert.match(splash, /var duneLevel = cfg\.instrumentOpacity \* Math\.max\(0, Math\.min\(1, t \/ 0\.8\)\) \* duneOut/)
  assert.match(splash, /endCard\.style\.opacity = Math\.max\(0, Math\.min\(1, \(t - END_FADE\) \/ 0\.5\)\)/)
})

ok('层级顺序：鲸鱼 → 程序框 → Dune → 暗化 → 550W → 收尾卡', () => {
  const order = [
    'class="moss-whale-bg"',
    'class="moss-box"',
    'class="moss-dune"',
    'class="moss-shade"',
    'class="moss-core"',
    'class="moss-end-card"'
  ]
  let last = -1
  for (const token of order) {
    const at = splash.indexOf(token)
    assert.ok(at > last, token + ' 顺序错误')
    last = at
  }
})

ok('运行时不创建按钮、不显示 SKIP/REPLAY 或点击门槛', () => {
  assert.equal(splash.includes('<button'), false)
  assert.equal(splash.includes('moss-devbar'), false)
  assert.equal(/createElement\(['"]button/.test(splash), false)
  assert.equal(splash.includes('点击开始'), false)
  assert.equal(splash.includes('点击启用声音'), false)
})

ok('暴露 replay / skip / finish / state / progress', () => {
  assert.match(splash, /replay: replay/)
  assert.match(splash, /skip: skip/)
  assert.match(splash, /finish: finish/)
  assert.match(splash, /get state\(\)/)
  assert.match(splash, /get progress\(\)/)
})

ok('replay 清除已播标记后再重播', () => {
  assert.match(splash, /function replay\(\) \{[\s\S]*?clearShown\(\)/)
  assert.match(splash, /removeItem\('dsh-startup-moss:shown'\)/)
  assert.match(splash, /removeItem\('dsh-startup-moss:day'\)/)
})

ok('素材失败有程序化兜底，不会黑屏', () => {
  assert.match(splash, /function markFailed\(kind\)/)
  assert.match(splash, /fallbackRing\.style\.opacity = \(duneFailed \? duneLevel : 0\)/)
  assert.match(splash, /coreFallback\.style\.opacity = \(coreFailed \? coreLevel : 0\)/)
  assert.match(splash, /LOCAL FALLBACK \/ SIGNAL DEGRADED/)
})

ok('减弱动态只暂停视频，不隐藏画面', () => {
  assert.match(splash, /if \(reduced\) \{[\s\S]{0,900}seekVideo\(core, 2\.8\)/)
  assert.match(css, /\.moss-root\.moss-reduced \.moss-dune,/)
  assert.doesNotMatch(css, /\.moss-reduced\s+\.moss-(dune|core)\s*\{[^}]*display:\s*none/)
})

ok('音频自动播放失败后静音重试', () => {
  assert.match(splash, /corePlay\.catch\(function \(\) \{[\s\S]*?core\.muted = true[\s\S]*?core\.play\(\)/)
  assert.match(splash, /dune\.muted = true/)
})

/* ── CSS 硬约束 ─────────────────────────────────────────────────────────── */
ok('大鱼固定 1920×1920、左上角 0,0、默认透明度 0.18', () => {
  const block = css.slice(css.indexOf('.moss-whale-bg {'), css.indexOf('.moss-vignette'))
  assert.match(block, /left: 0;/)
  assert.match(block, /top: 0;/)
  assert.match(block, /width: 1920px;/)
  assert.match(block, /height: 1920px;/)
  assert.match(block, /opacity: var\(--moss-whale-opacity, 0\.18\);/)
  assert.match(block, /filter: blur\(0\.3px\);/)
})
ok('黑色程序框 1200×675 且裁切内部图层', () => {
  const block = css.slice(css.indexOf('.moss-box {'), css.indexOf('.moss-dune,'))
  assert.match(block, /width: 1200px;/)
  assert.match(block, /height: 675px;/)
  assert.match(block, /overflow: hidden;/)
  assert.match(block, /background: #000;/)
})
ok('Dune 只作为框内仪表层，scale 1.45', () => {
  const block = css.slice(css.indexOf('.moss-dune {'), css.indexOf('.moss-fallback-ring {'))
  assert.match(block, /transform: scale\(1\.45\);/)
  assert.match(block, /filter: contrast\(1\.18\) brightness\(0\.86\);/)
})
ok('550W 使用 screen 混合，不遮住仪表线', () => {
  const at = css.indexOf('.moss-core {')
  const block = css.slice(at, css.indexOf('.moss-core-fallback {', at))
  assert.match(block, /mix-blend-mode: screen;/)
})
ok('收尾卡位于程序框内部并有红色状态行', () => {
  assert.match(css, /\.moss-end-card \{/)
  assert.match(css, /\.moss-end-state \{[^}]*color: #c8102e;/)
  const at = splash.indexOf('class="moss-box"')
  const end = splash.indexOf('class="moss-end-card"')
  const boxEnd = splash.indexOf('</div>\',\n    \'  <div class="moss-box-edge"')
  assert.ok(at >= 0 && end > at && boxEnd > end, '收尾卡必须在 box 模板内')
})
ok('扫描线、四角刻线、外圈细边齐全', () => {
  for (const selector of [
    '.moss-frame',
    '.moss-corner',
    '.moss-box-edge',
    '.moss-scan',
    '.moss-brand',
    '.moss-meta',
    '.moss-status',
    '.moss-foot'
  ]) {
    assert.ok(css.includes(selector), '缺少 ' + selector)
  }
})

/* ── 配置三处对齐 ───────────────────────────────────────────────────────── */
const CONFIG_KEYS = [
  'enabled', 'mode', 'instrumentOpacity', 'whaleOpacity', 'coreShade',
  'sound', 'volume', 'allowSkip', 'reducedMotion'
]
for (const key of CONFIG_KEYS) {
  ok('Host DEFAULTS 含 ' + key, () => {
    const block = host.slice(host.indexOf('const DEFAULTS'), host.indexOf('const BOOL_KEYS'))
    assert.ok(block.includes(key + ':'), 'host 缺少 ' + key)
  })
  ok('运行时 DEFAULTS 含 ' + key, () => {
    const block = splash.slice(splash.indexOf('var DEFAULTS'), splash.indexOf('function clamp'))
    assert.ok(block.includes(key + ':'), 'splash 缺少 ' + key)
  })
  ok('设置页 FALLBACK 含 ' + key, () => {
    const block = client.slice(client.indexOf('var FALLBACK'), client.indexOf('var CSS'))
    assert.ok(block.includes(key + ':'), 'client 缺少 ' + key)
  })
}

ok('设置页注册 id/order/label 正确', () => {
  assert.match(client, /id: 'startup-moss'/)
  assert.match(client, /order: 28/)
  assert.match(client, /label: 'MOSS 启动动画'/)
  assert.match(client, /load\(\{\s*\n?\s*id: 'dsh-startup-moss'/)
})
ok('设置页带桌面端自举', () => {
  assert.match(client, /function selfBoot\(/)
  assert.match(client, /function injectBoot\(/)
  assert.match(client, /splash\.js\?t=/)
  assert.match(client, /moss-boot/)
  assert.match(client, /10500/)
})
ok('Host 不写死预览 facts', () => {
  assert.equal(host.includes('deepseek-flash'), false)
  assert.equal(host.includes("sessions: 4"), false)
})

/* ── 预览与包 ──────────────────────────────────────────────────────────── */
ok('预览使用真实 splash.css / splash.js', () => {
  assert.match(preview, /splash\.css/)
  assert.match(preview, /splash\.js/)
  assert.match(preview, /dsh-moss-root/)
  assert.match(preview, /__DSH_MOSS_PREVIEW_T__/)
  assert.match(preview, /__DSH_MOSS_PREVIEW_FAIL__/)
  assert.match(preview, /location\.protocol === 'file:'/)
})
ok('preview 只是查看器，不出现重播按钮', () => {
  assert.equal(preview.includes('<button'), false)
  assert.equal(preview.includes('REPLAY'), false)
})
ok('package.json 名称/版本/入口/bundle 声明正确', () => {
  assert.equal(pkg.name, 'dsh-startup-moss')
  assert.equal(pkg.version, '0.1.1')
  assert.equal(pkg.main, 'lib/index.js')
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.repository.url, 'git+https://github.com/QIFANAI/dsh-startup-moss.git')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'))
})
ok('cordis.patch.yml 有 insert 条目', () => {
  const yml = read('cordis.patch.yml')
  assert.match(yml, /insert:/)
  assert.match(yml, /dsh-startup-moss/)
})

/* ── 素材：公开仓库允许缺失，缺失时必须走程序化兜底 ───────────────────── */
ok('lib/assets/whale.svg 存在且体积合理', () => {
  assert.ok(exists('lib/assets/whale.svg'), '缺少 lib/assets/whale.svg')
  assert.ok(fs.statSync(path.join(ROOT, 'lib/assets/whale.svg')).size > 1000)
})
for (const [rel, min] of [
  ['lib/assets/moss-core.mp4', 500 * 1024],
  ['lib/assets/dune-hud.mp4', 500 * 1024]
]) {
  if (!exists(rel)) {
    ok(rel + ' 缺失时走程序化兜底', () => {
      assert.match(splash, /LOCAL FALLBACK \/ SIGNAL DEGRADED/)
      assert.match(css, /moss-fallback-ring/)
    })
    continue
  }
  ok(rel + ' 存在且体积合理', () => {
    assert.ok(fs.statSync(path.join(ROOT, rel)).size > min)
  })
  ok(rel + ' 是 MP4 容器', () => {
    const fd = fs.openSync(path.join(ROOT, rel), 'r')
    const head = Buffer.alloc(64)
    fs.readSync(fd, head, 0, 64, 0)
    fs.closeSync(fd)
    assert.ok(head.includes(Buffer.from('ftyp')), '缺少 ftyp box')
  })
}
ok('素材授权边界与导入方式已写进 README', () => {
  const md = read('lib/assets/README.md')
  assert.match(md, /不入公开仓库/)
  assert.match(md, /npm run assets/)
  assert.match(md, /whale\.svg/)
})

/* ── 旧插件隔离 ────────────────────────────────────────────────────────── */
for (const token of ['dsh-startup-yomi', 'dsh-startup-screen', 'dsu-lock', 'yomi-root']) {
  ok('没有旧插件痕迹 ' + token, () => {
    for (const [file, text] of [
      ['index.js', host],
      ['splash.js', splash],
      ['splash.css', css],
      ['client.js', client],
      ['preview', preview]
    ]) {
      assert.equal(text.includes(token), false, file + ' 出现 ' + token)
    }
  })
}

if (failures.length) {
  console.error('\nFAIL ' + failures.length + ' / PASS ' + pass)
  for (const failure of failures) console.error('  ✗ ' + failure)
  process.exit(1)
}
console.log('smoke-splash: PASS ' + pass + ' 项')
