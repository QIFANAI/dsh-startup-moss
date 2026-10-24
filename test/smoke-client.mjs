import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) {
    pass++
    console.log('  ok   ' + label)
  } else {
    fail++
    console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : ''))
  }
}

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const CODE = fs.readFileSync(CLIENT, 'utf8')
const PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/* ── React stub ─────────────────────────────────────────────────────────── */
const hooks = []
let hookIndex = 0
const ranEffects = new Set()
const React = {
  createElement(type, props, ...children) {
    const kids = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    return { type, props: Object.assign({}, props || {}, { children: kids }) }
  },
  useState(init) {
    const index = hookIndex++
    if (hooks[index] === undefined) hooks[index] = typeof init === 'function' ? init() : init
    return [hooks[index], (next) => {
      hooks[index] = typeof next === 'function' ? next(hooks[index]) : next
    }]
  },
  useEffect(fn) {
    const index = hookIndex++
    if (!ranEffects.has(index)) {
      ranEffects.add(index)
      fn()
    }
  }
}
const resetHooks = () => { hookIndex = 0 }

function walk(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, out))
    return out
  }
  if (node.type) {
    if (typeof node.type === 'function') return walk(node.type(node.props || {}), out)
    out.push(node)
    walk(node.props && node.props.children, out)
  }
  return out
}
function find(node, predicate) {
  return walk(node).find(predicate)
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/* ── 设置面板沙箱 ───────────────────────────────────────────────────────── */
const styleTags = []
const documentStub = {
  body: { style: {} },
  documentElement: { classList: { add() {}, remove() {} } },
  querySelector: () => null,
  createElement: (tag) => ({ tag, dataset: {}, set textContent(value) { this._text = value }, get textContent() { return this._text } }),
  head: { appendChild: (element) => styleTags.push(element) },
  getElementById: () => null
}

const CFG = {
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
const requests = []
const fetchStub = (url, init) => {
  requests.push({ url, init })
  const isPost = init && init.method === 'POST'
  const body = isPost ? JSON.parse(init.body) : null
  let config = CFG
  if (body && body.action === 'reset') config = Object.assign({}, CFG)
  else if (body && body.patch) config = Object.assign({}, CFG, body.patch)
  return Promise.resolve({
    json: () => Promise.resolve(isPost
      ? { ok: true, version: '9.9.9', config, defaults: CFG }
      : {
          ok: true,
          version: '9.9.9',
          config,
          defaults: CFG,
          facts: { version: '1.6.0', profile: 'DESKTOP', sessions: 4, bundleCount: 12, model: 'deepseek-flash' },
          file: 'C:\\Users\\x\\.dsh\\dsh-startup-moss.json'
        })
  })
}

let loaded = null
const windowStub = {
  __ModuleLoader__: { load: (entry) => { loaded = entry } },
  __DSH_MOSS_BOOT__: 'index',
  __DSH_MOSS_VERSION__: '',
  addEventListener() {},
  location: { reload() { windowStub.__reloaded = true } }
}

const sandbox = {
  window: windowStub,
  document: documentStub,
  fetch: fetchStub,
  console,
  Promise, Object, Array, JSON, String, Number, Math, Date, Error, Symbol, isFinite,
  setTimeout, clearTimeout
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(CODE, sandbox, { filename: 'client.js' })

check('调用了 ModuleLoader.load', loaded !== null)
check('注册 id 等于 loader entry 名', loaded && loaded.id === 'dsh-startup-moss', loaded && loaded.id)
check('提供 factory', loaded && typeof loaded.factory === 'function')

const mod = loaded.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
check('exports.inject = ["slots"]', Array.isArray(mod.inject) && mod.inject.length === 1 && mod.inject[0] === 'slots')
check('exports.apply 是函数', typeof mod.apply === 'function')
check('注入设置页样式', styleTags.length === 1 && styleTags[0].dataset.pluginCss === 'dsh-startup-moss/main.css')

let registration = null
const ctx = {
  slots: {
    inject(name, fn) {
      check('槽位名 = settings.section', name === 'settings.section', name)
      return fn()
    },
    register(options, render) {
      registration = { options, render }
      return { dispose() {} }
    }
  }
}
mod.apply(ctx)
check('注册 settings.section', registration !== null)
check('options.id = startup-moss', registration && registration.options.id === 'startup-moss', registration && registration.options.id)
check('options.order = 28', registration && registration.options.order === 28, registration && registration.options.order)
check('options.label = MOSS 启动动画', registration && registration.options.label === 'MOSS 启动动画', registration && registration.options.label)

function renderPanel() {
  const element = registration.render({ close() {} })
  resetHooks()
  return element.type(element.props)
}

let tree = renderPanel()
check('首屏显示读取配置中', JSON.stringify(tree).includes('读取配置中'))
await flush()
await flush()
tree = renderPanel()
check('GET /dsh-moss/config 被调用', requests.some((request) => request.url === '/dsh-moss/config' && (!request.init || !request.init.method)))

const texts = walk(tree)
  .filter((node) => typeof node.props.children === 'string')
  .map((node) => node.props.children)
for (const label of [
  '启用启动动画', '播放时机', '允许 Esc 跳过', '减弱动态',
  'Dune 仪表透明度', '白色大鱼背景透明度', '中心暗化',
  '播放 550W 原声', '音量'
]) {
  check('渲染字段：' + label, texts.includes(label))
}
const versionNode = find(tree, (node) => node.props && node.props.className === '__ms_version')
check('版本号来自配置接口', versionNode && versionNode.props.children === '版本 v9.9.9', versionNode && versionNode.props.children)
check('渲染保存/恢复默认/放弃修改', ['保存', '恢复默认', '放弃修改'].every((label) =>
  !!find(tree, (node) => node.type === 'button' && node.props.children === label)
))

const instrumentRange = find(tree, (node) =>
  node.type === 'input' && node.props.type === 'range' && node.props.value === 0.55
)
check('仪表透明度滑杆回填 0.55', !!instrumentRange, instrumentRange && instrumentRange.props.value)
instrumentRange.props.onChange({ target: { value: '0.9' } })
tree = renderPanel()
const changedRange = find(tree, (node) =>
  node.type === 'input' && node.props.type === 'range' && node.props.value === 0.9
)
check('滑动后草稿变为 0.9', !!changedRange)

const soundCheckbox = find(tree, (node) => node.type === 'input' && node.props.type === 'checkbox' && node.props.checked === true)
check('渲染布尔开关', !!soundCheckbox)

const saveButton = find(tree, (node) => node.type === 'button' && node.props.children === '保存')
saveButton.props.onClick()
await flush()
await flush()
await flush()
const savePost = requests.filter((request) => request.init && request.init.method === 'POST').pop()
check('保存 POST 到 /dsh-moss/config', savePost && savePost.url === '/dsh-moss/config')
check('保存 POST 体包含 instrumentOpacity=0.9', savePost && JSON.parse(savePost.init.body).patch.instrumentOpacity === 0.9)
tree = renderPanel()
check('保存后提示已保存', JSON.stringify(tree).includes('已保存'))

const resetButton = find(tree, (node) => node.type === 'button' && node.props.children === '恢复默认')
resetButton.props.onClick()
await flush()
await flush()
const resetPost = requests.filter((request) => request.init && request.init.method === 'POST').pop()
check('恢复默认 POST {action:"reset"}', resetPost && JSON.parse(resetPost.init.body).action === 'reset')

windowStub.__DSH_MOSS_API__ = { replay() { windowStub.__replayed = true } }
const previewButton = find(tree, (node) => node.type === 'button' && node.props.children === '预览')
check('渲染预览按钮', !!previewButton)
previewButton.props.onClick()
check('预览调用 __DSH_MOSS_API__.replay()', windowStub.__replayed === true)
delete windowStub.__DSH_MOSS_API__
previewButton.props.onClick()
check('无 API 时回退 reload()', windowStub.__reloaded === true)

/* ── Electron 自举沙箱 ──────────────────────────────────────────────────── */
class Elem {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.children = []
    this.parentNode = null
    this.dataset = {}
    this.style = {}
    this.attrs = {}
    this.textContent = ''
    this._listeners = {}
    this.className = ''
    this.classList = {
      _set: new Set(),
      add: (className) => {
        this.classList._set.add(className)
        this.className = [...this.classList._set].join(' ')
      },
      remove: (className) => {
        this.classList._set.delete(className)
        this.className = [...this.classList._set].join(' ')
      },
      contains: (className) => this.classList._set.has(className)
    }
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.children.push(child)
    return child
  }
  removeChild(child) {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parentNode = null
    return child
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value)
    if (name === 'id') this.id = String(value)
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null
  }
  addEventListener(type, fn) {
    ;(this._listeners[type] || (this._listeners[type] = [])).push(fn)
  }
  emit(type) {
    for (const fn of this._listeners[type] || []) fn({ type })
  }
}

function descendants(node, out = []) {
  for (const child of node.children || []) {
    out.push(child)
    descendants(child, out)
  }
  return out
}

function makeStorage(seed) {
  const map = new Map(Object.entries(seed || {}))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) }
  }
}

