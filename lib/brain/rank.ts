/**
 * Ranking della memoria. Funzione pura: niente rete, niente DOM.
 *
 * Postgres dice *se* un pezzo contiene le parole. Qui si decide *quanto
 * conta*: una mail di ieri che nomina la persona giusta vale più di un
 * documento di tre anni fa che ripete un termine dieci volte.
 *
 * Il motivo per cui questa parte non sta dentro a un prompt è lo stesso
 * per cui in ONE TAP l'azione non la sceglie il modello: un ordinamento
 * si può testare, un'intuizione no.
 */

import type { RankedHit, SearchHit, SourceKey, SourceRef } from './types'

const STOPWORDS = new Set([
  'a', 'ad', 'ai', 'al', 'alla', 'alle', 'allo', 'anche', 'che', 'chi', 'ci', 'co', 'coi',
  'col', 'come', 'con', 'cosa', 'cui', 'da', 'dai', 'dal', 'dalla', 'de', 'dei', 'del',
  'della', 'delle', 'dello', 'di', 'do', 'dove', 'e', 'ed', 'era', 'essere', 'fa', 'fare',
  'gli', 'ha', 'hai', 'hanno', 'ho', 'i', 'il', 'in', 'io', 'la', 'le', 'lo', 'ma', 'me',
  'mi', 'mia', 'mie', 'mio', 'ne', 'nei', 'nel', 'nella', 'nelle', 'no', 'noi', 'non',
  'o', 'per', 'perche', 'piu', 'qual', 'quale', 'quali', 'quando', 'quanto', 'quel',
  'quella', 'quelle', 'quello', 'questa', 'queste', 'questi', 'questo', 'sei', 'si',
  'sono', 'su', 'sul', 'sulla', 'sulle', 'ti', 'tra', 'tu', 'tuo', 'un', 'una', 'uno',
  'and', 'are', 'for', 'from', 'has', 'have', 'is', 'it', 'of', 'on', 'or', 'the', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'with', 'you', 'your',
])

/** Minuscole senza accenti: "però" e "pero" devono pesare uguale. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** I termini utili di una domanda: niente parole vuote, niente rumore. */
export function queryTerms(query: string): string[] {
  const seen = new Set<string>()
  for (const raw of fold(query).split(/[^a-z0-9@._+-]+/)) {
    const term = raw.replace(/^[._-]+|[._-]+$/g, '')
    if (term.length < 2) continue
    if (STOPWORDS.has(term)) continue
    seen.add(term)
  }
  return [...seen]
}

/**
 * La domanda tradotta in interrogazione full-text.
 *
 * Attenzione, qui si nasconde un bug facile: `websearch_to_tsquery`
 * mette in AND le parole separate da spazio. "cosa ha detto Rossi sul
 * rinnovo" cercherebbe documenti che contengono *tutte* quelle parole,
 * e non troverebbe niente. Quello che serve è un OR: a pesare quante
 * parole abbia davvero preso ciascun pezzo ci pensa il ranking.
 */
