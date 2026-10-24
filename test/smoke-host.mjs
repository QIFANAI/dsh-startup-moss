import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'

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
async function okAsync(name, fn) {
  try {
    await fn()
    pass++
  } catch (err) {
    failures.push(name + ': ' + (err && err.message ? err.message : String(err)))
  }
}
const eq = (a, b, msg) => assert.deepEqual(a, b, msg)
const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => setImmediate(resolve))
}

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-moss-home-'))
process.env.DSH_HOME = tmpHome

const { apply, inject, name } = await import('../lib/index.js')
assert.equal(name, 'dsh-startup-moss')
assert.deepEqual(inject, ['webServer', 'connection'])

const routes = []
const indexFns = []
const effects = []
const server = {
  register(route) {
    routes.push(route)
    return () => {}
  },
  tapIndex(fn) {
    indexFns.push(fn)
    return () => {}
  }
}
const ctx = {
  logger: { warn() {} },
  get(key) {
    if (key === 'webServer') return server
    if (key === 'connection') return { requestRejection: () => null }
    if (key === 'profileContext') return { name: 'desktop', cwd: 'D:\\work\\dsh', startedBundles: ['a', 'b'] }
    if (key === 'pluginManager') {
      return {
        listBundles: async () => [
          { name: '@deepseek-ai/dsh-base', version: '0.162.1' },
          { name: 'dsh-ops', version: '0.3.0' }
        ]
      }
    }
    if (key === 'agentDefaultModel') {
      return { currentSelection: async () => ({ provider: 'deepseek', model: 'deepseek-flash' }) }
    }
    if (key === 'sessions') return { list: async () => [{}, {}, {}] }
    return undefined
  },
  effect(fn) {
    effects.push(fn)
    return () => {}
  }
}

apply(ctx)
await settle()

ok('注册 5 个路由', () => {
  eq(routes.length, 5)
  eq(routes.map((route) => route.path).sort(), [
    '/dsh-moss/asset',
    '/dsh-moss/config',
    '/dsh-moss/preview',
    '/dsh-moss/splash.css',
    '/dsh-moss/splash.js'
  ].sort())
})
ok('注册 1 个 index 注入函数', () => eq(indexFns.length, 1))
ok('注册 effect 清理', () => eq(typeof effects[0], 'function'))

function routeByPath(p) {
  return routes.find((route) => route.path === p) ||
    routes.find((route) => route.kind === 'prefix' && p.startsWith(route.path + '/'))
}
function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    writeHead(code, headers) {
      this.statusCode = code
      if (headers) Object.assign(this.headers, headers)
      return this
    },
    end(chunk) {
      this.body = chunk
      this.ended = true
    }
  }
}
function makeReq({ method = 'GET', url = '/', headers = {}, body = null } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = headers
  if (body !== null) {
    process.nextTick(() => {
      req.emit('data', Buffer.from(body))
      req.emit('end')
    })
  }
  return req
}
async function call(routePath, options) {
  const route = routeByPath(routePath)
  if (!route) throw new Error('route not registered: ' + routePath)
  const res = makeRes()
  await route.handler(makeReq(Object.assign({}, options, { url: routePath })), res)
  return res
}

const PAGE = '<!doctype html><html><head><title>DSH</title></head><body><div id="app"></div></body></html>'
let injected = ''
ok('tapIndex 可调用', () => {
  injected = indexFns[0](PAGE)
  assert.equal(typeof injected, 'string')
})
ok('注入根节点、关键 CSS 与运行时', () => {
  assert.match(injected, /<div id="dsh-moss-root" class="moss-root moss-boot"><\/div>/)
  assert.match(injected, /dsh-moss-critical/)
  assert.match(injected, /html\.moss-lock/)
  assert.match(injected, /<script defer src="\/dsh-moss\/splash\.js"><\/script>/)
  assert.match(injected, /<link rel="stylesheet" href="\/dsh-moss\/splash\.css">/)
})
ok('注入真实 facts，不写死预览值', () => {
  assert.match(injected, /"version":"0\.162\.1"/)
  assert.match(injected, /"profile":"DESKTOP"/)
  assert.match(injected, /"sessions":3/)
  assert.match(injected, /"bundleCount":2/)
  assert.match(injected, /"model":"deepseek-flash"/)
  assert.match(injected, /window\.__DSH_MOSS_FACTS__=/)
})
const pkgVersion = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
ok('注入插件版本与配置', () => {
  assert.ok(injected.includes(`window.__DSH_MOSS_VERSION__="${pkgVersion}"`))
  assert.match(injected, /"instrumentOpacity":0\.55/)
  assert.match(injected, /"whaleOpacity":0\.18/)
  assert.match(injected, /"coreShade":0\.62/)
  assert.match(injected, /"volume":0\.85/)
})
ok('注入 session/daily 标记与 10.5 秒兜底', () => {
  assert.match(injected, /dsh-startup-moss:shown/)
  assert.match(injected, /dsh-startup-moss:day/)
  assert.match(injected, /10500/)
})
ok('重复注入幂等', () => eq(indexFns[0](injected), injected))
ok('无 </head> 时仍插到最前面', () => {
  const out = indexFns[0]('<html><body>x</body></html>')
  assert.match(out, /^<link rel="stylesheet"/)
})

