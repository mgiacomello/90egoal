/**
 * Verifica delle citazioni. Funzione pura: niente rete, niente DOM.
 *
 * È il cuore del prodotto. Il modello non "dice cose": produce
 * affermazioni, e ognuna deve dichiarare da quale fonte viene.
 * Qui il codice controlla, e il controllo è di due livelli:
 *
 *   1. l'handle citato esiste fra le fonti offerte? Se no,
 *      l'affermazione non viene mostrata. Nessuna eccezione.
 *   2. gli importi, gli IBAN, gli orari e le date scritti
 *      nell'affermazione compaiono davvero nelle fonti citate?
 *      Se no, l'affermazione resta ma il dettaglio è marcato.
 *
 * Il secondo controllo è il parente stretto del mod-97 di ONE TAP:
 * tre righe di aritmetica che fermano un numero letto male prima
 * che diventi una decisione.
 */

import type { RawClaim, SourceRef, VerifiedClaim } from './types'

type Corpus = {
  lower: string
  /** Sequenze numeriche normalizzate: "1.250,00" e "14:30" diventano "125000" e "1430". */
  runs: Set<string>
  emails: Set<string>
  ibans: Set<string>
}

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]*\w\b/g
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,32}\b/g
/** Un "numero" nel senso largo: importi, date, orari, codici. */
const NUMBER_RE = /\d[\d.,:/–-]*\d|\d/g

/** Lunghezza minima perché un numero valga un controllo: sotto è rumore. */
const MIN_DIGITS = 3

function digitsOf(text: string): string {
  return text.replace(/\D/g, '')
}

function normalizeIban(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase()
}

function isPlausibleIban(candidate: string): boolean {
  const iban = normalizeIban(candidate)
  return iban.length >= 15 && iban.length <= 34
}

/** Tutti i modi ragionevoli di scrivere la data di un documento. */
function dateRuns(iso: string): string[] {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return []
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return [yyyy, `${dd}${mm}${yyyy}`, `${yyyy}${mm}${dd}`, `${mm}${dd}${yyyy}`, `${hh}${mi}`]
}

function emptyCorpus(): Corpus {
  return { lower: '', runs: new Set(), emails: new Set(), ibans: new Set() }
}

/** Indicizza il testo di una fonte in una forma confrontabile. */
export function corpusOf(ref: SourceRef): Corpus {
  const text = `${ref.title}\n${ref.excerpt}`
  const corpus: Corpus = {
    lower: text.toLowerCase(),
    runs: new Set(),
    emails: new Set(),
    ibans: new Set(),
  }

  for (const m of text.matchAll(NUMBER_RE)) {
    const run = digitsOf(m[0])
    if (run) corpus.runs.add(run)
  }
  for (const run of dateRuns(ref.occurredAt)) corpus.runs.add(run)
  for (const m of text.matchAll(EMAIL_RE)) corpus.emails.add(m[0].toLowerCase())
  for (const m of text.toUpperCase().matchAll(IBAN_RE)) {
    if (isPlausibleIban(m[0])) corpus.ibans.add(normalizeIban(m[0]))
  }
  return corpus
}

function mergeCorpora(list: Corpus[]): Corpus {
  const out = emptyCorpus()
  for (const c of list) {
    out.lower += '\n' + c.lower
    for (const r of c.runs) out.runs.add(r)
    for (const e of c.emails) out.emails.add(e)
    for (const i of c.ibans) out.ibans.add(i)
  }
  return out
}

export type Fact = { raw: string; kind: 'email' | 'iban' | 'number' }

/** I dettagli controllabili dentro a un'affermazione. */
export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = []
  const seen = new Set<string>()
  const claimed = new Set<string>() // porzioni già coperte da email/IBAN

  for (const m of text.matchAll(EMAIL_RE)) {
    const raw = m[0]
    claimed.add(raw.toLowerCase())
    if (!seen.has(raw.toLowerCase())) {
      seen.add(raw.toLowerCase())
      facts.push({ raw, kind: 'email' })
    }
  }

  for (const m of text.toUpperCase().matchAll(IBAN_RE)) {
    if (!isPlausibleIban(m[0])) continue
    const raw = m[0].trim()
    claimed.add(raw.toLowerCase())
    if (!seen.has(raw)) {
      seen.add(raw)
      facts.push({ raw, kind: 'iban' })
    }
  }

  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[0]
    if (digitsOf(raw).length < MIN_DIGITS) continue
    // Un numero già dentro a un IBAN o a una mail è stato controllato lì.
    if ([...claimed].some((c) => c.includes(raw.toLowerCase()))) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    facts.push({ raw, kind: 'number' })
  }

  return facts
}

/** Il dettaglio compare nelle fonti citate? */
export function factSupported(fact: Fact, corpus: Corpus): boolean {
  if (fact.kind === 'email') return corpus.emails.has(fact.raw.toLowerCase())
  if (fact.kind === 'iban') {
    const iban = normalizeIban(fact.raw)
    return [...corpus.ibans].some((known) => known === iban || known.includes(iban))
  }
  const run = digitsOf(fact.raw)
  if (run.length < MIN_DIGITS) return true
  return [...corpus.runs].some((known) => known.includes(run))
}

/** Dagli handle grezzi del modello agli handle veri: "[F1], f3" → ["F1","F3"]. */
export function parseHandles(raw: unknown): string[] {
  const text = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '')
  const out = new Set<string>()
  for (const m of text.matchAll(/f\s*(\d+)/gi)) out.add(`F${m[1]}`)
  return [...out]
}

export type VerifyResult = {
  claims: VerifiedClaim[]
  dropped: RawClaim[]
}

/**
 * Applica le due regole. `refs` è l'elenco *offerto* al modello:
 * qualunque handle fuori da qui è inventato, e cade.
 */
export function verifyClaims(raw: RawClaim[], refs: SourceRef[]): VerifyResult {
  const byHandle = new Map(refs.map((r) => [r.handle, r]))
  const corpusCache = new Map<string, Corpus>()

  const claims: VerifiedClaim[] = []
  const dropped: RawClaim[] = []

  for (const claim of raw) {
    const text = String(claim?.text ?? '').trim()
    if (!text) continue

    const handles = parseHandles(claim?.sources)
    const sources = handles.map((h) => byHandle.get(h)).filter((r): r is SourceRef => Boolean(r))

    // Regola 1: senza una fonte vera, l'affermazione non esiste.
    if (!sources.length) {
      dropped.push({ text, sources: handles })
      continue
    }

    // Regola 2: i dettagli devono comparire nelle fonti citate.
    const corpus = mergeCorpora(
      sources.map((ref) => {
        let c = corpusCache.get(ref.handle)
        if (!c) {
          c = corpusOf(ref)
          corpusCache.set(ref.handle, c)
        }
        return c
      })
    )

    const unverified = extractFacts(text)
      .filter((fact) => !factSupported(fact, corpus))
      .map((fact) => fact.raw)

    claims.push({
      text,
      sources,
      trust: unverified.length ? 'unchecked-detail' : 'verified',
      unverified,
    })
  }

  return { claims, dropped }
}
