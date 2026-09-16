/**
 * Verifica testuale delle citazioni. Funzione pura: niente rete, niente DOM.
 *
 * Per il capo di gabinetto la regola era: nessuna affermazione senza una
 * fonte in memoria. Per un contratto la regola giusta è più stretta, e
 * per una ragione che si capisce subito: un'analisi costruita su una
 * clausola che nel contratto non c'è non è "imprecisa", è pericolosa.
 *
 *   **Una clausola citata deve esistere testualmente nel documento.
 *   Se non c'è, l'analisi di quella clausola non viene mostrata.**
 *
 * Il confronto non può però essere ingenuo. Il testo che arriva da un
 * PDF, da un DOCX o da un export di Drive porta con sé virgolette
 * tipografiche, trattini lunghi, a capo in mezzo alle frasi e spazi
 * unificatori. Normalizzare quelle differenze non allenta la regola:
 * toglie di mezzo il rumore che la farebbe fallire sui documenti veri.
 */

export type QuoteStatus =
  /** La citazione è nel documento, parola per parola (a meno di spazi e segni). */
  | 'exact'
  /** Un tratto abbastanza lungo coincide: il modello ha saltato o aggiunto qualcosa. */
  | 'partial'
  /** Nel documento non c'è. L'analisi di questa clausola cade. */
  | 'missing'

export type QuoteMatch = {
  status: QuoteStatus
  /** Quanta parte della citazione è stata ritrovata, da 0 a 1. */
  coverage: number
  /** Le parole effettivamente ritrovate, in fila. Vuoto se `missing`. */
  matched: string
}

/** Quante parole servono come minimo perché una coincidenza parziale conti. */
const MIN_PARTIAL_TOKENS = 6
/** E quanta parte della citazione deve coprire. */
const MIN_PARTIAL_COVERAGE = 0.6

/**
 * Toglie le differenze che non cambiano il significato.
 * Volutamente *non* toglie la punteggiatura: in un contratto una virgola
 * sposta un obbligo, e cancellarla renderebbe il confronto compiacente.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/­/g, '') // trattino morbido: esiste solo per andare a capo
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Le parole di un testo, senza punteggiatura: l'unità del confronto tollerante. */
export function tokenize(text: string): string[] {
  return normalizeForMatch(text).match(/[\p{L}\p{N}]+/gu) ?? []
}

/**
 * Il tratto contiguo più lungo in comune fra due sequenze di parole.
 * Programmazione dinamica a riga singola: il documento può essere lungo,
 * la citazione no, quindi la memoria segue la citazione.
 */
function longestCommonRun(doc: string[], quote: string[]): { length: number; quoteEnd: number } {
  let best = 0
  let bestEnd = 0
  let previous = new Array<number>(quote.length + 1).fill(0)

  for (let i = 1; i <= doc.length; i++) {
    const current = new Array<number>(quote.length + 1).fill(0)
    for (let j = 1; j <= quote.length; j++) {
      if (doc[i - 1] === quote[j - 1]) {
        current[j] = previous[j - 1] + 1
        if (current[j] > best) {
          best = current[j]
          bestEnd = j
        }
      }
    }
    previous = current
  }

  return { length: best, quoteEnd: bestEnd }
}

/** La citazione è nel documento? E se sì, quanto fedelmente? */
export function matchQuote(quote: string, document: string): QuoteMatch {
  const quoteTokens = tokenize(quote)
  if (!quoteTokens.length) return { status: 'missing', coverage: 0, matched: '' }

  // Prima la via rapida: coincidenza testuale dopo la normalizzazione.
  if (normalizeForMatch(document).includes(normalizeForMatch(quote))) {
    return { status: 'exact', coverage: 1, matched: quote.trim() }
  }

  const docTokens = tokenize(document)
  const { length, quoteEnd } = longestCommonRun(docTokens, quoteTokens)
  const coverage = length / quoteTokens.length

  if (length >= MIN_PARTIAL_TOKENS && coverage >= MIN_PARTIAL_COVERAGE) {
    return {
      status: 'partial',
      coverage,
      matched: quoteTokens.slice(quoteEnd - length, quoteEnd).join(' '),
    }
  }

  return { status: 'missing', coverage, matched: '' }
}
