// ONE TAP — lettura del testo sul dispositivo.
//
// Rete di sicurezza per la pipeline immagini: se il modello remoto non è
// configurato o non risponde, l'immagine viene letta qui, nel browser, e
// l'app continua a funzionare.
//
// Effetto collaterale migliore del motivo per cui esiste: su questa strada
// la foto non lascia il dispositivo. Nessun upload, nessuna chiave, niente
// da configurare.
//
// Il costo è il primo utilizzo: il motore e i dati di lingua vengono
// scaricati una volta (qualche MB) e poi restano nella cache del browser.

interface OcrWord {
  text: string
  confidence: number
}
interface OcrLine {
  words?: OcrWord[]
}
interface OcrBlock {
  paragraphs?: Array<{ lines?: OcrLine[] }>
}

type Worker = {
  recognize: (
    image: Blob | HTMLCanvasElement,
    options: Record<string, never>,
    output: { blocks: boolean; text: boolean },
  ) => Promise<{ data: { text: string; confidence?: number; blocks?: OcrBlock[] | null } }>
  terminate: () => Promise<unknown>
}

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Import dinamico: il motore OCR non entra nel bundle iniziale e viene
      // scaricato solo da chi ne ha davvero bisogno.
      const { createWorker } = await import('tesseract.js')
      // Tutto servito da questo dominio: il motore non viene preso da un CDN,
      // altrimenti la promessa "non lascia il dispositivo" sarebbe falsa.
      return (await createWorker(['ita', 'eng'], 1, {
        workerPath: '/onetap/ocr/worker.min.js',
        corePath: '/onetap/ocr',
        langPath: '/onetap/ocr',
      })) as unknown as Worker
    })().catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

export interface OcrResult {
  text: string
  /** 0-100, sulle sole parole tenute. Sotto MIN_CONFIDENCE non va usato. */
  confidence: number
  /**
   * Vero quando la lettura è stata faticosa (molte parole scartate, media
   * bassa): il motore deve pretendere di più prima di proporre un numero.
   */
  lowTrust: boolean
  /** Quanto è durata: serve a raccontare all'utente perché ha aspettato. */
  ms: number
}

/**
 * Sotto questa confidenza il testo è rumore: meglio dire "non ho letto" che
 * proporre un'azione costruita su caratteri inventati.
 */
export const MIN_CONFIDENCE = 55

/**
 * Le soglie per parola. Le cifre sono il caso pericoloso: su una foto
 * rumorosa il lettore inventa un "4" o un "5" con confidenza 65-70 — abbastanza
 * per passare qualunque media — e il motore li cuce in un numero di telefono
 * che non esiste. Una parola con cifre entra nel testo solo se il lettore ne
 * è davvero sicuro.
 */
const MIN_WORD = 50
const MIN_DIGIT_WORD = 78

/** Ricompone il testo tenendo solo le parole affidabili, riga per riga. */
function siftWords(blocks: OcrBlock[] | null | undefined, fallback: string): {
  text: string
  kept: number
  dropped: number
  confidence: number
} {
  if (!blocks?.length) return { text: fallback, kept: 0, dropped: 0, confidence: 0 }
  const lines: string[] = []
  let kept = 0
  let dropped = 0
  let sum = 0
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const good: string[] = []
        for (const word of line.words ?? []) {
          const text = (word.text ?? '').trim()
          if (!text) continue
          const floor = /\d/.test(text) ? MIN_DIGIT_WORD : MIN_WORD
          if (word.confidence >= floor) {
            good.push(text)
            kept++
            sum += word.confidence
          } else {
            dropped++
          }
        }
        if (good.length) lines.push(good.join(' '))
      }
    }
  }
  return {
    text: lines.join('\n'),
    kept,
    dropped,
    confidence: kept ? sum / kept : 0,
  }
}

/** Lato minimo a cui conviene portare l'immagine: sotto, Tesseract sbaglia molto. */
const TARGET_MIN_SIDE = 1200
const MAX_SIDE = 2400

/**
 * Una foto non è uno screenshot: storta, in penombra, con il testo piccolo.
 * Ingrandire, togliere il colore e allargare il contrasto vale più di
 * qualunque impostazione del motore.
 */
async function preprocess(image: Blob): Promise<HTMLCanvasElement> {
  // `imageOrientation: 'from-image'` non è un dettaglio: senza, una foto da
  // telefono arriva qui ruotata di 90° e l'OCR restituisce caratteri a caso.
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' })
  const minSide = Math.min(bitmap.width, bitmap.height)
  const maxSide = Math.max(bitmap.width, bitmap.height)
  let scale = minSide < TARGET_MIN_SIDE ? TARGET_MIN_SIDE / minSide : 1
  if (maxSide * scale > MAX_SIDE) scale = MAX_SIDE / maxSide

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas non disponibile')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data

  // Grigio percettivo, e intanto si misura l'istogramma.
  const hist = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    px[i] = px[i + 1] = px[i + 2] = g
    hist[g]++
  }

  // Contrasto allargato scartando l'1% delle code: una foto in penombra
  // occupa una fetta stretta dell'istogramma, e va riportata su tutta la scala.
  const total = canvas.width * canvas.height
  const cut = Math.max(1, Math.floor(total * 0.01))
  let lo = 0
  let hi = 255
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc > cut) { lo = v; break }
  }
  for (let acc = 0, v = 255; v >= 0; v--) {
    acc += hist[v]
    if (acc > cut) { hi = v; break }
  }
  if (hi - lo > 10) {
    const span = hi - lo
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / span)) | 0
      px[i] = px[i + 1] = px[i + 2] = v
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Legge il testo di un'immagine senza mandarla da nessuna parte. */
export async function readOnDevice(image: Blob): Promise<OcrResult> {
  const started = Date.now()
  const worker = await getWorker()
  let source: Blob | HTMLCanvasElement = image
  try {
    source = await preprocess(image)
  } catch {
    // Preparazione fallita: si tenta comunque sull'originale.
  }
  const { data } = await worker.recognize(source, {}, { blocks: true, text: true })
  const sifted = siftWords(data?.blocks, (data?.text ?? '').trim())
  const total = sifted.kept + sifted.dropped
  return {
    text: sifted.text.trim(),
    confidence: sifted.confidence,
    // Una lettura dove più di un terzo delle parole è stato buttato, o con una
    // media modesta, è una lettura da trattare con sospetto.
    lowTrust: total === 0 || sifted.dropped / total > 0.34 || sifted.confidence < 72,
    ms: Date.now() - started,
  }
}

/** Libera il motore quando non serve più (cambio pagina, pulizia). */
export async function releaseOcr(): Promise<void> {
  if (!workerPromise) return
  const pending = workerPromise
  workerPromise = null
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // già andato: niente da liberare
  }
}
