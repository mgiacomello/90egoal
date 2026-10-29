// Dalla foto del marcatore alla "statuina fotografica": il giocatore ritagliato dallo
// sfondo, con un bordo avorio come un adesivo, pronto per stare sul piedistallo 3D.
// Il ritaglio lo fa nel browser un modello piccolo di MediaPipe (selfie segmenter).
// Se il ritaglio non convince (persona troppo piccola o troppo grande, CORS, GPU
// assente) torna la foto intera come cartoncino con gli angoli tondi: si muove lo stesso.

export interface Sagoma {
  canvas: HTMLCanvasElement
  ritagliata: boolean   // true: solo il giocatore; false: foto intera a cartoncino
  singola: boolean      // true: una figura sola e ben leggibile (non un gruppo, non un dettaglio)
}

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODELLO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'
const AVORIO = '#ffffff'   // il bordo da adesivo: bianco sul blu

const cache = new Map<string, Promise<Sagoma | null>>()

export function sagomaDa(url: string): Promise<Sagoma | null> {
  if (!cache.has(url)) cache.set(url, crea(url).catch(() => null))
  return cache.get(url)!
}

async function crea(url: string): Promise<Sagoma | null> {
  const img = await carica(url)
  const ritaglio = await ritaglia(img).catch(() => null)
  return ritaglio ? { canvas: ritaglio.canvas, ritagliata: true, singola: ritaglio.singola } : { canvas: cartoncino(img), ritagliata: false, singola: false }
}

function carica(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'   // Wikimedia lo permette: serve per leggere i pixel
    img.onload = () => ok(img)
    img.onerror = () => ko(new Error('foto non caricata'))
    img.src = url
  })
}

