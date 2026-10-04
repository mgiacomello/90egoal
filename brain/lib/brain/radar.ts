/**
 * Il radar. Funzione pura: niente rete, niente DOM, nessun import di
 * valori.
 *
 * Centinaia di articoli al giorno, e ne contano dieci. Quali dieci lo
 * decide prima il codice — parole chiave sul profilo del titolare,
 * doppioni tolti, i più recenti davanti — e solo dopo il modello, che
 * legge quei dieci e dice cosa cambiano. Così il modello non sceglie
 * fra mille cose che non ha letto, e chi legge vede perché ogni
 * articolo è arrivato lì.
 */

export type RadarItem = {
  id: string
  title: string
  summary: string
  /** ISO */
  occurredAt: string
}

export type ScoredItem<T extends RadarItem> = T & {
  score: number
  /** Le parole del profilo che l'hanno fatto entrare. */
  hits: string[]
}

/** Il profilo predefinito: un avvocato d'impresa che fa legal tech e governance dell'IA. */
export const DEFAULT_TOPICS = [
  'intelligenza artificiale', 'artificial intelligence', 'AI', 'LLM', 'modello', 'model', 'agent', 'agenti',
  'AI Act', 'GDPR', 'privacy', 'data protection', 'regulation', 'regolamento', 'compliance', 'governance',
  'legal tech', 'legaltech', 'contratt', 'contract', 'law firm', 'studio legale', 'copyright', 'IP',
  'startup', 'venture', 'funding', 'raise', 'acquisition', 'acquisizione', 'SaaS', 'pricing', 'launch', 'lancia',
  'OpenAI', 'Anthropic', 'Google', 'Microsoft', 'Meta', 'Apple', 'Nvidia', 'EU', 'Europa', 'Commissione',
]

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Quante parole del profilo compaiono, pesate: nel titolo valgono
 * doppio, e una parola corta (AI, IP, EU) conta solo come parola intera.
 */
export function scoreItem(item: RadarItem, topics: string[]): { score: number; hits: string[] } {
  const title = fold(item.title)
  const body = fold(item.summary)
  const hits: string[] = []
  let score = 0
  for (const topic of topics) {
    const t = fold(topic)
    if (!t) continue
    const re = t.length <= 3 ? new RegExp(`\\b${t}\\b`, 'i') : null
    const inTitle = re ? re.test(title) : title.includes(t)
    const inBody = re ? re.test(body) : body.includes(t)
    if (inTitle) {
      score += 2
      hits.push(topic)
    } else if (inBody) {
      score += 1
      hits.push(topic)
    }
  }
  return { score, hits }
}

const NOISE_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'una', 'uno', 'del', 'della', 'per', 'con', 'che', 'nel', 'alla'])

function titleTokens(title: string): Set<string> {
  return new Set(
    fold(title)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !NOISE_WORDS.has(t))
  )
}

/** Due titoli che condividono più della metà delle parole sono la stessa notizia. */
export function sameStory(a: string, b: string): boolean {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  if (!ta.size || !tb.size) return false
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared += 1
  return shared / Math.min(ta.size, tb.size) > 0.5 && shared >= 3
}

/**
 * I segnali: quelli con almeno una parola del profilo, senza doppioni,
 * dal punteggio più alto e, a parità, dal più recente.
 */
export function selectSignals<T extends RadarItem>(items: T[], topics = DEFAULT_TOPICS, limit = 20): ScoredItem<T>[] {
  const scored = items
    .map((item) => ({ ...item, ...scoreItem(item, topics) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.occurredAt.localeCompare(a.occurredAt))

  const kept: ScoredItem<T>[] = []
  for (const s of scored) {
    if (kept.some((k) => sameStory(k.title, s.title))) continue
    kept.push(s)
    if (kept.length >= limit) break
  }
  return kept
}