export function toFtsQuery(query: string): string {
  return queryTerms(query)
    .map((t) => t.replace(/["']/g, ''))
    .filter(Boolean)
    .join(' or ')
}

/**
 * Peso della freschezza: 1 oggi, 0.5 dopo un'emivita, mai zero.
 * Il fondo a 0.05 serve a non cancellare del tutto la memoria vecchia,
 * che è esattamente quella che un umano non ricorda più.
 */
export function recencyWeight(occurredAt: string, now: Date, halfLifeDays = 90): number {
  const then = Date.parse(occurredAt)
  if (!Number.isFinite(then)) return 0.3
  const ageDays = Math.max(0, (now.getTime() - then) / 86_400_000)
  return Math.max(0.05, Math.pow(0.5, ageDays / halfLifeDays))
}

/** Le fonti non sono tutte uguali: una nota salvata a mano è una scelta. */
const SOURCE_WEIGHT: Record<SourceKey, number> = {
  manual: 1.1,
  gmail: 1.0,
  gcal: 1.0,
  qonto: 1.0,
  oura: 0.9,
  gdrive: 0.95,
}

export type RankOptions = {
  halfLifeDays?: number
  /** Restringe a una finestra: usato quando la domanda è esplicitamente temporale. */
  now?: Date
}

function hitScore(hit: SearchHit, terms: string[], foldedQuery: string, now: Date, maxRank: number, halfLifeDays: number): number {
  const haystack = fold(`${hit.title}\n${hit.content}`)
  const people = fold(hit.participants.join(' '))

  // 1. Quanto Postgres ha creduto a questo pezzo, normalizzato sul migliore.
  const fts = maxRank > 0 ? hit.rank / maxRank : 0

  // 2. Quante parole della domanda ci sono davvero dentro.
  const present = terms.filter((t) => haystack.includes(t)).length
  const overlap = terms.length ? present / terms.length : 0

  // 3. Quanto è recente.
  const recency = recencyWeight(hit.occurredAt, now, halfLifeDays)

  // 4. Chi è nominato: se la domanda contiene il nome di un partecipante,
  //    quel documento parla quasi sicuramente della cosa giusta. Pesa molto
  //    perché è un segnale strutturato ed esatto, mentre la differenza di
  //    punteggio full-text fra due pezzi che dicono le stesse parole è rumore.
  const peopleMatch = terms.some((t) => t.length > 2 && people.includes(t)) ? 0.8 : 0

  // 5. La frase esatta vale più delle parole sparse.
  const phrase = foldedQuery.length > 8 && haystack.includes(foldedQuery) ? 0.6 : 0

  return (fts * 1.0 + overlap * 1.2 + recency * 0.8 + peopleMatch + phrase) * SOURCE_WEIGHT[hit.source]
}

/** Ordina i pezzi. Non tocca l'elenco in ingresso. */
export function rankHits(hits: SearchHit[], query: string, options: RankOptions = {}): RankedHit[] {
  const now = options.now ?? new Date()
  const halfLifeDays = options.halfLifeDays ?? 90
  const terms = queryTerms(query)
  const foldedQuery = fold(query).trim()
  const maxRank = hits.reduce((m, h) => Math.max(m, h.rank), 0)

  return hits
    .map((hit) => ({ ...hit, score: hitScore(hit, terms, foldedQuery, now, maxRank, halfLifeDays) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export type SelectOptions = {
  /** Quanti documenti distinti offrire al modello. */
  maxDocuments?: number
  /** Quanti pezzi al massimo per documento. */
  maxChunksPerDocument?: number
  /** Tetto ai caratteri di estratto per documento. */
  maxCharsPerDocument?: number
}

/**
 * Da pezzi ordinati a fonti citabili.
 *
 * Un documento compare una volta sola, con i suoi pezzi migliori uniti.
 * Trovarne più pezzi è un segnale, non un modo per occupare il contesto:
 * vale un bonus piccolo e saturo.
 */
export function selectSources(ranked: RankedHit[], options: SelectOptions = {}): SourceRef[] {
  const maxDocuments = options.maxDocuments ?? 8
  const maxChunks = options.maxChunksPerDocument ?? 3
  const maxChars = options.maxCharsPerDocument ?? 1800

  const byDocument = new Map<string, { best: RankedHit; chunks: RankedHit[]; score: number }>()

  for (const hit of ranked) {
    const entry = byDocument.get(hit.documentId)
    if (!entry) {
      byDocument.set(hit.documentId, { best: hit, chunks: [hit], score: hit.score })
      continue
    }
    if (entry.chunks.length < maxChunks) {
      entry.chunks.push(hit)
      entry.score += 0.15 // più pezzi dello stesso documento: conferma, non valanga
    }
  }

  return [...byDocument.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDocuments)
    .map((entry, i) => {
      const excerpt = entry.chunks
        .slice()
        .sort((a, b) => a.idx - b.idx)
        .map((c) => c.content)
        .join('\n…\n')
      return {
        handle: `F${i + 1}`,
        documentId: entry.best.documentId,
        source: entry.best.source,
        kind: entry.best.kind,
        title: entry.best.title,
        occurredAt: entry.best.occurredAt,
        url: entry.best.url,
        excerpt: excerpt.length > maxChars ? excerpt.slice(0, maxChars) + '…' : excerpt,
      }
    })
}
