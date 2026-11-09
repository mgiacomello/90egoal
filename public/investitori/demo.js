(() => {
  const T = window.TESTI
  // La demo: lo stesso gioco, in piccolo. Partite di una giornata vera (17 ottobre 2026),
  // gol di esempio sparsi sui dieci campi, orologio accelerato: 90 minuti in circa 50 secondi.
  const PARTITE = [
    ['Reggiana','Torres','C'],['Vado','Sanbenedettese','C'],['Pianese','Pineto','C'],['Roma','Bologna','A'],['Carpi','Lumezzane','C'],
    ['Ascoli','Empoli','B'],['Carrarese','Modena','B'],['Benevento','LR Vicenza','B'],['Padova','Entella','B'],['Venezia','Napoli','A'],
  ]
  // [minuto, partita, 0=casa 1=ospite, recupero?]
  const GOL = [
    [7,9,1],[12,5,0],[19,2,1],[23,9,1],[27,0,0],[34,6,1],[41,7,0],[45,3,0,'primo'],
    [52,9,0],[58,1,1],[61,5,1],[66,8,0],[70,4,0],[77,9,1],[81,2,1],[86,6,0],[90,7,1,'secondo'],
  ]
  // Il marcatore con la foto vera (licenza libera, ritagliata dall'app): segna in uno dei minuti scelti,
  // così nella demo si vede sempre il giocatore che esulta. Minuto provvisorio 67 per il nastro.
  const STELLA = { partita: 3, lato: 0, nome: 'Dovbyk', numero: '11', foto: '/investitori/img/dovbyk.png' }
  GOL.push([67, STELLA.partita, STELLA.lato, null, STELLA])
  GOL.sort((a, b) => a[0] - b[0])
  let GIORNATA = GOL
  const TINTE = { Reggiana:'#7a1f2b', Torres:'#c4161c', Vado:'#c4161c', Sanbenedettese:'#c4161c', Pianese:'#1f4fa8', Pineto:'#1f6fd1', Roma:'#8e1b2b', Bologna:'#9a1b2f', Carpi:'#c4161c', Lumezzane:'#c4161c', Ascoli:'#1b1b1d', Empoli:'#1a5fb4', Carrarese:'#1f3f8f', Modena:'#f2c418', Benevento:'#c4161c', 'LR Vicenza':'#c4161c', Padova:'#c4161c', Entella:'#1f3f8f', Venezia:'#1b1b1d', Napoli:'#1c8ad6' }
  const ALTRI = [['Max', 6],['Roberto', 5],['Giulia', 4],['Andrea', 3]]   // classifica di esempio

  const view = document.getElementById('view'), actions = document.getElementById('actions')
  const velo = document.getElementById('velo'), toast = document.getElementById('toast'), badge = document.getElementById('live-badge')
  const stato = { minuti: new Set(), recupero: null, fase: 'scelta', orologio: 0, punti: 0, risultati: [], feed: [], timer: null }
  const sig = t => `<span class="sig" style="background:${TINTE[t] || '#5b6b8c'}">${t.slice(0,2).toUpperCase()}</span>`
  const h = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))

  function scelta() {
    stato.fase = 'scelta'; badge.style.display = 'none'
    let celle = ''
    for (let m = 1; m <= 90; m++) celle += `<button class="cell ${stato.minuti.has(m) ? 'on' : ''}" data-m="${m}" type="button" aria-pressed="${stato.minuti.has(m)}">${m}</button>`
    view.innerHTML = `
      <div class="card">
        <h3>${T.giornata}</h3>
        <p class="sub">${T.sottotitolo}</p>
        <div class="counter"><span class="sub">${T.minutiScelti}</span><span class="num big"><span id="n">${stato.minuti.size}</span><span class="sub"> / 13</span></span></div>
        <div class="grid" id="grid">${celle}</div>
        <p class="sub" style="margin-top:12px">${T.recupero}</p>
        <div class="seg" id="seg">
          <button type="button" data-r="primo" class="${stato.recupero === 'primo' ? 'on' : ''}">${T.primoTempo}</button>
          <button type="button" data-r="secondo" class="${stato.recupero === 'secondo' ? 'on' : ''}">${T.secondoTempo}</button>
        </div>
      </div>`
    actions.innerHTML = `
      <button class="btn btn-primary" id="gioca" type="button" ${stato.minuti.size === 13 ? '' : 'disabled'}>${T.fischio}</button>
      <button class="btn btn-ghost" id="caso" type="button">${T.caso}</button>`
    view.scrollTop = 0
    document.getElementById('grid').addEventListener('click', e => {
      const b = e.target.closest('.cell'); if (!b) return
      const m = +b.dataset.m
      if (stato.minuti.has(m)) stato.minuti.delete(m)
      else if (stato.minuti.size < 13) stato.minuti.add(m)
      else { b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 240 }); return }
      b.classList.toggle('on', stato.minuti.has(m)); b.setAttribute('aria-pressed', stato.minuti.has(m))
      document.getElementById('n').textContent = stato.minuti.size
      document.getElementById('gioca').disabled = stato.minuti.size !== 13
    })
    document.getElementById('seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return
      stato.recupero = stato.recupero === b.dataset.r ? null : b.dataset.r
      for (const x of e.currentTarget.children) x.classList.toggle('on', x.dataset.r === stato.recupero)
    })
    document.getElementById('caso').addEventListener('click', () => {
      stato.minuti.clear()
      while (stato.minuti.size < 13) stato.minuti.add(1 + Math.floor(Math.random() * 90))
      stato.recupero = Math.random() < 0.5 ? 'primo' : 'secondo'
      scelta()
    })
    document.getElementById('gioca').addEventListener('click', diretta)
  }

  function diretta() {
    stato.fase = 'live'; stato.orologio = 0; stato.punti = 0; stato.feed = []
    stato.risultati = PARTITE.map(() => [0, 0])
    badge.style.display = 'inline-flex'
    const scelti = [...stato.minuti].sort((a, b) => a - b)
    const liberi = scelti.filter(m => m > 12 && m < 86 && !GOL.some(g => g[0] === m && !g[4]))
    const minutoStella = (liberi.length ? liberi : scelti)[Math.floor((liberi.length ? liberi : scelti).length / 2)] ?? 67
    GIORNATA = GOL.map(g => g[4] ? [minutoStella, g[1], g[2], g[3], g[4]] : g).sort((a, b) => a[0] - b[0])
    const primo = Math.min(...GIORNATA.map(g => g[0])), ultimo = Math.max(...GIORNATA.map(g => g[0]))
    stato.primo = primo; stato.ultimo = ultimo
    disegnaLive()
    actions.innerHTML = `<button class="btn btn-ghost" id="stop" type="button">${T.ricomincia}</button>`
    document.getElementById('stop').addEventListener('click', () => { clearInterval(stato.timer); chiudiVelo(); stato.minuti.clear(); stato.recupero = null; scelta() })
    const passo = 560   // ms per minuto di gioco
    let idx = 0
    clearInterval(stato.timer)
    stato.timer = setInterval(() => {
      stato.orologio++
      while (idx < GIORNATA.length && GIORNATA[idx][0] <= stato.orologio) { gol(GIORNATA[idx]); idx++ }
      aggiornaOrologio()
      if (stato.orologio >= 93) { clearInterval(stato.timer); setTimeout(fine, 1200) }
    }, passo)
  }

  function etichettaMin(g) { return g[3] ? (g[0] === 45 ? "45'+2" : "90'+3") : `${g[0]}'` }

  function gol(g) {
    const [m, p, lato, rec, stella] = g
    stato.risultati[p][lato]++
    const [casa, osp] = PARTITE[p]
    const squadra = lato ? osp : casa
    const chi = stella ? `${stella.nome} (${squadra})` : squadra
    const mio = rec ? stato.recupero === rec : stato.minuti.has(m)
    const doppio = mio && !rec && (m === stato.primo || m === stato.ultimo)
    const valore = mio ? (doppio ? 2 : 1) : 0
    stato.punti += valore
    stato.feed.unshift({ g, squadra, mio, doppio, valore })
    disegnaLive(p)
    if (mio) {
      const tel = document.getElementById('phone')
      tel.classList.remove('scossa'); void tel.offsetWidth; tel.classList.add('scossa')
      setTimeout(() => tel.classList.remove('scossa'), 600)
      mostraToast(T.tuoUscito(etichettaMin(g)), `${casa} ${stato.risultati[p][0]}-${stato.risultati[p][1]} ${osp} · ${T.segna} ${chi}`)
      setTimeout(() => popup(g, squadra, casa, osp, valore, stella), 1400)
    } else {
      mostraToast(`${T.gol}: ${chi}`, `${casa} ${stato.risultati[p][0]}-${stato.risultati[p][1]} ${osp} ${T.al} ${etichettaMin(g)}`)
    }
  }

  let toastT
  function mostraToast(t, b) {
    document.getElementById('toast-t').textContent = t
    document.getElementById('toast-b').textContent = b
    toast.classList.add('show'); clearTimeout(toastT)
    toastT = setTimeout(() => toast.classList.remove('show'), 1900)
  }

  function disegnaLive(flash) {
    const celle = [...stato.minuti].sort((a, b) => a - b).map(m => {
      const colpito = stato.feed.find(f => !f.g[3] && f.g[0] === m)
      return `<button class="cell ${colpito ? (colpito.doppio ? 'hit2' : 'hit') : 'on'}" disabled>${m}</button>`
    }).join('')
    const righe = PARTITE.map(([c, o, s], i) => `
      <div class="match ${flash === i ? 'flash' : ''}">
        <div class="t">${sig(c)}<span>${h(c)}</span></div>
        <div class="score">${stato.orologio > 0 ? `${stato.risultati[i][0]}-${stato.risultati[i][1]}` : s}</div>
        <div class="t r"><span>${h(o)}</span>${sig(o)}</div>
      </div>`).join('')
    const feed = stato.feed.slice(0, 6).map(f => `
      <div class="ev ${f.mio ? 'mine' : ''} ${f.doppio ? 'd2' : ''}"><span class="m">${etichettaMin(f.g)}</span><span>${h(f.squadra)}</span>${f.mio ? `<span class="tag">+${f.valore}${f.doppio ? T.primoUltimo : ''}</span>` : ''}</div>`).join('')
    view.innerHTML = `
      <div class="card">
        <div class="clock"><div><p class="sub">${T.inCampo}</p><div class="num min" id="min">${stato.orologio}'</div></div>
        <div class="pts"><p class="sub">${T.puntiFinora}</p><b class="num" id="pts">${stato.punti}</b></div></div>
        <div class="bar"><i id="bar" style="width:${Math.min(100, stato.orologio / 90 * 100)}%"></i></div>
        <div class="grid" style="grid-template-columns:repeat(13,1fr)">${celle}</div>
        ${stato.recupero ? `<p class="sub" style="margin-top:8px">${T.recupero}: ${stato.recupero === 'primo' ? T.primoTempo : T.secondoTempo}</p>` : ''}
      </div>
      <div class="card">${righe}</div>
      ${feed ? `<div class="card"><p class="sub">${T.golGiornata}</p><div class="feed">${feed}</div></div>` : ''}`
  }
  function aggiornaOrologio() {
    const m = document.getElementById('min'), b = document.getElementById('bar')
    if (m) m.textContent = stato.orologio <= 90 ? `${stato.orologio}'` : `90'+${stato.orologio - 90}`
    if (b) b.style.width = `${Math.min(100, stato.orologio / 90 * 100)}%`
  }

  function popup(g, squadra, casa, osp, valore, stella) {
    const tinta = TINTE[squadra] || '#5b6b8c'
    // Con la foto: la statuina fotografica che salta e si gira (dietro, il cartoncino con nome e numero).
    const figura = stella
      ? `<div class="statua"><div class="fronte"><img src="${stella.foto}" alt=""></div><div class="retro" style="background:${tinta}"><span>${h(stella.nome).toUpperCase()}</span><b>${stella.numero}</b></div></div>`
      : `<svg class="maglia" viewBox="0 0 92 110" aria-hidden="true">
            <path d="M30 6 L46 14 L62 6 L86 18 L78 40 L66 36 L66 104 L26 104 L26 36 L14 40 L6 18 Z" fill="${tinta}" stroke="rgba(0,0,0,0.15)"/>
            <text x="46" y="70" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="30" fill="#fff">${(stato.risultati.flat().reduce((a, b) => a + b, 0) * 7) % 23 + 1}</text>
          </svg>`
    velo.innerHTML = `
      <div class="foglio" role="dialog" aria-label="${T.gol} ${etichettaMin(g)}">
        <div class="festa">
          <canvas id="coriandoli"></canvas>
          <div class="lab"><p class="eyebrow">Gol</p><div class="num min">${etichettaMin(g)}</div></div>
          <div class="tuo"><small>${T.tuo}</small><b>+${valore}</b></div>
          ${figura}
          <div class="base"></div>
        </div>
        <div class="body">
          <h3>${stella ? h(stella.nome) : h(squadra)}</h3>
          ${stella ? `<p class="sub" style="margin-top:-6px">${h(squadra)}</p>` : ''}
          <div class="riga">${sig(casa)}<span>${h(casa)}</span><span class="score">${casa === squadra ? '' : ''}${stato.risultati[PARTITE.findIndex(p => p[0] === casa)].join('-')}</span><span class="r">${h(osp)}</span>${sig(osp)}</div>
          <button class="btn btn-primary" id="chiudi" type="button" style="justify-content:center">${T.torna}</button>
        </div>
      </div>`
    velo.classList.add('show')
    document.getElementById('chiudi').addEventListener('click', chiudiVelo)
    velo.addEventListener('click', e => { if (e.target === velo) chiudiVelo() }, { once: true })
    coriandoli(document.getElementById('coriandoli'))
    clearTimeout(stato.autoChiudi); stato.autoChiudi = setTimeout(chiudiVelo, 3600)
  }
  function chiudiVelo() { velo.classList.remove('show'); velo.innerHTML = ''; cancelAnimationFrame(stato.raf) }

  function coriandoli(c) {
    const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2
    const g = c.getContext('2d'), col = ['#1d4fd7', '#c98a06', '#16a34a', '#ffffff', '#3b6cf0', '#f2c418']
    const pz = Array.from({ length: 140 }, () => ({ x: c.width / 2, y: c.height * 0.75, vx: (Math.random() - 0.5) * 22, vy: -Math.random() * 26 - 6, w: 6 + Math.random() * 8, h: 4 + Math.random() * 5, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, col: col[Math.floor(Math.random() * col.length)] }))
    let t = 0
    const passo = () => {
      g.clearRect(0, 0, c.width, c.height); t++
      for (const p of pz) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.6; p.vx *= 0.99; p.a += p.va
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col; g.globalAlpha = Math.max(0, 1 - t / 170); g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore()
      }
      if (t < 170) stato.raf = requestAnimationFrame(passo)
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) passo()
  }

  function fine() {
    stato.fase = 'fine'; badge.style.display = 'none'; chiudiVelo()
    const righe = [...ALTRI.map(([n, p]) => ({ n, p })), { n: T.tu, p: stato.punti, me: true }].sort((a, b) => b.p - a.p)
    const miei = stato.feed.filter(f => f.mio)
    view.innerHTML = `
      <div class="card final">
        <p class="sub">${T.fine}</p>
        <div class="num big">${stato.punti} <span style="font-size:20px;color:var(--muted)">${T.punti}</span></div>
        <p class="sub" style="margin-top:6px">${T.riepilogo(miei.length, GIORNATA.length, miei.some(f => f.doppio))}</p>
        <p class="sub" style="margin-top:14px">${T.classificaEsempio}</p>
        <div class="rank">${righe.map((r, i) => `<div class="${r.me ? 'me' : ''}"><b>${i + 1}</b><span>${r.n}</span><b class="num">${r.p}</b></div>`).join('')}</div>
      </div>`
    actions.innerHTML = `<button class="btn btn-primary" id="ancora" type="button">${T.ancora}</button>`
    document.getElementById('ancora').addEventListener('click', () => { stato.minuti.clear(); stato.recupero = null; scelta() })
  }

  document.getElementById('cta-gioca').addEventListener('click', () => {
    document.getElementById('phone').scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (stato.fase === 'scelta' && stato.minuti.size === 0) document.getElementById('caso').click()
  })
  scelta()

  // --- Movimento della pagina (nessun effetto se il sistema chiede meno animazioni).
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches

  // Minuti che salgono lenti dietro all'apertura; quelli d'oro sono il primo e l'ultimo gol.
  if (!fermo) {
    const chips = document.getElementById('chips')
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span')
      const m = 1 + Math.floor(Math.random() * 90)
      s.textContent = `${m}'`
      if (i % 5 === 0) { s.classList.add('oro'); s.textContent += ' ×2' }
      s.style.left = `${4 + Math.random() * 92}%`
      s.style.animationDuration = `${16 + Math.random() * 14}s`
      s.style.animationDelay = `${-Math.random() * 28}s`
      s.style.fontSize = `${11 + Math.random() * 6}px`
      chips.appendChild(s)
    }
  }

  // Il nastro dei gol: una giornata vera scorre sotto l'apertura.
  const nastro = GOL.map(g => {
    const [m, p, lato, rec, stella] = g, sq = stella ? `${stella.nome} (${PARTITE[p][lato]})` : PARTITE[p][lato]
    const doppio = m === Math.min(...GOL.map(x => x[0])) || m === Math.max(...GOL.map(x => x[0]))
    return `<span><b class="${doppio ? 'oro' : ''}">${etichettaMin(g)}</b> ${sq}${doppio ? T.valeDoppio : ''}</span>`
  }).join('')
  document.getElementById('ticker').innerHTML = nastro + nastro

  // Le sezioni si rivelano quando entrano, le schede una dopo l'altra.
  const daRivelare = document.querySelectorAll('.block > .wrap > *:not(.eyebrow), .forte, .step, .rule, .have, .lez, .tl')
  if (!fermo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(voci => voci.forEach(v => { if (v.isIntersecting) { v.target.classList.add('in'); io.unobserve(v.target) } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    daRivelare.forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('rv'); io.observe(el) } else el.classList.add('in') })
  } else daRivelare.forEach(el => el.classList.add('in'))

  // Il riflesso segue il mouse sulle schede.
  document.querySelectorAll('.forte, .lez, .step').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }))

  // Il telefono si inclina verso il mouse, come tenuto in mano.
  const col = document.querySelector('.phone-col'), hero = document.querySelector('.hero')
  if (!fermo && matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove', e => {
      const r = col.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height
      col.classList.add('mano')
      col.style.setProperty('--ry', `${Math.max(-10, Math.min(10, dx * 14))}deg`)
      col.style.setProperty('--rx', `${Math.max(-8, Math.min(8, -dy * 10))}deg`)
    })
    hero.addEventListener('pointerleave', () => { col.classList.remove('mano'); col.style.removeProperty('--rx'); col.style.removeProperty('--ry') })
  }

  // Il video del gol parte da solo (muto) quando è in vista; un tocco accende l'audio.
  const video = document.getElementById('video-gol'), audio = document.getElementById('audio')
  const festaCanvas = document.getElementById('festa-canvas')
  let festaFatta = false
  const festa = () => {
    if (festaFatta || fermo) return
    festaFatta = true
    const c = festaCanvas, r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2
    const g = c.getContext('2d'), col2 = ['#1d4fd7', '#c98a06', '#16a34a', '#3b6cf0', '#f2c418', '#ffffff']
    const pz = Array.from({ length: 220 }, () => ({ x: c.width / 2, y: c.height * 0.6, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 34 - 8, w: 8 + Math.random() * 10, h: 5 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, col: col2[Math.floor(Math.random() * col2.length)] }))
    let t = 0
    const passo = () => {
      g.clearRect(0, 0, c.width, c.height); t++
      for (const p of pz) { p.x += p.vx; p.y += p.vy; p.vy += 0.55; p.vx *= 0.99; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col; g.globalAlpha = Math.max(0, 1 - t / 220); g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore() }
      if (t < 220) requestAnimationFrame(passo); else g.clearRect(0, 0, c.width, c.height)
    }
    passo()
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(voci => voci.forEach(v => {
      if (v.isIntersecting) { video.play().catch(() => {}); festa() } else video.pause()
    }), { threshold: 0.4 }).observe(video)
  }
  audio.addEventListener('click', () => {
    video.muted = !video.muted
    if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}) }
    audio.setAttribute('aria-pressed', String(!video.muted))
    audio.lastChild.textContent = video.muted ? T.attivaAudio : T.silenzia
  })
})()