function bootSelf(options = {}) {
  const html = new Elem('html')
  const head = new Elem('head')
  const body = new Elem('body')
  const warnings = []
  const timers = []
  const requested = []
  const all = []

  const documentStub = {
    head,
    body,
    documentElement: html,
    querySelector: () => null,
    createElement(tag) {
      const element = new Elem(tag)
      if (tag === 'div') element.id = ''
      all.push(element)
      return element
    },
    getElementById(id) {
      return [head, body].concat(descendants(head), descendants(body))
        .find((element) => element.id === id || element.attrs.id === id) || null
    }
  }
  const win = {
    __ModuleLoader__: { load: (entry) => { win.__loaded = entry } },
    location: { href: 'http://127.0.0.1:3080/', reload() { win.__reloaded = true } },
    addEventListener() {},
    sessionStorage: makeStorage(options.session),
    localStorage: makeStorage(options.local),
    setTimeout(fn, ms) {
      timers.push({ fn, ms })
      return timers.length
    },
    clearTimeout() {},
    fetch(url) {
      requested.push({ url })
      return Promise.resolve({
        json: () => Promise.resolve(options.api || {
          ok: true,
          config: options.config || { enabled: true, mode: 'session' },
          facts: { version: '1.6.0', profile: 'DESKTOP', sessions: 4, bundleCount: 12, model: 'deepseek-flash' }
        })
      })
    }
  }
  win.window = win
  const sandbox = {
    window: win,
    document: documentStub,
    fetch: win.fetch,
    console: {
      log() {},
      warn: (...args) => warnings.push(args.map(String).join(' ')),
      error() {}
    },
    Promise, Object, Array, JSON, String, Number, Math, Date, Error, Symbol, isFinite, RegExp,
    setTimeout: win.setTimeout,
    clearTimeout: win.clearTimeout
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(CODE, sandbox, { filename: 'client.js' })
  const react = {
    createElement(type, props, ...children) {
      const kids = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
      return { type, props: Object.assign({}, props || {}, { children: kids }) }
    },
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useEffect: () => {}
  }
  const mod = win.__loaded.factory((name) => {
    if (name === 'react') return react
    throw new Error('unexpected require: ' + name)
  })
  const registrations = []
  mod.apply({
    slots: {
      inject: (slot, fn) => fn(),
      register: (options, render) => {
        registrations.push({ options, render })
        return { dispose() {} }
      }
    }
  })
  return { win, html, head, body, all, warnings, timers, requested, document: documentStub, registrations }
}

const settle = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => setImmediate(resolve))
}