async function ritaglia(img: HTMLImageElement): Promise<{ canvas: HTMLCanvasElement; singola: boolean } | null> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM)
  const seg = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELLO },
    runningMode: 'IMAGE',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
  try {
    const res = seg.segment(img)
    const m = res.confidenceMasks?.[0]
    if (!m) return null
    const conf = m.getAsFloat32Array()
    const mw = m.width, mh = m.height
    res.close()

    // Il modello dice "persona" con un valore alto. Se gli angoli sono alti e il centro basso,
    // la maschera è rovesciata: la giriamo.
    const at = (x: number, y: number) => conf[Math.min(mh - 1, Math.max(0, y)) * mw + Math.min(mw - 1, Math.max(0, x))]
    const angoli = (at(2, 2) + at(mw - 3, 2) + at(2, mh - 3) + at(mw - 3, mh - 3)) / 4
    const centro = at(mw >> 1, mh >> 1)
    const rovescia = angoli > 0.5 && centro < 0.5

    // Tiene solo la figura più grande: se in foto c'è anche un avversario o un compagno, resta lui.
    const soglia = 0.5
    const etichetta = new Int32Array(mw * mh)
    let migliore = 0, areaMigliore = 0, areaTotale = 0, k = 0
    const pila: number[] = []
    for (let i = 0; i < mw * mh; i++) {
      const v = rovescia ? 1 - conf[i] : conf[i]
      if (v < soglia || etichetta[i]) continue
      k++
      let area = 0
      pila.push(i)
      etichetta[i] = k
      while (pila.length) {
        const j = pila.pop()!
        area++
        const x = j % mw, y = (j - x) / mw
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue
          const n = ny * mw + nx
          const nv = rovescia ? 1 - conf[n] : conf[n]
          if (nv >= soglia && !etichetta[n]) { etichetta[n] = k; pila.push(n) }
        }
      }
      areaTotale += area
      if (area > areaMigliore) { areaMigliore = area; migliore = k }
    }
    if (!migliore) return null

    // La maschera a bassa risoluzione viene ingrandita con lo sfumato del canvas: bordi morbidi, non a scalini.
    const piccola = document.createElement('canvas')
    piccola.width = mw; piccola.height = mh
    const pg = piccola.getContext('2d')!
    const pd = pg.createImageData(mw, mh)
    for (let i = 0; i < mw * mh; i++) {
      let v = rovescia ? 1 - conf[i] : conf[i]
      if (etichetta[i] !== migliore && v >= soglia) v = 0
      const a8 = Math.round(Math.max(0, Math.min(1, (v - 0.35) / 0.3)) * 255)
      pd.data[i * 4] = pd.data[i * 4 + 1] = pd.data[i * 4 + 2] = a8
      pd.data[i * 4 + 3] = 255
    }
    pg.putImageData(pd, 0, 0)

    const w = img.naturalWidth, h = img.naturalHeight
    const grande = document.createElement('canvas')
    grande.width = w; grande.height = h
    const gg = grande.getContext('2d', { willReadFrequently: true })!
    gg.imageSmoothingEnabled = true
    gg.imageSmoothingQuality = 'high'
    gg.drawImage(piccola, 0, 0, w, h)
    const maschera = gg.getImageData(0, 0, w, h).data

    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0, w, h)
    const dati = g.getImageData(0, 0, w, h)
    let pieni = 0, x0 = w, y0 = h, x1 = 0, y1 = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a8 = maschera[i * 4]
        dati.data[i * 4 + 3] = a8
        if (a8 > 128) { pieni++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
    }
    const quota = pieni / (w * h)
    if (quota < 0.05 || quota > 0.85) return null   // non ha trovato una persona credibile
    g.putImageData(dati, 0, 0)

    // Ritaglio stretto attorno al giocatore, poi il bordo avorio da adesivo.
    const pad = Math.round(Math.max(w, h) * 0.03)
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    const out = document.createElement('canvas')
    out.width = bw + pad * 2; out.height = bh + pad * 2
    const o = out.getContext('2d')!
    const bordo = document.createElement('canvas')
    bordo.width = out.width; bordo.height = out.height
    const b = bordo.getContext('2d')!
    const r = Math.max(4, Math.round(pad * 0.55))
    for (let a = 0; a < 360; a += 20) {
      const dx = Math.cos((a * Math.PI) / 180) * r, dy = Math.sin((a * Math.PI) / 180) * r
      b.drawImage(c, x0, y0, bw, bh, pad + dx, pad + dy, bw, bh)
    }
    b.globalCompositeOperation = 'source-in'
    b.fillStyle = AVORIO
    b.fillRect(0, 0, bordo.width, bordo.height)
    o.drawImage(bordo, 0, 0)
    o.drawImage(c, x0, y0, bw, bh, pad, pad, bw, bh)
    // Una figura sola: la più grande è quasi tutto quello che il modello ha visto come "persona",
    // ed è alta (un giocatore in piedi, non una fila di spalle o un dettaglio).
    const singola = areaMigliore / areaTotale >= 0.6 && bh / bw >= 0.9 && bh / bw <= 3.2 && quota >= 0.08 && quota <= 0.6
    return { canvas: out, singola }
  } finally {
    seg.close()
  }
}

// Ripiego: la foto intera come cartoncino, angoli tondi e cornice avorio.
function cartoncino(img: HTMLImageElement): HTMLCanvasElement {
  const lato = 900
  const w = img.naturalWidth, h = img.naturalHeight
  const s = lato / Math.max(w, h)
  const cw = Math.round(w * s), ch = Math.round(h * s)
  const cornice = Math.round(lato * 0.025)
  const c = document.createElement('canvas')
  c.width = cw + cornice * 2; c.height = ch + cornice * 2
  const g = c.getContext('2d')!
  const raggio = Math.round(lato * 0.05)
  const tondo = (x: number, y: number, ww: number, hh: number, r: number) => {
    g.beginPath()
    g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r)
    g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath()
  }
  tondo(0, 0, c.width, c.height, raggio + cornice)
  g.fillStyle = AVORIO
  g.fill()
  g.save()
  tondo(cornice, cornice, cw, ch, raggio)
  g.clip()
  g.drawImage(img, cornice, cornice, cw, ch)
  g.restore()
  return c
}