for (const [routePath, type] of [
  ['/dsh-moss/splash.css', 'text/css'],
  ['/dsh-moss/splash.js', 'application/javascript'],
  ['/dsh-moss/preview', 'text/html']
]) {
  await okAsync(routePath + ' 返回 200 且非空', async () => {
    const res = await call(routePath)
    eq(res.statusCode, 200)
    assert.match(String(res.headers['Content-Type']), new RegExp(type))
    assert.ok(String(res.body).length > 100)
  })
}
await okAsync('preview 使用真实运行时与 CSS', async () => {
  const res = await call('/dsh-moss/preview')
  const html = String(res.body)
  assert.match(html, /dsh-moss-root/)
  assert.match(html, /splash\.css/)
  assert.match(html, /splash\.js/)
  assert.match(html, /__DSH_MOSS_PREVIEW_T__/)
})

await okAsync('GET config 返回默认值与 facts', async () => {
  const res = await call('/dsh-moss/config')
  eq(res.statusCode, 200)
  const body = JSON.parse(String(res.body))
  eq(body.ok, true)
  eq(body.version, pkgVersion)
  eq(body.config.mode, 'session')
  eq(body.config.instrumentOpacity, 0.55)
  eq(body.config.whaleOpacity, 0.18)
  eq(body.config.sound, true)
  eq(body.facts.profile, 'DESKTOP')
  assert.equal(typeof body.file, 'string')
})
await okAsync('POST 合法 patch 落盘并夹取', async () => {
  const res = await call('/dsh-moss/config', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'bogus',
      instrumentOpacity: 99,
      whaleOpacity: -1,
      coreShade: 4,
      volume: -2,
      sound: 'false',
      reducedMotion: 'true'
    })
  })
  eq(res.statusCode, 200)
  const body = JSON.parse(String(res.body))
  eq(body.config.mode, 'session')
  eq(body.config.instrumentOpacity, 1)
  eq(body.config.whaleOpacity, 0)
  eq(body.config.coreShade, 0.95)
  eq(body.config.volume, 0)
  eq(body.config.sound, false)
  eq(body.config.reducedMotion, true)
  const saved = JSON.parse(fs.readFileSync(path.join(tmpHome, 'dsh-startup-moss.json'), 'utf8'))
  assert.equal(Object.prototype.hasOwnProperty.call(saved, 'facts'), false, 'facts 不能写进用户配置')
})
await okAsync('POST 非法 JSON → 400', async () => {
  const res = await call('/dsh-moss/config', { method: 'POST', body: '{oops' })
  eq(res.statusCode, 400)
  eq(JSON.parse(String(res.body)).ok, false)
})
await okAsync('POST reset 恢复默认', async () => {
  const res = await call('/dsh-moss/config', {
    method: 'POST',
    body: JSON.stringify({ action: 'reset' })
  })
  eq(res.statusCode, 200)
  eq(JSON.parse(String(res.body)).config.instrumentOpacity, 0.55)
})
await okAsync('config 非 GET/POST → 405', async () => {
  const res = await call('/dsh-moss/config', { method: 'DELETE' })
  eq(res.statusCode, 405)
})

