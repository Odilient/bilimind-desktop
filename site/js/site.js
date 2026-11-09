/* BiliMind Desktop's page: the theme, the nav, the live app in the window with its picker, the
   feature tour, and the download for this visitor's system. A plain script, no build: the page is
   served as it is from GitHub Pages. The window and picker follow bilimind.com's lib/d2/01-hero.js. */
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const phone = () => innerWidth <= 720
  const root = document.documentElement
  const app = $('#demoApp')
  const post = (msg) => {
    try {
      app.contentWindow && app.contentWindow.postMessage(msg, location.origin)
    } catch {
      // the frame is mid-navigation; the next message reaches it
    }
  }

  /* ── theme: system, light or dark, remembered on this browser; the app in the window follows ── */
  const current = () => root.dataset.theme || 'system'
  const isDark = () => current() === 'dark' || (current() === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  function setTheme(value) {
    if (value === 'system') delete root.dataset.theme
    else root.dataset.theme = value
    try {
      if (value === 'system') localStorage.removeItem('bm-theme')
      else localStorage.setItem('bm-theme', value)
    } catch {
      // storage is off (a private window); the choice lasts for this visit
    }
    $$('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === value)))
    post({ d2: 'theme', value })
  }
  $('#themeFlip').addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'))
  $$('[data-theme-pick]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themePick)))
  $$('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === current())))

  /* ── nav: hides on the way down, comes back on the way up; on a phone the links open in a sheet ── */
  const nav = $('#nav'),
    menuBtn = $('#menuBtn'),
    sheet = $('#navSheet')
  const menu = (on) => {
    sheet.hidden = !on
    menuBtn.setAttribute('aria-expanded', String(on))
  }
  menuBtn.addEventListener('click', () => menu(sheet.hidden))
  sheet.addEventListener('click', (e) => e.target.closest('a') && menu(false))
  addEventListener('keydown', (e) => e.key === 'Escape' && menu(false))
  let lastY = scrollY
  addEventListener(
    'scroll',
    () => {
      const y = scrollY
      if (y > lastY + 4) menu(false)
      if (y > 600 && y > lastY + 4) nav.classList.add('hide')
      else if (y < lastY - 4 || y < 600) nav.classList.remove('hide')
      lastY = y
    },
    { passive: true },
  )

  /* ── the window: the course workspace (demo/), scaled from 1280×800 on a wide screen ── */
  const view = $('#winView'),
    veil = $('#veil'),
    win = $('#win')
  function fit() {
    if (phone()) {
      app.style.transform = ''
      view.style.height = ''
      return
    }
    const s = view.clientWidth / 1280
    app.style.transform = `scale(${s})`
    view.style.height = Math.round(800 * s) + 'px'
  }
  fit()
  addEventListener('resize', fit)

  /* ── the picker: each part plays in the window, one after another, while the window is on screen
     and the pointer is off it ── */
  const tabs = $$('#picker button')
  const ACT = {
    lesson: () => {
      post({ d2: 'tool', tool: 'select' })
      post({ d2: 'view', view: 'lesson' })
      post({ d2: 'assistant', open: !phone() })
    },
    roadmap: () => {
      post({ d2: 'tool', tool: 'select' })
      post({ d2: 'view', view: 'roadmap' })
    },
    /* the assistant stays open so the ink stays aligned with the text */
    pen: () => {
      post({ d2: 'view', view: 'lesson' })
      post({ d2: 'assistant', open: !phone() })
      setTimeout(() => post({ d2: 'demo', name: 'pen' }), 450)
    },
    board: () => {
      post({ d2: 'tool', tool: 'select' })
      post({ d2: 'view', view: 'board' })
    },
    ask: () => {
      post({ d2: 'tool', tool: 'select' })
      post({ d2: 'view', view: 'lesson' })
      post({ d2: 'assistant', open: true })
      setTimeout(() => post({ d2: 'ask', text: 'Make me a 3-question check on this lesson' }), 600)
    },
  }
  const DUR = 7000
  let ready = false,
    cur = 0,
    done = 0,
    last = 0,
    inView = false,
    hover = false
  function select(i) {
    cur = i
    done = 0
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i))
      $('.pk-bar i', t).style.width = '0%'
    })
    if (ready) ACT[tabs[i].dataset.k]()
  }
  function tick(now) {
    requestAnimationFrame(tick)
    const dt = last ? Math.min(100, now - last) : 0 // a background tab comes back where it left off
    last = now
    if (!ready || !inView || hover || reduce) return
    done += dt
    $('.pk-bar i', tabs[cur]).style.width = Math.min(100, (done / DUR) * 100) + '%'
    if (done >= DUR) select((cur + 1) % tabs.length)
  }
  requestAnimationFrame(tick)
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)))

  function unveil() {
    if (ready) return
    ready = true
    veil.classList.add('off')
    post({ d2: 'theme', value: current() })
    select(cur)
  }
  addEventListener('message', (e) => {
    if (e.source === app.contentWindow && e.data && e.data.d2 === 'ready') unveil()
  })
  app.addEventListener('load', () => setTimeout(unveil, 700))
  setTimeout(unveil, 4500)
  try {
    if (app.contentDocument && app.contentDocument.readyState === 'complete' && /course\.html$/.test(app.contentWindow.location.pathname)) unveil()
  } catch {
    // not readable yet; the load event unveils it
  }

  /* phone: the app takes touches only after a tap, and gives them back on Done or once it's off screen */
  const touch = (on) => win.classList.toggle('touch-on', on)
  $('#winTry').addEventListener('click', () => touch(true))
  $('#winDone').addEventListener('click', () => touch(false))
  win.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hover = true
  })
  win.addEventListener('pointerleave', () => {
    hover = false
  })
  new IntersectionObserver(
    ([e]) => {
      inView = e.isIntersecting
      if (!inView) touch(false)
    },
    { threshold: 0.35 },
  ).observe($('#stage'))

  /* ── the feature cells: a slow tour, one screen at a time, while the pointer is elsewhere ── */
  const grid = $('.fx-grid'),
    cells = $$('.fx', grid)
  let fi = -1,
    ftimer = 0,
    fvis = false,
    fpause = false
  const show = (k) => cells.forEach((c, j) => c.classList.toggle('on', j === k))
  const step = () => show((fi = (fi + 1) % cells.length))
  function tour() {
    clearInterval(ftimer)
    if (fvis && !fpause && !reduce) {
      step()
      ftimer = setInterval(step, 2600)
    } else show(-1)
  }
  new IntersectionObserver(
    ([e]) => {
      fvis = e.isIntersecting
      tour()
    },
    { rootMargin: '-25% 0px -25% 0px' },
  ).observe(grid)
  grid.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return
    fpause = true
    tour()
  })
  grid.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return
    fpause = false
    tour()
  })

  /* the wordmark scales with the screen, so its dot (Bili) is sized to the letters: 80px at 300px */
  const wm = $('.wordmark'),
    dot = $('.wm-dot')
  const sizeDot = () => dot.setAttribute('size', String(Math.round((parseFloat(getComputedStyle(wm).fontSize) * 80) / 300)))
  sizeDot()
  addEventListener('resize', sizeDot)

  /* ── the download for this system; a phone, a tablet or anything unknown keeps "see below" ── */
  const REL = 'https://github.com/bilimind/desktop/releases/download/v1.1.0/'
  const OS = {
    win: { name: 'For Windows', file: 'Installer · 126 MB · version 1.1.0', href: REL + 'BiliMind-1.1.0-x64-setup.exe', alt: [['macOS', '#download'], ['Linux', '#download']] },
    mac: { name: 'For macOS, Apple silicon', file: 'Disk image · 137 MB · version 1.1.0', href: REL + 'BiliMind-1.1.0-mac-arm64.dmg', alt: [['an Intel Mac', REL + 'BiliMind-1.1.0-mac-x64.dmg'], ['Windows', '#download'], ['Linux', '#download']] },
    linux: { name: 'For Linux', file: 'AppImage · 144 MB · version 1.1.0', href: REL + 'BiliMind-1.1.0-linux-x86_64.AppImage', alt: [['.deb', REL + 'BiliMind-1.1.0-linux-amd64.deb'], ['Windows', '#download'], ['macOS', '#download']] },
  }
  const ua = navigator.userAgent
  const touchMac = /Mac/.test(ua) && navigator.maxTouchPoints > 1 // an iPad asks for the desktop site as a Mac
  const os = /Android|iPhone|iPad|iPod|CrOS/.test(ua) || touchMac ? null : /Win/.test(ua) ? 'win' : /Mac/.test(ua) ? 'mac' : /Linux|X11/.test(ua) ? 'linux' : null
  if (os) {
    const o = OS[os]
    $('#dlName').textContent = o.name
    $('#dlFile').textContent = o.file
    $('#dlBtn').href = o.href
    $('#dlIco').innerHTML = $(`[data-os="${os}"] .ico`).innerHTML
    const alt = $('#dlOther').firstElementChild
    alt.className = 'dl-alt'
    alt.textContent = 'Also for '
    o.alt.forEach(([label, href], i) => {
      if (i) alt.append(i === o.alt.length - 1 ? ' or ' : ', ')
      const a = document.createElement('a')
      a.href = href
      a.textContent = label
      alt.append(a)
    })
    $(`[data-os="${os}"]`).classList.add('is-you')
  }
})()