const first = bootSelf()
await settle()
const firstRoot = first.document.getElementById('dsh-moss-root')
check('自举设置 BOOT=client', first.win.__DSH_MOSS_BOOT__ === 'client', first.win.__DSH_MOSS_BOOT__)
check('自举读取 /dsh-moss/config', first.requested.some((request) => request.url === '/dsh-moss/config'))
check('自举创建根节点', !!firstRoot)
check('根节点带 moss-boot', firstRoot && firstRoot.className.includes('moss-boot'), firstRoot && firstRoot.className)
check('自举锁定页面 moss-lock', first.html.classList.contains('moss-lock'))
check('自举写 session 已播标记', first.win.sessionStorage.getItem('dsh-startup-moss:shown') === '1')
check('自举挂 CSS', first.head.children.some((element) => element.tagName === 'LINK' && element.href === '/dsh-moss/splash.css'))
check('自举保留 10.5 秒看门狗', first.timers.some((timer) => timer.ms === 10500))
check('自举后设置面板仍注册', first.registrations.length === 1 && first.registrations[0].options.id === 'startup-moss')

const cssLink = first.head.children.find((element) => element.tagName === 'LINK')
cssLink.emit('load')
await settle()
const runtimeScript = first.head.children.find((element) => element.tagName === 'SCRIPT')
check('CSS 就绪后挂 splash.js', !!runtimeScript && String(runtimeScript.src).startsWith('/dsh-moss/splash.js?t='), runtimeScript && runtimeScript.src)
runtimeScript.emit('error')
await settle()
check('运行时载入失败 → 移除根节点', first.document.getElementById('dsh-moss-root') === null)
check('运行时载入失败 → 解开滚动锁', !first.html.classList.contains('moss-lock'))
check('运行时载入失败 → 打 FAILED 标记', first.win.__DSH_MOSS_FAILED__ === true)
check('运行时载入失败 → 输出警告', first.warnings.some((warning) => warning.includes('自举失败')))

const disabled = bootSelf({ config: { enabled: false, mode: 'session' } })
await settle()
check('enabled=false → 不创建根节点', disabled.document.getElementById('dsh-moss-root') === null)
check('enabled=false → 不写已播标记', disabled.win.sessionStorage.getItem('dsh-startup-moss:shown') === null)

const seen = bootSelf({
  config: { enabled: true, mode: 'session' },
  session: { 'dsh-startup-moss:shown': '1' }
})
await settle()
check('session 已播 → 不重复创建根节点', seen.document.getElementById('dsh-moss-root') === null)

check('兜底版本与 package.json 一致', PKG.version === '0.1.1', PKG.version)

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
