/* ============================================================================
 * dsh-startup-moss — Host 半侧
 * ----------------------------------------------------------------------------
 *   1) 在 index.html 首屏注入启动层、关键 CSS、配置与运行时
 *   2) 提供 /dsh-moss 下的 splash.css / splash.js / preview / config / asset
 *   3) 把配置原子写入 ~/.dsh/dsh-startup-moss.json
 *
 * 真实 facts（版本、profile、会话数、模型）只注入页面，不写进用户配置。
 * 取不到的字段留 null，浏览器侧显示「—」，绝不把宿主字段硬编码进成品。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup-moss.json')

const NS = 'dsh-startup-moss'
const ROUTE_BASE = '/dsh-moss'

const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    return String(pkg.version || '').trim() || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 字段与 lib/splash.js、lib/client.js 三处必须一致。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',
  instrumentOpacity: 0.55,
  whaleOpacity: 0.18,
  coreShade: 0.62,
  sound: true,
  volume: 0.85,
  allowSkip: true,
  reducedMotion: false
}

const BOOL_KEYS = ['enabled', 'sound', 'allowSkip', 'reducedMotion']
const ENUMS = {
  mode: ['session', 'daily', 'always']
}
const RANGES = {
  instrumentOpacity: [0, 1],
  whaleOpacity: [0, 0.6],
  coreShade: [0, 0.95],
  volume: [0, 1]
}

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue
    const value = src[key]
    if (value === undefined || value === null) continue
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (RANGES[key]) {
      const [lo, hi] = RANGES[key]
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    }
  }
  return out
}

function readConfig() {
  try {
    return normalize(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs || cache.size !== st.size) {
        cache = { mtimeMs: st.mtimeMs, size: st.size, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      cache = null
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')
const readPreviewHtml = makeReader('preview/index.html')

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

const CRITICAL_CSS = [
  'html.moss-lock,html.moss-lock body{overflow:hidden!important}',
  '#dsh-moss-root{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

/** 首屏兜底：脚本 404、语法错或被拦时，10.5 秒后无条件放行。 */
const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_MOSS__||{};
var root=document.getElementById('dsh-moss-root');
function seen(store,key,val){try{var s=window[store];return !!s&&s.getItem(key)===val}catch(e){return false}}
function mark(store,key,val){try{var s=window[store];if(s)s.setItem(key,val)}catch(e){}}
var off=!c.enabled;
if(!off&&c.mode==='session'&&seen('sessionStorage','dsh-startup-moss:shown','1'))off=true;
if(!off&&c.mode==='daily'&&seen('localStorage','dsh-startup-moss:day',new Date().toISOString().slice(0,10)))off=true;
if(off){window.__DSH_MOSS_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{
document.documentElement.classList.add('moss-lock');
if(c.mode==='session')mark('sessionStorage','dsh-startup-moss:shown','1');
if(c.mode==='daily')mark('localStorage','dsh-startup-moss:day',new Date().toISOString().slice(0,10));
setTimeout(function(){try{
var r=document.getElementById('dsh-moss-root');
if(r&&r.className&&r.className.indexOf('moss-boot')!==-1){
if(r.parentNode)r.parentNode.removeChild(r);
document.documentElement.classList.remove('moss-lock');
if(document.body)document.body.style.overflow='';
window.__DSH_MOSS_FAILED__=true;
}
}catch(e){}},10500);
}
}catch(e){} })()`

const ASSET_TYPES = {
  'moss-core.mp4': 'video/mp4',
  'dune-hud.mp4': 'video/mp4',
  'whale.svg': 'image/svg+xml'
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim())
  if (!m) return null
  if (m[1] === '' && m[2] === '') return { invalid: true }
  if (!Number.isFinite(size) || size <= 0) return { invalid: true }
  let start
  let end
  if (m[1] === '') {
    const n = Number(m[2])
    if (!Number.isFinite(n) || n <= 0) return { invalid: true }
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Number(m[2])
    if (end > size - 1) end = size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) {
    return { invalid: true }
  }
  return { start, end }
}

function readAssetSlice(file, start, end) {
  const length = end - start + 1
  const buf = Buffer.alloc(length)
  const fd = fs.openSync(file, 'r')
  try {
    let offset = 0
    while (offset < length) {
      const n = fs.readSync(fd, buf, offset, length - offset, start + offset)
      if (n <= 0) break
      offset += n
    }
    return offset === length ? buf : buf.subarray(0, offset)
  } finally {
    try { fs.closeSync(fd) } catch (err) { /* close 失败不影响响应 */ }
  }
}

/* ── 真实事实采集 ──────────────────────────────────────────────────────── */

const factsCache = { value: null, started: false }

function collectFacts(ctx) {
  if (factsCache.started) return factsCache.value
  factsCache.started = true
  const facts = { ready: false }
  factsCache.value = facts
  const get = (name) => {
    try { return typeof ctx.get === 'function' ? ctx.get(name) : undefined } catch (err) { return undefined }
  }

  ;(async () => {
    try {
      const pc = get('profileContext') || {}
      facts.profile = pc.name ? String(pc.name).toUpperCase() : null
      facts.workspace = pc.cwd ? String(pc.cwd).split(/[\\/]/).filter(Boolean).pop() : null
      facts.bundleCount = Array.isArray(pc.startedBundles) ? pc.startedBundles.length : null
    } catch (err) { /* noop */ }

    try {
      const pm = get('pluginManager')
      if (pm && typeof pm.listBundles === 'function') {
        const list = await pm.listBundles()
        if (Array.isArray(list) && list.length) {
          facts.bundleCount = list.length
          const base = list.find((b) => b && /dsh-base$/.test(String(b.name || '')))
          const core = base || list[0]
          if (core && core.version) facts.version = String(core.version).replace(/^v/, '')
        }
      }
    } catch (err) { /* noop */ }

    try {
      const md = get('agentDefaultModel')
      if (md && typeof md.currentSelection === 'function') {
        const selection = await md.currentSelection()
        facts.model = selection && selection.model ? String(selection.model) : null
      }
    } catch (err) { /* noop */ }

    try {
      const sessions = get('sessions')
      if (sessions && typeof sessions.list === 'function') {
        const list = await sessions.list()
        if (Array.isArray(list)) facts.sessions = list.length
      }
    } catch (err) { /* noop */ }

    facts.ready = true
  })().catch(() => { facts.ready = true })

  return facts
}

const name = NS
const inject = ['webServer', 'connection']

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  try { collectFacts(ctx) } catch (err) { /* 事实采集失败不影响启动 */ }
  const disposers = []
  const warned = new Set()
  const webServer = resolveWebServer(ctx)

  function warnOnce(key, message) {
    if (warned.has(key)) return
    warned.add(key)
    try { ctx.logger?.warn?.('[' + NS + '] ' + message) } catch (err) { /* noop */ }
  }

  if (!hasRoutes(webServer)) {
    warnOnce('no-webserver',
      '当前 profile 没有可用的 webServer；Host 半侧跳过路由与首屏注入，改由设置页客户端自举。')
    return
  }

  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function sendText(res, type, text, code = 200) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(code, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limit) {
          try { req.destroy?.() } catch (err) { /* noop */ }
          resolve('')
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => {
      const text = readSplashCss()
      if (!text) warnOnce('splash-css', 'lib/splash.css 读取失败，本次返回空样式（关键兜底 CSS 仍生效）。')
      sendText(res, 'text/css; charset=utf-8', text)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => {
      const text = readSplashJs()
      if (!text) warnOnce('splash-js', 'lib/splash.js 读取失败，本次返回空脚本（10.5 秒兜底放行仍生效）。')
      sendText(res, 'application/javascript; charset=utf-8', text)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/preview',
    handler: (req, res) => {
      const html = readPreviewHtml()
      if (!html) {
        sendText(res, 'text/plain; charset=utf-8', 'preview not found', 404)
        return
      }
      sendText(res, 'text/html; charset=utf-8', html)
    }
  }))

  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const method = String(req.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Allow': 'GET, HEAD' })
        res.end()
        return
      }
      const prefix = ROUTE_BASE + '/asset/'
      const pathname = String(req.url || '').split('?')[0].split('#')[0]
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404)
        res.end()
        return
      }
      let assetName
      try {
        assetName = decodeURIComponent(pathname.slice(prefix.length))
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }
      const type = Object.prototype.hasOwnProperty.call(ASSET_TYPES, assetName) ? ASSET_TYPES[assetName] : null
      if (!type || assetName.includes('/') || assetName.includes('\\') || assetName.includes('..')) {
        res.writeHead(404)
        res.end()
        return
      }
      const file = path.join(PACKAGE_ROOT, 'lib', 'assets', assetName)
      let size
      try {
        const st = fs.statSync(file)
        if (!st.isFile()) throw new Error('not a file')
        size = st.size
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }

      const rangeHeader = req.headers ? (req.headers.range || req.headers.Range) : ''
      const range = rangeHeader ? parseRange(rangeHeader, size) : null
      if (range && range.invalid) {
        res.writeHead(416, {
          'Content-Type': type,
          'Accept-Ranges': 'bytes',
          'Content-Range': 'bytes */' + size,
          'Content-Length': '0'
        })
        res.end()
        return
      }

      const headOnly = method === 'HEAD'
      const headers = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      }
      if (!range) {
        headers['Content-Length'] = String(size)
        if (headOnly) {
          res.writeHead(200, headers)
          res.end()
          return
        }
        let bytes
        try {
          bytes = fs.readFileSync(file)
        } catch (err) {
          res.writeHead(404)
          res.end()
          return
        }
        res.writeHead(200, headers)
        res.end(bytes)
        return
      }

      let bytes
      try {
        bytes = headOnly ? null : readAssetSlice(file, range.start, range.end)
      } catch (err) {
        res.writeHead(404)
        res.end()
        return
      }
      headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + size
      headers['Content-Length'] = String(range.end - range.start + 1)
      res.writeHead(206, headers)
      res.end(bytes === null ? undefined : bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = String(req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          version: PLUGIN_VERSION,
          config: readConfig(),
          defaults: DEFAULTS,
          facts: factsCache.value || { ready: false },
          file: CONFIG_FILE
        })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          sendJson(res, 200, {
            ok: true,
            version: PLUGIN_VERSION,
            config: writeConfig(DEFAULTS),
            defaults: DEFAULTS
          })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        sendJson(res, 200, {
          ok: true,
          version: PLUGIN_VERSION,
          config: writeConfig({ ...current, ...patch }),
          defaults: DEFAULTS
        })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (typeof html !== 'string' || html.includes(ROUTE_BASE + '/splash.js')) return html
    const facts = factsCache.value || { ready: false }
    const cfg = { ...readConfig(), facts }
    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style id="dsh-moss-critical">' + CRITICAL_CSS + '</style>'
    const body =
      '<div id="dsh-moss-root" class="moss-root moss-boot"></div>' +
      '<script>window.__DSH_MOSS_BOOT__="index";' +
      'window.__DSH_MOSS_VERSION__=' + safeJson(PLUGIN_VERSION) + ';' +
      'window.__DSH_MOSS_FACTS__=' + safeJson(facts) + ';' +
      'window.__DSH_MOSS__=' + safeJson(cfg) + ';' + BOOTSTRAP_JS + '</script>' +
      '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

    let out = html
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, head + '</head>')
    else out = head + out
    if (/<body[^>]*>/i.test(out)) out = out.replace(/<body[^>]*>/i, (tag) => tag + body)
    else if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

export { apply, inject, name }