for (const [asset, type] of [
  ['moss-core.mp4', 'video/mp4'],
  ['dune-hud.mp4', 'video/mp4'],
  ['whale.svg', 'image/svg+xml']
]) {
  const file = path.join(process.cwd(), 'lib', 'assets', asset)
  if (!fs.existsSync(file)) {
    await okAsync(asset + ' 缺失时 → 404（不崩溃）', async () => {
      const res = await call('/dsh-moss/asset/' + asset)
      eq(res.statusCode, 404)
    })
    continue
  }
  const size = fs.statSync(file).size
  await okAsync(asset + ' 整份 GET 200', async () => {
    const res = await call('/dsh-moss/asset/' + asset)
    eq(res.statusCode, 200)
    eq(res.headers['Content-Type'], type)
    eq(res.headers['Accept-Ranges'], 'bytes')
    eq(Number(res.headers['Content-Length']), size)
  })
  await okAsync(asset + ' Range 0-99 → 206', async () => {
    const res = await call('/dsh-moss/asset/' + asset, { headers: { range: 'bytes=0-99' } })
    eq(res.statusCode, 206)
    eq(res.headers['Content-Range'], 'bytes 0-99/' + size)
    eq(Number(res.headers['Content-Length']), 100)
    eq(Buffer.isBuffer(res.body) ? res.body.length : String(res.body).length, 100)
  })
}

const coreFile = path.join(process.cwd(), 'lib', 'assets', 'moss-core.mp4')
if (fs.existsSync(coreFile)) {
  const coreSize = fs.statSync(coreFile).size
  await okAsync('开放区间 bytes=100- → 206', async () => {
    const res = await call('/dsh-moss/asset/moss-core.mp4', { headers: { range: 'bytes=100-' } })
    eq(res.statusCode, 206)
    eq(res.headers['Content-Range'], 'bytes 100-' + (coreSize - 1) + '/' + coreSize)
  })
  await okAsync('末尾区间 bytes=-50 → 206', async () => {
    const res = await call('/dsh-moss/asset/moss-core.mp4', { headers: { range: 'bytes=-50' } })
    eq(res.statusCode, 206)
    eq(res.headers['Content-Range'], 'bytes ' + (coreSize - 50) + '-' + (coreSize - 1) + '/' + coreSize)
  })
  await okAsync('不可满足 Range → 416', async () => {
    const res = await call('/dsh-moss/asset/moss-core.mp4', { headers: { range: 'bytes=999999999-' } })
    eq(res.statusCode, 416)
    eq(res.headers['Content-Range'], 'bytes */' + coreSize)
  })
  await okAsync('HEAD 无 body', async () => {
    const res = await call('/dsh-moss/asset/moss-core.mp4', { method: 'HEAD' })
    eq(res.statusCode, 200)
    eq(Number(res.headers['Content-Length']), coreSize)
    assert.ok(res.body === undefined || res.body === null)
  })
} else {
  await okAsync('moss-core.mp4 缺失时 HEAD → 404', async () => {
    const res = await call('/dsh-moss/asset/moss-core.mp4', { method: 'HEAD' })
    eq(res.statusCode, 404)
  })
}
await okAsync('未知素材、路径穿越与非白名单 → 404', async () => {
  eq((await call('/dsh-moss/asset/nope.mp4')).statusCode, 404)
  eq((await call('/dsh-moss/asset/..%2Fpackage.json')).statusCode, 404)
  eq((await call('/dsh-moss/asset/README.md')).statusCode, 404)
})
await okAsync('素材 POST → 405', async () => {
  const res = await call('/dsh-moss/asset/moss-core.mp4', { method: 'POST' })
  eq(res.statusCode, 405)
})

await okAsync('没有 webServer 时安静跳过、不抛异常', async () => {
  const localEffects = []
  const localCtx = {
    logger: { warn() {} },
    get(key) {
      if (key === 'connection') return { requestRejection: () => null }
      return undefined
    },
    effect(fn) {
      localEffects.push(fn)
      return () => {}
    }
  }
  apply(localCtx)
  eq(localEffects.length, 0)
})

fs.rmSync(tmpHome, { recursive: true, force: true })

if (failures.length) {
  console.error('\nFAIL ' + failures.length + ' / PASS ' + pass)
  for (const failure of failures) console.error('  ✗ ' + failure)
  process.exit(1)
}
console.log('smoke-host: PASS ' + pass + ' 项')
