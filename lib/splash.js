/* ============================================================================
 * dsh-startup-moss — 零点击启动运行时
 * ----------------------------------------------------------------------------
 * 0–0.8s  DSH 外壳就位，Dune 仪表淡入
 * 0.8–1.2s Dune 完整运行，550W 不可见
 * 1.2–1.8s 550W 核心淡入
 * 1.8–6.7s 双素材完整停留
 * 6.7–7.2s Dune 退场
 * 6.9–7.3s 550W 退场
 * 7.15–7.65s 收尾卡交叉淡入
 * 8.8s     释放宿主
 *
 * 无点击门槛、无 SKIP/REPLAY 按钮、无声音授权弹窗。
 * 音频自动播放被拦时静音继续；视频失败时保留文字与程序化仪表。
 * 素材先经 fetch 转 blob 再挂载：dsh-app:// 直连视频不可 seek，blob 可恢复精确定位。
 * ========================================================================== */
(function () {
  'use strict'

  if (window.__DSH_MOSS_BOOTED__) return
  window.__DSH_MOSS_BOOTED__ = true

  var ROOT_ID = 'dsh-moss-root'
  var ASSET = window.__DSH_MOSS_ASSET_BASE__ || '/dsh-moss/asset/'
  var CORE_URL = ASSET + 'moss-core.mp4'
  var DUNE_URL = ASSET + 'dune-hud.mp4'
  var WHALE_URL = ASSET + 'whale.svg'
  var DURATION = 8.8
  var DUNE_START = 22
  var DUNE_FADE_OUT = 6.7
  var CORE_FADE_IN = 1.2
  var CORE_FADE_OUT = 6.9
  var END_FADE = 7.15

  var DEFAULTS = {
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

  function clamp(value, lo, hi, fallback) {
    var n = Number(value)
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
  }

  function bool(value, fallback) {
    if (value === false || value === 'false' || value === 0 || value === '0') return false
    if (value === true || value === 'true' || value === 1 || value === '1') return true
    return fallback
  }

  function normalize(input) {
    var src = input && typeof input === 'object' ? input : {}
    var cfg = {}
    var key
    for (key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) cfg[key] = DEFAULTS[key]
    }
    cfg.enabled = bool(src.enabled, DEFAULTS.enabled)
    if (src.mode === 'session' || src.mode === 'daily' || src.mode === 'always') cfg.mode = src.mode
    cfg.instrumentOpacity = clamp(src.instrumentOpacity, 0, 1, DEFAULTS.instrumentOpacity)
    cfg.whaleOpacity = clamp(src.whaleOpacity, 0, 0.6, DEFAULTS.whaleOpacity)
    cfg.coreShade = clamp(src.coreShade, 0, 0.95, DEFAULTS.coreShade)
    cfg.sound = bool(src.sound, DEFAULTS.sound)
    cfg.volume = clamp(src.volume, 0, 1, DEFAULTS.volume)
    cfg.allowSkip = bool(src.allowSkip, DEFAULTS.allowSkip)
    cfg.reducedMotion = bool(src.reducedMotion, DEFAULTS.reducedMotion)
    return cfg
  }

  var injected = window.__DSH_MOSS__ || {}
  var cfg = normalize(injected)
  var facts = window.__DSH_MOSS_FACTS__ || injected.facts || {}
  var previewT = Number(window.__DSH_MOSS_PREVIEW_T__)
  var isPreviewFreeze = isFinite(previewT) && previewT >= 0
  var previewFail = String(window.__DSH_MOSS_PREVIEW_FAIL__ || '')
    .split(',')
    .map(function (item) { return item.trim() })
  var forceMotion = window.__DSH_MOSS_FORCE_MOTION__ === true
  var reduced = forceMotion ? false : cfg.reducedMotion

  var root = document.getElementById(ROOT_ID)
  if (!root) {
    if (window.__DSH_MOSS_SKIP__ || !cfg.enabled) return
    root = document.createElement('div')
    root.id = ROOT_ID
    if (document.body) document.body.appendChild(root)
  }

  if (window.__DSH_MOSS_SKIP__) return
  if (!cfg.enabled) {
    if (root.parentNode) root.parentNode.removeChild(root)
    document.documentElement.classList.remove('moss-lock')
    if (document.body && document.body.style) document.body.style.overflow = ''
    window.__DSH_MOSS_API__ = {
      replay: function () {},
      skip: function () {},
      finish: function () {},
      state: 'disabled',
      progress: 1
    }
    return
  }

  root.className = 'moss-root moss-boot'
  root.innerHTML = [
    '<div class="moss-stage" data-stage>',
    '  <img class="moss-whale-bg" src="' + WHALE_URL + '" alt="">',
    '  <div class="moss-vignette"></div>',
    '  <div class="moss-frame">',
    '    <i class="moss-corner moss-tl"></i><i class="moss-corner moss-tr"></i>',
    '    <i class="moss-corner moss-bl"></i><i class="moss-corner moss-br"></i>',
    '  </div>',
    '  <div class="moss-top-tag">MOSS CORE <b>//</b> 550W <b>//</b> INSTRUMENT LAYER</div>',
    '  <div class="moss-box">',
    '    <video class="moss-dune" muted playsinline preload="auto"></video>',
    '    <div class="moss-fallback-ring" aria-hidden="true"><i></i><i></i><i></i><b></b></div>',
    '    <div class="moss-shade"></div>',
    '    <video class="moss-core" playsinline preload="auto"></video>',
    '    <div class="moss-core-fallback">',
    '      <div class="moss-fallback-mark">55<span>0</span>W</div>',
    '      <div class="moss-fallback-sub">MOSS CORE // 550W</div>',
    '      <div class="moss-fallback-note">LOCAL FALLBACK / SIGNAL DEGRADED</div>',
    '    </div>',
    '    <div class="moss-scan"></div>',
    '    <div class="moss-box-tag">CORE VIEW <b>//</b> 550W [MOSS]</div>',
    '    <div class="moss-box-bar"><i></i></div>',
    '    <div class="moss-box-meta">LAYER 01 MOSS 550W / LAYER 02 DUNE HUD / LAYER 03 DSH SHELL</div>',
    '    <div class="moss-end-card">',
    '      <img class="moss-end-whale" src="' + WHALE_URL + '" alt="">',
    '      <div class="moss-end-en">DEEPSEEK</div>',
    '      <div class="moss-end-os">HARNESS OS</div>',
    '      <div class="moss-end-line"></div>',
    '      <div class="moss-end-state">MOSS CORE ONLINE</div>',
    '      <div class="moss-end-sub">SYNTHESIZE INTELLIGENCE</div>',
    '    </div>',
    '  </div>',
    '  <div class="moss-box-edge">',
    '    <i class="moss-tl"></i><i class="moss-tr"></i><i class="moss-bl"></i><i class="moss-br"></i>',
    '  </div>',
    '  <div class="moss-brand">',
    '    <div class="moss-brand-en">DEEPSEEK</div>',
    '    <div class="moss-brand-os">HARNESS <b>OS</b></div>',
    '    <div class="moss-brand-sub">SYNTHESIZE INTELLIGENCE</div>',
    '  </div>',
    '  <div class="moss-meta">',
    '    <div data-meta-rev></div>',
    '    <div data-meta-counts></div>',
    '    <div data-meta-model></div>',
    '  </div>',
    '  <div class="moss-rail moss-left">DEEPSEEK HARNESS // MOSS CORE</div>',
    '  <div class="moss-rail moss-right">INSTRUMENT LAYER / DUNE HUD</div>',
    '  <div class="moss-status">',
    '    <div><i></i>CORE ONLINE</div>',
    '    <div><i></i>MEMORY SYNC</div>',
    '    <div><i></i>OPERATOR LINK</div>',
    '  </div>',
    '  <div class="moss-corner-mark">DEEPSEEK<br>HARNESS OS</div>',
    '  <div class="moss-foot">DEEPSEEK HARNESS // MOSS CORE ONLINE</div>',
    '</div>'
  ].join('')

  var stage = root.querySelector('[data-stage]')
  var core = root.querySelector('.moss-core')
  var dune = root.querySelector('.moss-dune')
  var coreFallback = root.querySelector('.moss-core-fallback')
  var fallbackRing = root.querySelector('.moss-fallback-ring')
  var endCard = root.querySelector('.moss-end-card')
  var metaRev = root.querySelector('[data-meta-rev]')
  var metaCounts = root.querySelector('[data-meta-counts]')
  var metaModel = root.querySelector('[data-meta-model]')

  var coreFailed = previewFail.indexOf('core') >= 0
  var duneFailed = previewFail.indexOf('dune') >= 0
  var running = false
  var state = 'boot'
  var startedAt = 0
  var raf = 0
  var hardStop = 0
  var replayToken = 0
  var blobCache = {}
  var blobPending = {}

  function clockNow() {
    return window.performance && typeof window.performance.now === 'function'
      ? window.performance.now()
      : Date.now()
  }

  function requestFrame(fn) {
    if (typeof window.requestAnimationFrame === 'function') return window.requestAnimationFrame(fn)
    return window.setTimeout(function () { fn(clockNow()) }, 16)
  }

  function cancelFrame(id) {
    if (!id) return
    if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(id)
    else window.clearTimeout(id)
  }

  function fact(value) {
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  function applyFacts() {
    var profile = facts.profile ? String(facts.profile).toUpperCase() + ' PROFILE' : '— PROFILE'
    metaRev.textContent = 'REV ' + fact(facts.version) + ' · ' + profile
    metaCounts.textContent = 'SESSIONS ' + fact(facts.sessions) + ' · BUNDLES ' + fact(facts.bundleCount)
    metaModel.textContent = 'MODEL ' + fact(facts.model)
  }

  function fit() {
    var width = window.innerWidth || 1920
    var height = window.innerHeight || 1080
    var scale = Math.max(0.1, Math.min(width / 1920, height / 1080))
    root.style.setProperty('--moss-scale', scale.toFixed(5))
  }

  function applyConfig() {
    reduced = forceMotion ? false : cfg.reducedMotion
    root.style.setProperty('--moss-instrument', cfg.instrumentOpacity.toFixed(3))
    root.style.setProperty('--moss-whale-opacity', cfg.whaleOpacity.toFixed(3))
    root.style.setProperty('--moss-shade', cfg.coreShade.toFixed(3))
    if (reduced) root.classList.add('moss-reduced')
    else root.classList.remove('moss-reduced')
    try {
      core.volume = cfg.volume
      core.muted = !cfg.sound
      dune.volume = 0
      dune.muted = true
    } catch (err) { /* 媒体属性失败不影响画面 */ }
    applyFacts()
    fit()
  }

  function lockPage() {
    try {
      document.documentElement.classList.add('moss-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'
    } catch (err) { /* noop */ }
  }

  function unlockPage() {
    try {
      document.documentElement.classList.remove('moss-lock')
      if (document.body && document.body.style) document.body.style.overflow = ''
    } catch (err) { /* noop */ }
  }

  function markShown() {
    try {
      if (cfg.mode === 'session') window.sessionStorage.setItem('dsh-startup-moss:shown', '1')
      if (cfg.mode === 'daily') {
        window.localStorage.setItem('dsh-startup-moss:day', new Date().toISOString().slice(0, 10))
      }
    } catch (err) { /* 隐私模式忽略 */ }
  }

  function clearShown() {
    try {
      window.sessionStorage.removeItem('dsh-startup-moss:shown')
      window.localStorage.removeItem('dsh-startup-moss:day')
    } catch (err) { /* noop */ }
  }

  function markFailed(kind) {
    if (kind === 'core') {
      coreFailed = true
      core.dataset.failed = '1'
      core.style.visibility = 'hidden'
    } else {
      duneFailed = true
      dune.dataset.failed = '1'
      dune.style.visibility = 'hidden'
    }
  }

  function ready(video, timeoutMs) {
    if (video.dataset.failed === '1' || video.readyState >= 1) return Promise.resolve()
    return new Promise(function (resolve) {
      var done = false
      var timer = window.setTimeout(finishReady, timeoutMs || 1800)
      function finishReady() {
        if (done) return
        done = true
        window.clearTimeout(timer)
        video.removeEventListener('loadedmetadata', finishReady)
        video.removeEventListener('error', finishReady)
        resolve()
      }
      video.addEventListener('loadedmetadata', finishReady, { once: true })
      video.addEventListener('error', finishReady, { once: true })
    })
  }

  function waitFrame(video) {
    if (typeof video.requestVideoFrameCallback !== 'function') return Promise.resolve()
    return new Promise(function (resolve) {
      var done = false
      var timer = window.setTimeout(finishFrame, 500)
      function finishFrame() {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve()
      }
      video.requestVideoFrameCallback(finishFrame)
    })
  }

  function seekVideo(video, target, timeoutMs) {
    if (video.dataset.failed === '1' || video.readyState < 1) return Promise.resolve()
    var max = isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : target
    var value = Math.max(0, Math.min(target, max))
    if (Math.abs(video.currentTime - value) < 0.03) return waitFrame(video)
    return new Promise(function (resolve) {
      var done = false
      var timer = window.setTimeout(finishSeek, timeoutMs || 1500)
      function finishSeek() {
        if (done) return
        done = true
        window.clearTimeout(timer)
        video.removeEventListener('seeked', finishSeek)
        waitFrame(video).then(resolve)
      }
      video.addEventListener('seeked', finishSeek, { once: true })
      try {
        video.currentTime = value
      } catch (err) {
        finishSeek()
      }
    })
  }

  function pauseMedia() {
    try { core.pause() } catch (err) { /* noop */ }
    try { dune.pause() } catch (err) { /* noop */ }
  }

  function loadBlob(url) {
    if (blobCache[url]) return Promise.resolve(blobCache[url])
    if (blobPending[url]) return blobPending[url]
    var canBlob = !!(window.fetch && window.Blob && window.URL && typeof window.URL.createObjectURL === 'function')
    if (!canBlob) return Promise.resolve('')
    var request = window.fetch(url, { cache: 'force-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('asset ' + response.status)
        return response.blob()
      })
      .then(function (blob) {
        var objectUrl = window.URL.createObjectURL(blob)
        blobCache[url] = objectUrl
        return objectUrl
      })
      .catch(function () { return '' })
    blobPending[url] = Promise.race([
      request,
      new Promise(function (resolve) {
        window.setTimeout(function () { resolve('') }, 2600)
      })
    ])
    return blobPending[url]
  }

  function resetMedia() {
    coreFailed = false
    duneFailed = false
    core.dataset.failed = ''
    dune.dataset.failed = ''
    core.style.visibility = ''
    dune.style.visibility = ''
    var failCore = previewFail.indexOf('core') >= 0
    var failDune = previewFail.indexOf('dune') >= 0
    if (failCore) markFailed('core')
    if (failDune) markFailed('dune')
    var jobs = []
    if (!failCore) {
      jobs.push(loadBlob(CORE_URL).then(function (objectUrl) {
        if (coreFailed) return
        try {
          core.src = objectUrl || CORE_URL
          core.load()
        } catch (err) { markFailed('core') }
      }))
    }
    if (!failDune) {
      jobs.push(loadBlob(DUNE_URL).then(function (objectUrl) {
        if (duneFailed) return
        try {
          dune.src = objectUrl || DUNE_URL
          dune.load()
        } catch (err) { markFailed('dune') }
      }))
    }
    return Promise.all(jobs)
  }

  function playMedia() {
    try {
      core.currentTime = 0
      dune.currentTime = DUNE_START
    } catch (err) { /* noop */ }
    if (reduced) {
      Promise.all([
        seekVideo(core, 2.8),
        seekVideo(dune, DUNE_START + 2.8)
      ]).then(pauseMedia)
      return
    }
    core.muted = !cfg.sound
    core.volume = cfg.volume
    dune.muted = true
    dune.volume = 0
    var corePlay = core.play()
    if (corePlay && typeof corePlay.catch === 'function') {
      corePlay.catch(function () {
        core.muted = true
        var retry = core.play()
        if (retry && typeof retry.catch === 'function') retry.catch(function () {})
      })
    }
    var dunePlay = dune.play()
    if (dunePlay && typeof dunePlay.catch === 'function') dunePlay.catch(function () {})
  }

  function render(t) {
    var coreIn = Math.max(0, Math.min(1, (t - CORE_FADE_IN) / 0.6))
    var coreOut = 1 - Math.max(0, Math.min(1, (t - CORE_FADE_OUT) / 0.4))
    var duneOut = 1 - Math.max(0, Math.min(1, (t - DUNE_FADE_OUT) / 0.5))
    var coreLevel = coreIn * coreOut
    var duneLevel = cfg.instrumentOpacity * Math.max(0, Math.min(1, t / 0.8)) * duneOut

    core.style.opacity = (coreFailed ? 0 : coreLevel).toFixed(3)
    coreFallback.style.opacity = (coreFailed ? coreLevel : 0).toFixed(3)
    dune.style.opacity = (duneFailed ? 0 : duneLevel).toFixed(3)
    fallbackRing.style.opacity = (duneFailed ? duneLevel : 0).toFixed(3)
    endCard.style.opacity = Math.max(0, Math.min(1, (t - END_FADE) / 0.5)).toFixed(3)

    if (state !== 'preview' && state !== 'done') {
      if (t < CORE_FADE_IN) state = 'intro'
      else if (t < DUNE_FADE_OUT) state = 'core'
      else state = 'outro'
    }
  }

  function tick(now) {
    if (!running) return
    var t = Math.min((now - startedAt) / 1000, DURATION)
    render(t)
    if (t >= DURATION) {
      finish('complete')
      return
    }
    raf = requestFrame(tick)
  }

  function finish(reason) {
    if (state === 'done') return
    state = 'done'
    running = false
    cancelFrame(raf)
    raf = 0
    window.clearTimeout(hardStop)
    hardStop = 0
    pauseMedia()
    root.classList.add('moss-done')
    root.setAttribute('aria-hidden', 'true')
    unlockPage()
    window.__DSH_MOSS_DONE__ = true
    window.__DSH_MOSS_FINISH_REASON__ = String(reason || 'complete')
  }

  function startRun() {
    if (state === 'done') return
    window.clearTimeout(hardStop)
    hardStop = window.setTimeout(function () {
      if (state !== 'done' && state !== 'preview') finish('timeout')
    }, 10000)
    root.classList.remove('moss-boot')
    root.classList.add('moss-live')
    state = 'intro'
    render(0)
    Promise.all([ready(core), ready(dune)]).then(function () {
      if (state === 'done') return
      startedAt = clockNow()
      running = true
      raf = requestFrame(tick)
      playMedia()
    })
  }

  function begin(reason) {
    replayToken += 1
    var token = replayToken
    state = 'boot'
    running = false
    cancelFrame(raf)
    raf = 0
    window.clearTimeout(hardStop)
    hardStop = 0
    pauseMedia()
    root.className = 'moss-root moss-boot'
    root.removeAttribute('aria-hidden')
    root.style.display = ''
    lockPage()
    applyConfig()
    var mediaReady = resetMedia()
    markShown()
    render(0)
    if (reason !== 'preview' && token !== replayToken) return
    mediaReady.then(function () {
      if (token !== replayToken) return
      startRun()
    })
  }

  function refreshConfigThenBegin() {
    var token = replayToken + 1
    replayToken = token
    if (typeof window.fetch !== 'function') {
      begin('replay')
      return
    }
    window.fetch('/dsh-moss/config?t=' + Date.now(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) { return response.json() })
      .then(function (payload) {
        if (token !== replayToken) return
        if (payload && payload.ok === true && payload.config) cfg = normalize(payload.config)
        if (payload && payload.facts) facts = payload.facts
      })
      .catch(function () {})
      .then(function () {
        if (token !== replayToken) return
        replayToken -= 1
        begin('replay')
      })
  }

  function replay() {
    clearShown()
    if (state === 'done') {
      root.classList.remove('moss-done')
      root.setAttribute('aria-hidden', 'false')
    }
    refreshConfigThenBegin()
  }

  function skip() {
    finish('skip')
  }

  function freezeAt(t) {
    var at = Math.max(0, Math.min(Number(t), DURATION))
    state = 'preview'
    running = false
    cancelFrame(raf)
    raf = 0
    window.clearTimeout(hardStop)
    hardStop = 0
    root.classList.remove('moss-boot')
    root.classList.add('moss-live')
    lockPage()
    applyConfig()
    render(at)
    resetMedia().then(function () {
      return Promise.all([ready(core), ready(dune)])
    }).then(function () {
      return Promise.all([
        seekVideo(core, at),
        seekVideo(dune, DUNE_START + at)
      ])
    }).then(function () {
      pauseMedia()
      render(at)
    })
  }

  core.addEventListener('error', function () { markFailed('core') })
  dune.addEventListener('error', function () { markFailed('dune') })
  window.addEventListener('resize', fit)
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && cfg.allowSkip && state !== 'done') finish('skip')
  })

  applyConfig()
  if (coreFailed) markFailed('core')
  else core.src = CORE_URL
  if (duneFailed) markFailed('dune')
  else dune.src = DUNE_URL

  Object.defineProperty(window, '__DSH_MOSS_API__', {
    configurable: true,
    value: {
      replay: replay,
      skip: skip,
      finish: finish,
      get state() { return state },
      get progress() {
        if (state === 'done') return 1
        if (state === 'preview') return Math.max(0, Math.min(1, previewT / DURATION))
        if (!running) return 0
        return Math.max(0, Math.min(1, (clockNow() - startedAt) / 1000 / DURATION))
      },
      get facts() { return facts }
    }
  })

  window.__DSH_MOSS_LOADED__ = true
  if (isPreviewFreeze) freezeAt(previewT)
  else begin('boot')
})()
