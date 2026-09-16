/**
 * Spezzettamento dei documenti. Funzione pura: niente rete, niente DOM.
 *
 * Una mail lunga o un contratto si cercano male interi e bene a pezzi.
 * I tagli seguono i paragrafi, poi le frasi, e solo come ultima risorsa
 * il conteggio dei caratteri: un IBAN o una data non devono finire
 * a cavallo di due pezzi più di quanto sia inevitabile — per questo
 * c'è una sovrapposizione fra un pezzo e il successivo.
 */

export type Chunk = { idx: number; content: string }

export type ChunkOptions = {
  /** Lunghezza massima di un pezzo, in caratteri. */
  max?: number
  /** Coda del pezzo precedente ripetuta in testa al successivo. */
  overlap?: number
}

const DEFAULT_MAX = 1200
const DEFAULT_OVERLAP = 160

/** Normalizza gli spazi senza toccare il contenuto. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Taglia una stringa troppo lunga in pezzi <= max, prima sulle frasi. */
function splitLong(piece: string, max: number): string[] {
  if (piece.length <= max) return [piece]

  const sentences = piece.split(/(?<=[.!?…])\s+/)
  const out: string[] = []
  let current = ''

  for (const sentence of sentences) {
    // Una frase da sola più lunga del massimo: taglio netto, senza scuse.
    if (sentence.length > max) {
      if (current) {
        out.push(current)
        current = ''
      }
      for (let i = 0; i < sentence.length; i += max) {
        out.push(sentence.slice(i, i + max))
      }
      continue
    }
    if (!current) current = sentence
    else if (current.length + 1 + sentence.length <= max) current += ' ' + sentence
    else {
      out.push(current)
      current = sentence
    }
  }
  if (current) out.push(current)
  return out
}

/** La coda di un pezzo, tagliata su uno spazio per non spezzare parole. */
function tail(text: string, size: number): string {
  if (size <= 0 || text.length <= size) return text.trim()
  const slice = text.slice(text.length - size)
  const space = slice.indexOf(' ')
  const cut = space >= 0 && space < size / 2 ? slice.slice(space + 1) : slice
  return cut.trim()
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const max = Math.max(200, options.max ?? DEFAULT_MAX)
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_OVERLAP, Math.floor(max / 3)))

  const normalized = normalizeText(text)
  if (!normalized) return []

  const pieces = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => splitLong(p, max))

  // Impacchetta i pezzi finché ci stanno.
  const packed: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (!current) current = piece
    else if (current.length + 2 + piece.length <= max) current += '\n\n' + piece
    else {
      packed.push(current)
      current = piece
    }
  }
  if (current) packed.push(current)

  // Sovrapposizione: ogni pezzo ricomincia con la coda del precedente.
  return packed.map((content, idx) => {
    if (idx === 0 || overlap === 0) return { idx, content }
    const prefix = tail(packed[idx - 1], overlap)
    return { idx, content: `${prefix}\n\n${content}` }
  })
}

/**
 * Pezzi di un documento: il titolo viaggia in testa al primo pezzo,
 * altrimenti una ricerca per oggetto della mail non troverebbe nulla.
 */
export function chunkDocument(title: string, body: string, options: ChunkOptions = {}): Chunk[] {
  const chunks = chunkText(body, options)
  const heading = normalizeText(title)
  if (!heading) return chunks.length ? chunks : []
  if (!chunks.length) return [{ idx: 0, content: heading }]
  return chunks.map((c) => (c.idx === 0 ? { idx: 0, content: `${heading}\n\n${c.content}` } : c))
}
