/**
 * Le scadenze. Funzione pura: niente rete, niente DOM, nessun import
 * di valori.
 *
 * Per chi fa l'avvocato la domanda che costa di più non è "cosa dice
 * il contratto" ma **"entro quando devo muovermi"**: l'ultima data
 * utile per disdire, il termine di una diffida, la scadenza di una
 * licenza. Sono date, e le date si calcolano: non si chiede a un
 * modello di indovinarle.
 *
 * Due famiglie:
 *
 *   - **esplicite**: una frase con una data e una parola che la rende
 *     un termine ("entro il", "scade il", "disdetta", "non oltre").
 *     La data è quella; la frase è la prova.
 *   - **calcolate**: un contratto con una durata, una decorrenza e un
 *     preavviso. Scadenza = decorrenza + durata; ultima disdetta =
 *     scadenza − preavviso. Il calcolo è dichiarato, e la frase da cui
 *     viene ogni numero sta accanto al risultato — perché il giorno
 *     esatto (il giorno stesso o quello prima) lo decide il contratto,
 *     e chi legge deve poterlo controllare in un colpo d'occhio.
 */

export type DeadlineKind = 'scadenza' | 'disdetta' | 'termine' | 'rinnovo'

export type Deadline = {
  documentId: string
  kind: DeadlineKind
  /** "2026-10-31" */
  date: string
  /** Una riga: "Ultima data utile per la disdetta (preavviso 3 mesi)". */
  label: string
  /** La frase del documento da cui viene. */
  quote: string
  how: 'esplicita' | 'calcolata'
}

export type DocLike = {
  id: string
  title: string
  text: string
  /** ISO: serve a sciogliere le date senza anno e i termini relativi. */
  occurredAt: string
}

/* ------------------------------------------------------------------ *
 * Date
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
}

const WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8,
  nove: 9, dieci: 10, dodici: 12, quindici: 15, diciotto: 18, venti: 20, ventiquattro: 24,
  trenta: 30, trentasei: 36, quarantotto: 48, sessanta: 60, novanta: 90, centoventi: 120,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function validDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Fine mese rispettata: 31 gennaio + 1 mese = 28 febbraio, non 3 marzo. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export type FoundDate = { iso: string; index: number; length: number }

const NUMERIC = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g
const TEXTUAL = /\b(\d{1,2}|1[º°])\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/gi

/**
 * Tutte le date di un testo, nei tre modi in cui si scrivono in italiano.
 * Una data senza anno prende l'anno del documento — e quello dopo, se
 * così finirebbe più di due mesi prima del documento stesso: "entro il
 * 10 gennaio" scritto a dicembre è gennaio prossimo.
 */
export function findDates(text: string, refIso: string): FoundDate[] {
  const out: FoundDate[] = []
  const refYear = Number(refIso.slice(0, 4)) || new Date().getUTCFullYear()

  for (const m of text.matchAll(NUMERIC)) {
    const iso = validDay(Number(m[3]), Number(m[2]), Number(m[1]))
    if (iso) out.push({ iso, index: m.index ?? 0, length: m[0].length })
  }
  for (const m of text.matchAll(ISO)) {
    const iso = validDay(Number(m[1]), Number(m[2]), Number(m[3]))
    if (iso) out.push({ iso, index: m.index ?? 0, length: m[0].length })
  }
  for (const m of text.matchAll(TEXTUAL)) {
    const day = Number(m[1].replace(/[º°]/, ''))
    const month = MONTHS[m[2].toLowerCase()]
    let year = m[3] ? Number(m[3]) : refYear
    let iso = validDay(year, month, day)
    if (iso && !m[3] && addDays(iso, 60) < refIso.slice(0, 10)) {
      year += 1
      iso = validDay(year, month, day)
    }
    if (iso) out.push({ iso, index: m.index ?? 0, length: m[0].length })
  }
  return out.sort((a, b) => a.index - b.index)
}

