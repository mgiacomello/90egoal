// Dalla foto del marcatore alla "statuina fotografica": il giocatore ritagliato dallo
// sfondo, con un bordo avorio come un adesivo, pronto per stare sul piedistallo 3D.
// Il ritaglio lo fa nel browser un modello piccolo di MediaPipe (selfie segmenter).
// Se il ritaglio non convince (persona troppo piccola o troppo grande, CORS, GPU
// assente) torna la foto intera come cartoncino con gli angoli tondi: si muove lo stesso.

export interface Sagoma {
  canvas: HTMLCanvasElement
  ritagliata: boolean   // true: solo il giocatore; false: foto intera a cartoncino
}

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODELLO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'
const AVORIO = '#fbf9f3'

const cache = new Map<string, Promise<Sagoma | null>>()

export function sagomaDa(url: string): Promise<Sagoma | null> {
  if (!cache.has(url)) cache.set(url, crea(url).catch(() => null))
  return cache.get(url)!
}

async function crea(url: string): Promise<Sagoma | null> {
  const img = await carica(url)
  const ritaglio = await ritaglia(img).catch(() => null)
  return ritaglio ? { canvas: ritaglio, ritagliata: true } : { canvas: cartoncino(img), ritagliata: false }
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

async function ritaglia(img: HTMLImageElement): Promise<HTMLCanvasElement | null> {
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

    const w = img.naturalWidth, h = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0, w, h)
    const dati = g.getImageData(0, 0, w, h)
    let pieni = 0, x0 = w, y0 = h, x1 = 0, y1 = 0
    for (let y = 0; y < h; y++) {
      const my = Math.floor((y / h) * mh)
      for (let x = 0; x < w; x++) {
        let v = conf[my * mw + Math.floor((x / w) * mw)]
        if (rovescia) v = 1 - v
        // Bordo morbido: tra 0.35 e 0.65 sfuma.
        const a = Math.max(0, Math.min(1, (v - 0.35) / 0.3))
        dati.data[(y * w + x) * 4 + 3] = Math.round(a * 255)
        if (a > 0.5) { pieni++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
    }
    const quota = pieni / (w * h)
    if (quota < 0.08 || quota > 0.9) return null   // non ha trovato una persona credibile
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
    return out
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
