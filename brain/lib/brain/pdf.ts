/**
 * Estrazione del testo da un PDF.
 *
 * Il motore è `unpdf`: una build di pdf.js pensata per girare in una
 * funzione serverless, senza dipendenze native e senza binari da
 * installare. Il resto di questo file esiste per una ragione sola, e
 * non è tecnica.
 *
 * **Un PDF scansionato non contiene testo.** È un'immagine dentro a un
 * involucro PDF, e pdf.js ne estrae zero caratteri o quattro righe di
 * intestazione. Il modo sbagliato di gestirlo è mettere in memoria
 * quel poco e andare avanti: il documento *sembrerebbe* letto, un
 * agente lo citerebbe come fonte, e la citazione risulterebbe
 * formalmente valida su un testo che non è il contratto.
 *
 * Quindi qui si decide, e si dichiara. `assessExtraction()` guarda
 * quanta roba è uscita e dice se è testo vero o un guscio vuoto: è una
 * funzione pura, e per restare testabile in isolamento questo file non
 * importa valori da nessuna parte — è la stessa regola che vale per il
 * resto del nucleo.
 *
 * Per lo stesso motivo `extractPdfText` non solleva: un PDF troppo
 * grande o illeggibile è un *esito previsto*, non un'eccezione. Torna
 * dentro al tipo, con la sua riga da mettere in memoria al posto del
 * testo che non c'è.
 */

export type TextQuality =
  /** Testo estratto, utilizzabile. */
  | 'ok'
  /** Il PDF non ha un livello di testo: è una scansione. */
  | 'no-text-layer'
  /** È uscito qualcosa, ma non sono parole: font non estraibili. */
  | 'garbled'
  /** Oltre il limite: non si è nemmeno provato. */
  | 'too-large'
  /** Il file non è un PDF valido, o pdf.js si è fermato. */
  | 'unreadable'

export type PdfExtraction = {
  text: string
  pages: number
  quality: TextQuality
  /** La riga da mettere in memoria quando il testo non c'è. Vuota se `ok`. */
  note: string
}

/** Oltre questa dimensione non si prova nemmeno: la memoria di una lambda è poca. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024

/** Sotto questa densità di caratteri per pagina, non è un livello di testo. */
const MIN_CHARS_PER_PAGE = 50
/** E comunque sotto questo totale non c'è abbastanza per dire qualcosa. */
const MIN_TOTAL_CHARS = 100
/** Meno parole di così: guscio vuoto. */
const MIN_WORDS = 20
/** "Parole" più lunghe di così in media: gli spazi non sono stati estratti. */
const MAX_MEAN_WORD_LENGTH = 25

/**
 * Il testo uscito dal PDF è testo vero?
 *
 * Funzione pura: nessun PDF, nessuna rete. Prende quello che è uscito
 * e il numero di pagine, e dà un verdetto.
 */
export function assessExtraction(text: string, pages: number): TextQuality {
  const dense = text.replace(/\s+/g, '')
  if (dense.length < MIN_TOTAL_CHARS) return 'no-text-layer'
  if (pages > 0 && dense.length / pages < MIN_CHARS_PER_PAGE) return 'no-text-layer'

  const words = text.match(/[\p{L}]{2,}/gu) ?? []
  if (words.length < MIN_WORDS) return 'no-text-layer'

  const meanLength = words.reduce((sum, w) => sum + w.length, 0) / words.length
  if (meanLength > MAX_MEAN_WORD_LENGTH) return 'garbled'

  return 'ok'
}

/** Cosa finisce in memoria al posto del testo. Il limite si legge, non si indovina. */
export function noteFor(quality: TextQuality, detail = ''): string {
  switch (quality) {
    case 'ok':
      return ''
    case 'no-text-layer':
      return "[PDF scansionato: non contiene un livello di testo, quindi in memoria c'è solo il titolo. Per analizzarlo servirebbe un OCR, che qui non c'è.]"
    case 'garbled':
      return '[PDF con font non estraibili: quello che è uscito non sono parole leggibili. In memoria resta solo il titolo.]'
    case 'too-large':
      return `[PDF oltre il limite di ${MAX_PDF_BYTES / 1048576} MB: non è stato letto.]`
    case 'unreadable':
      return `[PDF illeggibile${detail ? `: ${detail}` : '.'}]`
  }
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return { text: '', pages: 0, quality: 'too-large', note: noteFor('too-large') }
  }

  let text = ''
  let pages = 0

  try {
    // Import dinamico: il motore pesa, e la gran parte delle richieste
    // a BRAIN non tocca mai un PDF.
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    pages = pdf.numPages
    const result = await extractText(pdf, { mergePages: true })
    text = Array.isArray(result.text) ? result.text.join('\n\n') : String(result.text ?? '')
  } catch (err) {
    const detail = (err as Error).message.slice(0, 200)
    return { text: '', pages: 0, quality: 'unreadable', note: noteFor('unreadable', detail) }
  }

  const quality = assessExtraction(text, pages)
  return {
    text: quality === 'ok' ? text.trim() : '',
    pages,
    quality,
    note: noteFor(quality),
  }
}