/* ------------------------------------------------------------------ *
 * Frasi e parole chiave
 * ------------------------------------------------------------------ */

export type Sentence = { text: string; start: number }

export function sentences(text: string): Sentence[] {
  const out: Sentence[] = []
  const re = /[^.;\n]+(?:\.\d+)*[^.;\n]*[.;]?/g
  for (const m of text.matchAll(re)) {
    const t = m[0].trim()
    if (t.length >= 12) out.push({ text: t, start: m.index ?? 0 })
  }
  return out
}

const TRIGGER = /\b(entro|non oltre|a pena di|termine|scad\w*|fino al|disdett\w*|recess\w*|preavviso|rinnov\w*|decadenz\w*)\b/i
const NOTICE = /disdett|recess|preavviso/i
const RENEW = /rinnov/i
const CONTRACTISH = /contratt|accordo|licenz|abbonament|polizz|locazion|incaric|convenzion|fornitur|servizi/i

function kindOf(sentence: string): DeadlineKind {
  if (NOTICE.test(sentence)) return 'disdetta'
  if (RENEW.test(sentence)) return 'rinnovo'
  if (/scad/i.test(sentence) && CONTRACTISH.test(sentence)) return 'scadenza'
  return 'termine'
}

function clip(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function amount(raw: string): number | null {
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  return WORDS[raw.toLowerCase()] ?? null
}

/** "dodici (12) mesi", "3 mesi", "un anno" → mesi, oppure giorni. */
const SPAN = /(\d+|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici|quindici|diciotto|venti|ventiquattro|trenta|trentasei|quarantotto|sessanta|novanta|centoventi)\s*(?:\(\s*(\d+)\s*\))?\s*(mes[ei]|ann[oi]|giorn[oi])/i

type Span = { months: number; days: number; raw: string }

function spanOf(text: string, lead: RegExp): Span | null {
  const re = new RegExp(`${lead.source}[^.;\\n]{0,40}?${SPAN.source}`, 'i')
  const m = text.match(re)
  if (!m) return null
  const n = m[2] ? Number(m[2]) : amount(m[1])
  if (!n) return null
  const unit = m[3].toLowerCase()
  if (unit.startsWith('ann')) return { months: n * 12, days: 0, raw: m[0] }
  if (unit.startsWith('mes')) return { months: n, days: 0, raw: m[0] }
  return { months: 0, days: n, raw: m[0] }
}

/* ------------------------------------------------------------------ *
 * Estrazione
 * ------------------------------------------------------------------ */

/**
 * Le scadenze esplicite di un documento: ogni frase con una data e
 * una parola che la rende un termine. Più "entro N giorni" nelle mail,
 * contato dalla data della mail.
 */
export function explicitDeadlines(doc: DocLike): Deadline[] {
  const out: Deadline[] = []
  const ref = doc.occurredAt.slice(0, 10)

  for (const s of sentences(doc.text)) {
    const trigger = s.text.match(TRIGGER)
    if (!trigger) continue
    const dates = findDates(s.text, ref)
    if (dates.length) {
      // La data che segue la parola chiave; altrimenti l'ultima della frase.
      const at = trigger.index ?? 0
      const chosen = dates.find((d) => d.index >= at) ?? dates[dates.length - 1]
      const kind = kindOf(s.text)
      out.push({
        documentId: doc.id,
        kind,
        date: chosen.iso,
        label: LABEL[kind],
        quote: clip(s.text),
        how: 'esplicita',
      })
      continue
    }
    // "entro 15 giorni" in una mail: dalla data della mail.
    const rel = s.text.match(/\bentro\s+(\d+|un|uno|una|due|tre|cinque|sette|dieci|quindici|venti|trenta|sessanta|novanta)\s+(giorn[oi]|mes[ei])\b/i)
    if (rel) {
      const n = amount(rel[1])
      if (!n) continue
      const date = rel[2].toLowerCase().startsWith('mes') ? addMonths(ref, n) : addDays(ref, n)
      out.push({
        documentId: doc.id,
        kind: 'termine',
        date,
        label: `Termine: ${rel[1]} ${rel[2].toLowerCase()} dal ${ref.split('-').reverse().join('/')}`,
        quote: clip(s.text),
        how: 'calcolata',
      })
    }
  }
  return out
}

const LABEL: Record<DeadlineKind, string> = {
  scadenza: 'Scadenza',
  disdetta: 'Disdetta o recesso',
  termine: 'Termine',
  rinnovo: 'Rinnovo',
}

const START = /(decorr\w*|con effetto|a partire|efficacia|sottoscri\w+|firmat\w+|stipulat\w+|in vigore)/i
const TACIT = /tacit\w+\s+rinnov|rinnov\w+\s+tacit|s[ij]\s+(?:intende|intenderà|intenderanno)\s+(?:tacitamente\s+)?rinnovat|rinnovo\s+automatico|automaticamente\s+rinnovat/i

/**
 * Le scadenze calcolate di un contratto: durata, decorrenza, preavviso.
 * Senza una decorrenza che si trovi nel testo, niente: meglio nessuna
 * data che una data inventata.
 */
export function contractDeadlines(doc: DocLike): Deadline[] {
  const text = doc.text
  const duration = spanOf(text, /durata/)
  if (!duration) return []

  // La decorrenza: la data più vicina a una parola di decorrenza.
  const ref = doc.occurredAt.slice(0, 10)
  let start: FoundDate | null = null
  for (const s of sentences(text)) {
    if (!START.test(s.text)) continue
    const dates = findDates(s.text, ref)
    if (dates.length) {
      start = dates[0]
      break
    }
  }
  if (!start) return []

  const expiry = duration.days ? addDays(start.iso, duration.days) : addMonths(start.iso, duration.months)
  const tacit = TACIT.test(text)
  const out: Deadline[] = [
    {
      documentId: doc.id,
      kind: 'scadenza',
      date: expiry,
      label: `Scadenza: decorrenza ${start.iso.split('-').reverse().join('/')} + ${duration.raw.replace(/\s+/g, ' ')}${tacit ? ' · con rinnovo tacito' : ''}`,
      quote: clip(duration.raw),
      how: 'calcolata',
    },
  ]

  const notice = spanOf(text, /preavviso/)
  if (notice) {
    const last = notice.days ? addDays(expiry, -notice.days) : addMonths(expiry, -notice.months)
    out.push({
      documentId: doc.id,
      kind: 'disdetta',
      date: last,
      label: `Ultima data utile per la disdetta: scadenza − ${notice.raw.replace(/\s+/g, ' ')}`,
      quote: clip(notice.raw),
      how: 'calcolata',
    })
  }
  return out
}

export type Urgency = 'scaduta' | 'oggi' | 'settimana' | 'mese' | 'oltre'

export function urgency(date: string, today: string): Urgency {
  if (date < today) return 'scaduta'
  if (date === today) return 'oggi'
  if (date <= addDays(today, 7)) return 'settimana'
  if (date <= addDays(today, 30)) return 'mese'
  return 'oltre'
}

/**
 * Le scadenze che valgono la pena di vedere: dedup, finestra, ordine
 * per data. Quelle scadute da poco restano, perché una scadenza
 * mancata ieri è la riga più importante della lista.
 */
export function selectDeadlines(all: Deadline[], today: string, horizonDays = 120, pastDays = 7): Deadline[] {
  const seen = new Set<string>()
  const from = addDays(today, -pastDays)
  const to = addDays(today, horizonDays)
  return all
    .filter((d) => d.date >= from && d.date <= to)
    .filter((d) => {
      const key = `${d.documentId}|${d.kind}|${d.date}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function extractDeadlines(doc: DocLike): Deadline[] {
  return [...contractDeadlines(doc), ...explicitDeadlines(doc)]
}
