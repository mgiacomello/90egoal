// ONE TAP — preparazione dell'immagine, tutta nel browser.
//
// Due obiettivi: velocità (meno byte = risposta più rapida) e privacy (quello
// che si può leggere sul dispositivo non parte mai verso un server).

const MAX_SIDE = 1400
const JPEG_QUALITY = 0.82

/** Ridimensiona e comprime prima dell'upload. Restituisce un data URL JPEG. */
export async function prepareImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas non disponibile')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

interface BarcodeHit {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<BarcodeHit[]>
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

/**
 * QR e codici a barre vengono letti sul dispositivo: zero rete, zero attesa,
 * zero immagine inviata. Dove l'API non esiste si prosegue con l'AI.
 */
export async function readBarcode(file: Blob): Promise<string | null> {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!ctor) return null
  try {
    const detector = new ctor({ formats: ['qr_code', 'data_matrix', 'ean_13', 'code_128', 'aztec', 'pdf417'] })
    const bitmap = await createImageBitmap(file)
    const codes = await detector.detect(bitmap)
    bitmap.close?.()
    const value = codes?.[0]?.rawValue?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

/** Un QR può contenere uno schema: si traduce in testo comprensibile al motore. */
export function expandQrPayload(payload: string): string {
  if (/^tel:/i.test(payload)) return `tel ${payload.slice(4)}`
  if (/^smsto:/i.test(payload)) return `tel ${payload.slice(6).split(':')[0]}`
  if (/^mailto:/i.test(payload)) return payload.slice(7).split('?')[0]
  if (/^geo:/i.test(payload)) {
    const coords = payload.slice(4).split('?')[0]
    return coords
  }
  if (/^BEGIN:VCARD/i.test(payload)) {
    const lines = payload.split(/\r?\n/)
    const pick = (key: RegExp) => lines.find((l) => key.test(l))?.split(':').slice(1).join(':') ?? ''
    return [pick(/^FN/i), pick(/^TEL/i), pick(/^EMAIL/i)].filter(Boolean).join('\n')
  }
  return payload
}

/** Legge un'immagine dagli appunti, quando il browser lo permette. */
export async function imageFromClipboard(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) return await item.getType(type)
    }
  } catch {
    // Permesso negato o API assente: resta il classico Ctrl/Cmd+V.
  }
  return null
}

export async function textFromClipboard(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText()
    return text.trim() || null
  } catch {
    return null
  }
}
