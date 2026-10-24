/* ============================================================================
 * dsh-startup-moss — 浏览器半侧
 * ----------------------------------------------------------------------------
 * 1) 在 DSH 设置页注册「MOSS 启动动画」
 * 2) Host 的 tapIndex 不生效时（Electron file:// + IPC），由这里自举启动层
 *
 * 配置走插件自带 HTTP API /dsh-moss/config，不依赖 dsh-settings 版本。
 * ========================================================================== */
window.__ModuleLoader__.load({
  id: 'dsh-startup-moss',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement
    var API = '/dsh-moss/config'
    var BOOT_ROUTE = '/dsh-moss'
    var ROOT_ID = 'dsh-moss-root'
    var FALLBACK_VERSION = '0.1.1'

    var FALLBACK = {
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

    var CSS = [
      '.__ms_root{max-width:640px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__ms_top{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ms_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__ms_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__ms_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__ms_field{display:flex;flex-direction:column;gap:5px}',
      '.__ms_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__ms_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__ms_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__ms_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:190px}',
      '.__ms_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__ms_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__ms_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__ms_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__ms_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__ms_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__ms_btn:disabled{opacity:.5;cursor:default}',
      '.__ms_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__ms_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__ms_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__ms_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ms_preview{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ms_previewText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}'
    ].join('')

    var tagId = 'dsh-startup-moss/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-startup-moss'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function Field(props) {
      return h('div', { className: '__ms_field' },
        h('label', { className: '__ms_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__ms_hint' }, props.hint) : null
      )
    }

    function Check(props) {
      return h('label', { className: '__ms_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: function (event) { props.onChange(event.target.checked) }
        }),
        h('span', { className: '__ms_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__ms_hint' }, props.hint) : null
        )
      )
    }

    function Select(props) {
      return h('select', {
        className: '__ms_select',
        value: props.value,
        onChange: function (event) { props.onChange(event.target.value) }
      }, props.options.map(function (option) {
        return h('option', { key: option[0], value: option[0] }, option[1])
      }))
    }

    function Range(props) {
      return h('div', { className: '__ms_row' },
        h('input', {
          type: 'range',
          min: props.min,
          max: props.max,
          step: props.step || 0.01,
          value: props.value,
          disabled: !!props.disabled,
          style: { flex: '1 1 220px' },
          onChange: function (event) { props.onChange(Number(event.target.value)) }
        }),
        h('span', { className: '__ms_status' }, props.display)
      )
    }

    function num(value, fallback) {
      var n = Number(value)
      return isFinite(n) ? n : fallback
    }

    function readInjectedVersion() {
      try {
        return window.__DSH_MOSS_VERSION__ ? String(window.__DSH_MOSS_VERSION__) : ''
      } catch (err) {
        return ''
      }
    }

    function Panel() {
      var draftState = react.useState(null)
      var draft = draftState[0]
      var setDraft = draftState[1]
      var defaultsState = react.useState(null)
      var setDefaults = defaultsState[1]
      var fileState = react.useState('')
      var file = fileState[0]
      var setFile = fileState[1]
      var versionState = react.useState(readInjectedVersion)
      var version = versionState[0]
      var setVersion = versionState[1]
      var errorState = react.useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      var noticeState = react.useState(null)
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var busyState = react.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, payload.config))
            setDefaults(Object.assign({}, FALLBACK, payload.defaults))
            setFile(payload.file || '')
            if (payload.version) setVersion(String(payload.version))
          })
          .catch(function (err) {
            setError('读取配置失败：' + String(err && err.message ? err.message : err))
          })
      }

      react.useEffect(function () { load() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft(function (current) {
          return Object.assign({}, current, { [key]: value })
        })
      }

      function save() {
        if (!draft) return
        setBusy(true)
        setNotice(null)
        setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'save failed')
            setDraft(payload.config)
            setNotice('已保存。点「预览」立即重播，或下次打开 DSH 时生效。')
          })
          .catch(function (err) {
            setError('保存失败：' + String(err && err.message ? err.message : err))
          })
          .then(function () { setBusy(false) })
      }

      function reset() {
        setBusy(true)
        setNotice(null)
        setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'reset failed')
            setDraft(payload.config)
            setNotice('已恢复默认。')
          })
          .catch(function (err) {
            setError('恢复默认失败：' + String(err && err.message ? err.message : err))
          })
          .then(function () { setBusy(false) })
      }

      function preview() {
        var api = window.__DSH_MOSS_API__
        if (api && typeof api.replay === 'function') {
          api.replay()
          return
        }
        window.location.reload()
      }

      var versionLine = h('div', { className: '__ms_version' }, '版本 v' + (version || FALLBACK_VERSION))
      if (!draft) {
        return h('div', { className: '__ms_root' },
          h('div', { className: '__ms_top' },
            versionLine,
            h('button', { className: '__ms_btn', type: 'button', onClick: preview }, '预览')
          ),
          h('div', { className: '__ms_status' }, error || '读取配置中…'),
          error ? h('div', { className: '__ms_actions' },
            h('button', { className: '__ms_btn', type: 'button', onClick: load }, '重试')
          ) : null
        )
      }

      var modeOptions = [
        ['session', '每个浏览器会话一次'],
        ['daily', '每天一次'],
        ['always', '每次打开都播放']
      ]

      return h('div', { className: '__ms_root' },
        h('div', { className: '__ms_top' },
          versionLine,
          h('button', { className: '__ms_btn', type: 'button', onClick: preview }, '预览')
        ),

        h('div', { className: '__ms_group' },
          h('div', { className: '__ms_groupTitle' }, '播放'),
          h(Check, {
            label: '启用启动动画',
            hint: '第一帧自动开始，8.8 秒后自动释放宿主，不需要点击。',
            checked: draft.enabled,
            onChange: function (value) { set('enabled', value) }
          }),
          h(Field, { label: '播放时机' },
            h(Select, {
              value: draft.mode,
              options: modeOptions,
              onChange: function (value) { set('mode', value) }
            })
          ),
          h(Check, {
            label: '允许 Esc 跳过',
            hint: '不显示 SKIP 按钮；打开时仅保留隐藏的 Esc 退出。',
            checked: draft.allowSkip,
            onChange: function (value) { set('allowSkip', value) }
          }),
          h(Check, {
            label: '减弱动态',
            hint: '暂停两段视频的持续运动，只保留淡入淡出与静态仪表，不会黑屏。',
            checked: draft.reducedMotion,
            onChange: function (value) { set('reducedMotion', value) }
          })
        ),

        h('div', { className: '__ms_group' },
          h('div', { className: '__ms_groupTitle' }, '视觉'),
          h(Field, { label: 'Dune 仪表透明度', hint: '仪表环只存在于黑色程序框内，默认 55%。' },
            h(Range, {
              value: num(draft.instrumentOpacity, 0.55),
              min: 0, max: 1, step: 0.01,
              display: Math.round(num(draft.instrumentOpacity, 0.55) * 100) + '%',
              onChange: function (value) { set('instrumentOpacity', value) }
            })
          ),
          h(Field, { label: '白色大鱼背景透明度', hint: '大鱼固定 1920×1920、左上角对齐；这里只改透明度，不改位置与比例。' },
            h(Range, {
              value: num(draft.whaleOpacity, 0.18),
              min: 0, max: 0.6, step: 0.01,
              display: Math.round(num(draft.whaleOpacity, 0.18) * 100) + '%',
              onChange: function (value) { set('whaleOpacity', value) }
            })
          ),
          h(Field, { label: '中心暗化', hint: '压住 550W 背后的仪表线，默认 62%。' },
            h(Range, {
              value: num(draft.coreShade, 0.62),
              min: 0, max: 0.95, step: 0.01,
              display: Math.round(num(draft.coreShade, 0.62) * 100) + '%',
              onChange: function (value) { set('coreShade', value) }
            })
          )
        ),

        h('div', { className: '__ms_group' },
          h('div', { className: '__ms_groupTitle' }, '声音'),
          h(Check, {
            label: '播放 550W 原声',
            hint: '只使用素材自带音轨，不另加 BGM。自动播放被拦截时静音继续，不弹授权提示。',
            checked: draft.sound,
            onChange: function (value) { set('sound', value) }
          }),
          h(Field, { label: '音量' },
            h(Range, {
              value: num(draft.volume, 0.85),
              min: 0, max: 1, step: 0.01,
              disabled: !draft.sound,
              display: Math.round(num(draft.volume, 0.85) * 100) + '%',
              onChange: function (value) { set('volume', value) }
            })
          )
        ),

        h('div', { className: '__ms_preview' },
          h('div', { className: '__ms_previewText' },
            '预览会按刚保存的配置重播一次 8.8 秒开幕。',
            file ? h('div', { style: { marginTop: '4px', opacity: 0.75 } }, '配置文件：' + file) : null
          ),
          h('button', { className: '__ms_btn', type: 'button', onClick: preview }, '预览')
        ),

        h('div', { className: '__ms_actions' },
          h('button', {
            className: '__ms_btn __ms_btnPrimary',
            type: 'button',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__ms_btn', type: 'button', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__ms_btn', type: 'button', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__ms_ok' }, notice) : null,
          error ? h('span', { className: '__ms_err' }, error) : null
        )
      )
    }

    /* ── 桌面端自举 ───────────────────────────────────────────────────────── */

    function readFlag(store, key) {
      try {
        var area = window[store]
        return area ? area.getItem(key) : null
      } catch (err) {
        return null
      }
    }

    function writeFlag(store, key, value) {
      try {
        var area = window[store]
        if (area) area.setItem(key, value)
      } catch (err) { /* noop */ }
    }

    function loadCss(href) {
      return new Promise(function (resolve, reject) {
        var link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.addEventListener('load', function () { resolve() }, { once: true })
        link.addEventListener('error', function () { reject(new Error('css load failed: ' + href)) }, { once: true })
        ;(document.head || document.documentElement).appendChild(link)
      })
    }

    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script')
        script.src = src
        script.async = false
        script.addEventListener('load', function () { resolve() }, { once: true })
        script.addEventListener('error', function () { reject(new Error('script load failed: ' + src)) }, { once: true })
        ;(document.head || document.documentElement).appendChild(script)
      })
    }

    function releaseBoot() {
      try {
        var root = document.getElementById(ROOT_ID)
        if (root && root.parentNode) root.parentNode.removeChild(root)
        document.documentElement.classList.remove('moss-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_MOSS_FAILED__ = true
      } catch (err) { /* noop */ }
    }

    function injectBoot(config, facts) {
      var root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID
        if (document.body) document.body.appendChild(root)
      }
      root.className = 'moss-root moss-boot'
      document.documentElement.classList.add('moss-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      window.__DSH_MOSS__ = Object.assign({}, config, { facts: facts || {} })
      window.__DSH_MOSS_FACTS__ = facts || {}

      window.setTimeout(function () {
        try {
          var current = document.getElementById(ROOT_ID)
          if (current && current.className && current.className.indexOf('moss-boot') !== -1) releaseBoot()
        } catch (err) { /* noop */ }
      }, 10500)

      return loadCss(BOOT_ROUTE + '/splash.css')
        .then(function () { return loadScript(BOOT_ROUTE + '/splash.js?t=' + Date.now()) })
        .catch(function (err) {
          releaseBoot()
          try {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[dsh-startup-moss] 启动层自举失败，已放开页面：' + err.message)
            }
          } catch (e) { /* noop */ }
        })
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_MOSS_BOOT__) return
        if (window.__DSH_MOSS__) return
        if (window.__DSH_MOSS_SKIP__) return
        if (window.__DSH_MOSS_FAILED__ === true) return
        if (document.getElementById(ROOT_ID)) return
        window.__DSH_MOSS_BOOT__ = 'client'

        var fallback = { enabled: true, mode: 'session' }
        window.fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (!payload || payload.ok !== true) return { config: fallback, facts: {} }
            return {
              config: Object.assign({}, fallback, payload.config),
              facts: payload.facts || {}
            }
          })
          .catch(function () {
            return { config: fallback, facts: {} }
          })
          .then(function (result) {
            var config = result.config
            var today = new Date().toISOString().slice(0, 10)
            if (config.enabled === false) return
            if (config.mode === 'session' && readFlag('sessionStorage', 'dsh-startup-moss:shown') === '1') return
            if (config.mode === 'daily' && readFlag('localStorage', 'dsh-startup-moss:day') === today) return
            if (config.mode === 'session') writeFlag('sessionStorage', 'dsh-startup-moss:shown', '1')
            if (config.mode === 'daily') writeFlag('localStorage', 'dsh-startup-moss:day', today)
            return injectBoot(config, result.facts)
          })
          .catch(function () { /* 自举失败不拖垮宿主 */ })
      } catch (err) { /* noop */ }
    }

    var inject = ['slots']

    function apply(ctx) {
      selfBoot()
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'startup-moss', order: 28, label: 'MOSS 启动动画' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
