import { fold, queryTerms } from './rank.ts'

/**
 * Espansione della domanda. Funzione pura: niente rete, niente DOM.
 *
 * Il problema che risolve è il più antipatico di una memoria: chiedi
 * *"cosa avevamo deciso sul pricing"* e nei documenti c'è scritto
 * "listino", "tariffe", "sconto". La ricerca full-text non lo sa,
 * quindi non trova niente, e il sistema risponde "non risulta" — che
 * è peggio di un errore, perché sembra una risposta.
 *
 * La soluzione **non** è far rispondere il modello a memoria. È
 * lasciargli fare l'unica cosa in cui è imbattibile e innocua:
 * proporre altre parole con cui la stessa cosa potrebbe essere
 * scritta. A cercare e a ordinare continua il codice, e a rispondere
 * si continua solo dai documenti trovati.
 *
 * Un modello che propone termini di ricerca non può inventare un
 * fatto: al massimo fa cercare una parola inutile, e il ranking la
 * ignora. È il motivo per cui questo passaggio si può fare senza
 * indebolire di una virgola la garanzia sulle fonti.
 */

/** Quanti termini in tutto arrivano a Postgres: oltre, è solo rumore. */
const MAX_TERMS = 18
/** Quanti ne può aggiungere il modello. */
const MAX_PROPOSED = 12

/**
 * Unisce i termini della domanda con quelli proposti.
 *
 * Gli originali vengono **sempre prima e non vengono mai scartati**:
 * l'espansione può allargare la ricerca, non dirottarla. Se il modello
 * proponesse dodici sinonimi e il tetto tagliasse via la parola che
 * l'utente ha davvero scritto, avremmo cercato un'altra domanda.
 */
export function mergeTerms(original: string[], proposed: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const term of original) {
    const clean = fold(term).trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }

  let added = 0
  for (const term of proposed) {
    if (added >= MAX_PROPOSED || out.length >= MAX_TERMS) break
    // Un "sinonimo" fatto di tre parole non è un termine: va spezzato,
    // e i pezzi passano dallo stesso filtro della domanda.
    for (const piece of queryTerms(String(term ?? ''))) {
      if (seen.has(piece)) continue
      if (out.length >= MAX_TERMS) break
      seen.add(piece)
      out.push(piece)
      added++
    }
  }

  return out
}

/** I termini uniti, nella forma che `brain_search` si aspetta (OR). */
export function expandedQuery(original: string[], proposed: string[]): string {
  return mergeTerms(original, proposed)
    .map((t) => t.replace(/["']/g, ''))
    .filter(Boolean)
    .join(' or ')
}

/**
 * Vale la pena chiedere al modello altre parole?
 *
 * Solo quando il primo giro ha trovato poco: se la ricerca diretta ha
 * già riempito il contesto, allargarla aggiunge rumore, latenza e
 * costo per niente. E se la domanda non aveva nemmeno un termine
 * utile, non c'è niente da espandere.
 */
export function shouldExpand(hits: number, terms: string[], threshold = 12): boolean {
  return terms.length > 0 && hits < threshold
}

/**
 * Come si racconta una ricerca andata a vuoto.
 *
 * "Non risulta" da solo non è verificabile: chi legge non può sapere
 * se il dato non c'è o se il sistema ha cercato male. Dire *cosa* è
 * stato cercato, e su quanti documenti, rende quella frase
 * falsificabile — e a quel punto è una risposta, non una scrollata di
 * spalle.
 */
export function describeSearch(terms: string[], documents: number): string {
  if (!terms.length) {
    return `Nella domanda non c'era nessun termine su cui cercare. In memoria ci sono ${documents} documenti.`
  }
  return `Ho cercato ${terms.map((t) => `"${t}"`).join(', ')} su ${documents} document${documents === 1 ? 'o' : 'i'} in memoria.`
}
