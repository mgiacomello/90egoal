// ONE TAP — motore di riconoscimento.
//
// Regola di prodotto: l'AI trascrive, questo file DECIDE.
// Tenere la decisione qui (deterministica, testabile, offline) significa che
// l'azione proposta non può essere allucinata: o l'entità è nel testo, o non esiste.
//
// Nessuna dipendenza da DOM/Node: gira identico su server, client e nei test.

import type {
  Analysis,
  CalendarEvent,
  Confidence,
  Enrichment,
  Entity,
  Lang,
  SuggestedAction,
} from './types'

export interface DetectOptions {
  now?: Date
  lang?: Lang
  source?: Analysis['source']
  usedAI?: boolean
  /** Risposte suggerite dal modello, se disponibili (hanno la precedenza sui template). */
  replies?: string[]
  /** Etichetta di contenuto data dal modello (message, product, receipt...). */
  hintKind?: string
  /**
   * Etichette e testi pronti dal modello. Decorano l'azione scelta qui: un
   * titolo per l'evento, nome e azienda per il contatto, una bozza per
   * l'email. Non possono aggiungere entità — se un numero non è nel testo,
   * nessuna bozza lo farà comparire.
   */
  enrich?: Enrichment
  /**
   * Testo di provenienza poco affidabile (OCR faticoso): un numero di telefono
   * deve avere una forma da numero di telefono — prefisso, parola-chiave o
   * cifre raggruppate — per essere proposto. Una fila nuda di cifre non basta.
   */
  strictNumbers?: boolean
}

/* ------------------------------------------------------------------ *
 * Utility
 * ------------------------------------------------------------------ */

interface Range {
  start: number
  end: number
}

function overlaps(a: Range, taken: Range[]): boolean {
  return taken.some((t) => a.start < t.end && t.start < a.end)
}

function pushEntity(list: Entity[], taken: Range[], e: Entity): void {
  if (overlaps(e, taken)) return
  list.push(e)
  taken.push({ start: e.start, end: e.end })
}

const IT_WORDS = /\b(che|non|per|con|una|del|della|sono|ciao|alle|ore|via|piazza|domani|oggi|grazie|prego|puoi|possiamo|questo|questa|come|quando|dove|perch[e\u00e9]|anche|molto|bene|ti|mi|ci|gli|il|lo|la|le|un|dei|ma|se|pi[u\u00f9])\b/gi
const EN_WORDS = /\b(the|and|you|your|for|with|this|that|from|have|can|will|would|are|is|at|to|of|on|in|we|it|be|hey|hi|hello|thanks|please|when|where|why|how)\b/gi

export function detectLang(text: string): Lang {
  const it = (text.match(IT_WORDS) ?? []).length
  const en = (text.match(EN_WORDS) ?? []).length
  return it > en ? 'it' : 'en'
}

/* ------------------------------------------------------------------ *
 * URL / email
 * ------------------------------------------------------------------ */

const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+|(?<![@\w.])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|ai|app|dev|co|it|uk|de|fr|es|eu|shop|store|news|me|tv|xyz)(?:\/[^\s<>"'`)\]]*)?/gi
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

function normalizeUrl(raw: string): string {
  const clean = raw.replace(/[.,;:!?)\]]+$/, '')
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
}

/* ------------------------------------------------------------------ *
 * IBAN — validato con il check digit mod-97: niente falsi positivi.
 * ------------------------------------------------------------------ */

const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g

export function isValidIban(candidate: string): boolean {
  const s = candidate.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const rearranged = s.slice(4) + s.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/* ------------------------------------------------------------------ *
 * Date e orari
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  gennaio: 0, gen: 0, january: 0, jan: 0,
  febbraio: 1, feb: 1, february: 1,
  marzo: 2, mar: 2, march: 2,
  aprile: 3, apr: 3, april: 3,
  maggio: 4, mag: 4, may: 4,
  giugno: 5, giu: 5, june: 5, jun: 5,
  luglio: 6, lug: 6, july: 6, jul: 6,
  agosto: 7, ago: 7, august: 7, aug: 7,
  settembre: 8, set: 8, sett: 8, september: 8, sep: 8, sept: 8,
  ottobre: 9, ott: 9, october: 9, oct: 9,
  novembre: 10, nov: 10, november: 10,
  dicembre: 11, dic: 11, december: 11, dec: 11,
}

const WEEKDAYS: Record<string, number> = {
  domenica: 0, sunday: 0, sun: 0, dom: 0,
  lunedi: 1, 'lunedì': 1, monday: 1, mon: 1, lun: 1,
  martedi: 2, 'martedì': 2, tuesday: 2, tue: 2, tues: 2, mar: 2,
  mercoledi: 3, 'mercoledì': 3, wednesday: 3, wed: 3, mer: 3,
  giovedi: 4, 'giovedì': 4, thursday: 4, thu: 4, thurs: 4, gio: 4,
  venerdi: 5, 'venerdì': 5, friday: 5, fri: 5, ven: 5,
  sabato: 6, saturday: 6, sat: 6, sab: 6,
}

/** Alternanza ordinata dal più lungo: "martedì" prima di "mar". */
function alternation(keys: string[]): string {
  return [...keys].sort((a, b) => b.length - a.length).join('|')
}

const MONTH_NAMES = alternation(Object.keys(MONTHS))
const WEEKDAY_NAMES = alternation(Object.keys(WEEKDAYS))

// \b non funziona accanto alle lettere accentate: qui servono confini veri.
const WB_START = '(?<![\\p{L}\\p{N}])'
const WB_END = '(?![\\p{L}\\p{N}])'

/** Parti del giorno usate quando manca l'ora esatta. */
const DAYPARTS: Array<[RegExp, number]> = [
  [/\b(mattina|mattino|morning)\b/i, 9],
  [/\b(pranzo|lunch|mezzogiorno|noon)\b/i, 13],
  [/\b(pomeriggio|afternoon)\b/i, 15],
  [/\b(aperitivo|apero)\b/i, 18],
  [/\b(cena|dinner|sera|serata|evening|stasera|tonight)\b/i, 20],
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO locale (senza Z): le date "umane" non hanno timezone. */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

interface TimeHit extends Range {
  hour: number
  minute: number
  raw: string
  approx: boolean
}

function findTime(text: string, taken: Range[]): TimeHit | null {
  const candidates: TimeHit[] = []

  // 19:30 · 19.30 · 7:30 pm · alle 19 · at 7pm · ore 21
  const re =
    /\b(?:(?:alle|alle ore|ore|at|h)\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const range = { start: m.index, end: m.index + m[0].length }
    if (overlaps(range, taken)) continue
    const hasSeparator = m[2] !== undefined
    const meridiem = m[3]?.toLowerCase().replace(/\./g, '')
    const prefixed = /^(alle|ore|at|h)\b/i.test(m[0].trim())
    // Un numero nudo è un orario solo se ha i minuti, l'am/pm o un "alle/at".
    if (!hasSeparator && !meridiem && !prefixed) continue
    let hour = Number(m[1])
    const minute = m[2] ? Number(m[2]) : 0
    if (minute > 59) continue
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    if (hour > 23) continue
    // "12.09" in una data non è un orario: lo scarta chi cerca le date, che gira prima.
    candidates.push({ ...range, hour, minute, raw: m[0].trim(), approx: false })
  }

  if (candidates.length) return candidates[0]

  for (const [rx, hour] of DAYPARTS) {
    const hit = rx.exec(text)
    if (hit && !overlaps({ start: hit.index, end: hit.index + hit[0].length }, taken)) {
      return {
        start: hit.index,
        end: hit.index + hit[0].length,
        hour,
        minute: 0,
        raw: hit[0],
        approx: true,
      }
    }
  }
  return null
}

interface DateHit extends Range {
  date: Date
  raw: string
}

function findDate(text: string, now: Date, lang: Lang, taken: Range[]): DateHit | null {
  const mk = (y: number, mo: number, d: number) => new Date(y, mo, d, 0, 0, 0, 0)

  // 1. ISO — 2026-09-15
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text)
  if (m && !overlaps({ start: m.index, end: m.index + m[0].length }, taken)) {
    return {
      start: m.index,
      end: m.index + m[0].length,
      date: mk(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
      raw: m[0],
    }
  }

  // 2. Numerica — 15/09/2026, 15-09, 09/15/2026 (US)
  const numeric = /\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/g
  while ((m = numeric.exec(text))) {
    const range = { start: m.index, end: m.index + m[0].length }
    if (overlaps(range, taken)) continue
    const a = Number(m[1])
    const b = Number(m[2])
    // Senza anno e con separatore ":" saremmo su un orario: qui il separatore lo esclude.
    const usFormat = lang === 'en' && a <= 12
    let day = usFormat ? b : a
    let month = usFormat ? a : b
    if (a > 12 && b <= 12) { day = a; month = b }
    else if (b > 12 && a <= 12) { day = b; month = a }
    if (day < 1 || day > 31 || month < 1 || month > 12) continue
    let year = now.getFullYear()
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const date = mk(year, month - 1, day)
    if (!m[3] && date.getTime() < now.getTime() - 86400000) date.setFullYear(year + 1)
    return { ...range, date, raw: m[0] }
  }

  // 3. Mese scritto — "15 marzo 2026", "March 15", "15 mar"
  const dm = new RegExp(`${WB_START}(\\d{1,2})(?:\u00b0|st|nd|rd|th)?\\s+(?:di\\s+)?(${MONTH_NAMES})${WB_END}\\.?(?:\\s+(\\d{4}))?`, 'iu')
  m = dm.exec(text)
  if (m && !overlaps({ start: m.index, end: m.index + m[0].length }, taken)) {
    const month = MONTHS[m[2].toLowerCase()]
    const year = m[3] ? Number(m[3]) : now.getFullYear()
    const date = mk(year, month, Number(m[1]))
    if (!m[3] && date.getTime() < now.getTime() - 86400000) date.setFullYear(year + 1)
    return { start: m.index, end: m.index + m[0].length, date, raw: m[0] }
  }
  const md = new RegExp(`${WB_START}(${MONTH_NAMES})\\s+(\\d{1,2})(?:\u00b0|st|nd|rd|th)?${WB_END}(?:,?\\s+(\\d{4}))?`, 'iu')
  m = md.exec(text)
  if (m && !overlaps({ start: m.index, end: m.index + m[0].length }, taken)) {
    const month = MONTHS[m[1].toLowerCase()]
    const year = m[3] ? Number(m[3]) : now.getFullYear()
    const date = mk(year, month, Number(m[2]))
    if (!m[3] && date.getTime() < now.getTime() - 86400000) date.setFullYear(year + 1)
    return { start: m.index, end: m.index + m[0].length, date, raw: m[0] }
  }

  // 4. Relative — oggi / domani / dopodomani / today / tomorrow
  const rel: Array<[RegExp, number]> = [
    [/\b(dopodomani|day after tomorrow)\b/i, 2],
    [/\b(domani|tomorrow)\b/i, 1],
    [/\b(oggi|today|stasera|tonight|stamattina)\b/i, 0],
  ]
  for (const [rx, offset] of rel) {
    const hit = rx.exec(text)
    if (hit && !overlaps({ start: hit.index, end: hit.index + hit[0].length }, taken)) {
      const date = mk(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      return { start: hit.index, end: hit.index + hit[0].length, date, raw: hit[0] }
    }
  }

  // 5. Giorno della settimana — la prossima occorrenza
  const wd = new RegExp(`${WB_START}(${WEEKDAY_NAMES})${WB_END}`, 'iu')
  m = wd.exec(text)
  if (m && !overlaps({ start: m.index, end: m.index + m[0].length }, taken)) {
    const word = m[1].toLowerCase()
    // "mar" è ambiguo fra martedì e marzo: in caso di dubbio non si indovina.
    if (word !== 'mar') {
      const target = WEEKDAYS[word]
      let delta = (target - now.getDay() + 7) % 7
      if (delta === 0) delta = 7
      const date = mk(now.getFullYear(), now.getMonth(), now.getDate() + delta)
      return { start: m.index, end: m.index + m[0].length, date, raw: m[0] }
    }
  }

  return null
}

/* ------------------------------------------------------------------ *
 * Telefoni
 * ------------------------------------------------------------------ */

const PHONE_RE = /(?:\+|00)?\s?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.\-()]{6,20}\d/g
const PHONE_HINT = /\b(tel|telefono|phone|cell|cellulare|mobile|call|chiama|chiamami|whatsapp|numero|contatta|contact)\b|\ud83d\udcde|\u260e|\ud83d\udcf1/i

/**
 * Non si indovina mai il prefisso internazionale: comporre il paese sbagliato è
 * peggio che comporre un numero nazionale, che sul telefono dell'utente funziona.
 */
function normalizePhone(raw: string): string {
  let s = raw.replace(/[^\d+]/g, '')
  if (s.startsWith('00')) s = `+${s.slice(2)}`
  return s
}

/* ------------------------------------------------------------------ *
 * Indirizzi
 * ------------------------------------------------------------------ */

const STREET_IT =
  /\b(via|viale|v\.le|piazza|p\.zza|piazzale|corso|c\.so|largo|vicolo|strada|contrada|lungomare|lungotevere|borgo)\b/i
const STREET_EN =
  /\b(\d{1,5})\s+([A-Z][\w'\u2019.-]*(?:\s+[A-Z][\w'\u2019.-]*){0,3})\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|square|sq|place|pl|way|court|ct)\b\.?/i
const STREET_INTL = /\b(rue|calle|carrer|stra(?:ss|\u00df)e|platz|weg|damm|plaza|pra\u00e7a)\b/i

function findAddress(text: string, taken: Range[]): { raw: string; start: number; end: number } | null {
  for (const line of splitLines(text)) {
    const it = STREET_IT.exec(line.text) ?? STREET_INTL.exec(line.text)
    if (it) {
      const absStart = line.start + it.index
      const rest = line.text.slice(it.index)
      const trimmed = trimAddress(rest, absStart, taken)
      // Un indirizzo italiano credibile ha il numero civico o il CAP.
      if (trimmed && /\d/.test(trimmed)) {
        return { raw: trimmed, start: absStart, end: absStart + trimmed.length }
      }
    }
    const en = STREET_EN.exec(line.text)
    if (en) {
      const absStart = line.start + en.index
      const trimmed = trimAddress(line.text.slice(en.index), absStart, taken)
      if (trimmed) return { raw: trimmed, start: absStart, end: absStart + trimmed.length }
    }
  }
  return null
}

function splitLines(text: string): Array<{ text: string; start: number }> {
  const out: Array<{ text: string; start: number }> = []
  let offset = 0
  for (const line of text.split('\n')) {
    out.push({ text: line, start: offset })
    offset += line.length + 1
  }
  return out
}

/** Taglia la coda non-indirizzo ("... alle 18:30", "chiamami", ecc.). */
function trimAddress(rest: string, absStart: number, taken: Range[]): string | null {
  // Si ferma prima di qualunque entità già riconosciuta (orari, telefoni, email).
  let limit = rest.length
  for (const t of taken) {
    if (t.start > absStart && t.start - absStart < limit) limit = t.start - absStart
  }
  let candidate = rest.slice(0, limit)

  const groups = candidate.split(',')
  const kept: string[] = [groups[0]]
  for (const g of groups.slice(1)) {
    const piece = g.trim()
    const words = piece.split(/\s+/).filter(Boolean)
    const looksLikePlace =
      /\b\d{5}\b/.test(piece) || (words.length > 0 && words.length <= 3 && /^[A-Za-z\u00c0-\u00ff'\u2019\s.\d-]+$/.test(piece))
    if (!looksLikePlace) break
    kept.push(g)
  }
  candidate = kept.join(',')

  candidate = candidate
    .replace(/\s+(?:alle?|at|ore|h|il|the|per|for|verso|around)\s*$/i, '')
    .replace(/[\s.,;:\u2014\u2013-]+$/, '')
    .trim()

  return candidate.length >= 5 ? candidate : null
}

/* ------------------------------------------------------------------ *
 * Messaggi e conversazioni
 * ------------------------------------------------------------------ */

const GREETING = /^[\s>"'*]*\b(hey|hi|hello|ciao|buongiorno|buonasera|salve|yo|ehi)\b/i
const ASK = /\b(can we|could you|can you|would you|do you|are you|shall we|let me know|puoi|potresti|possiamo|ti va|riesci|mi fai sapere|fammi sapere|che ne dici|ci sei|ce la fai)\b/i
const SECOND_PERSON = /\b(you|your|we|us|tu|ti|voi|ci|vi|tuo|tua|insieme)\b/i
const CHAT_APP = /\b(whatsapp|telegram|imessage|messenger|sms|dm|chat)\b/i
const CHAT_TIMESTAMP = /\b\d{1,2}:\d{2}\b\s*(?:am|pm)?\s*[\u2713\u2714]{1,2}/i

interface MessageSignal {
  isMessage: boolean
  isQuestion: boolean
  score: number
}

function analyseMessage(text: string, hintKind?: string): MessageSignal {
  let score = 0
  if (GREETING.test(text)) score += 0.3
  if (ASK.test(text)) score += 0.3
  if (/\?/.test(text)) score += 0.25
  if (SECOND_PERSON.test(text)) score += 0.15
  if (CHAT_APP.test(text)) score += 0.2
  if (CHAT_TIMESTAMP.test(text)) score += 0.3
  if (hintKind === 'message' || hintKind === 'conversation') score += 0.45
  const words = text.trim().split(/\s+/).length
  if (words > 90) score -= 0.25
  return {
    isMessage: score >= 0.45,
    isQuestion: /\?/.test(text) || ASK.test(text),
    score: Math.min(score, 1),
  }
}

/* ------------------------------------------------------------------ *
 * Intenzioni esplicite ("chiamalo", "portami lì", "salvalo")
 * ------------------------------------------------------------------ */

const INTENTS: Array<[RegExp, SuggestedAction['kind']]> = [
  [/\b(chiama(?:lo|la|mi)?|telefona|call (?:this|him|her|me|them)?|ring)\b/i, 'CALL'],
  [/\b(portami|indicazioni|come ci arrivo|navigate|take me there|directions|how do i get there)\b/i, 'NAVIGATE'],
  [/\b(rispondi|reply|answer)\b/i, 'REPLY'],
  [/\b(copia|copy)\b/i, 'COPY'],
  [/\b(cerca|trova(?:lo)?|find (?:this|it)|search|look (?:this )?up|find online)\b/i, 'SEARCH'],
  [/\b(in calendario|nel calendario|calendar|promemoria|remind me|segna(?:lo)?)\b/i, 'CALENDAR'],
  [/\b(traduci|translate)\b/i, 'TRANSLATE'],
  [/\b(scrivi|manda un messaggio|text (?:him|her|them|this))\b/i, 'TEXT'],
  [/\b(salva(?: questo| la nota)?|appunta|prendi nota|save (?:this|it)|note this|keep this)\b/i, 'NOTE'],
  [/\b(salva il contatto|save contact|salva in rubrica)\b/i, 'CONTACT'],
  [/\b(apri|open|visita|visit)\b/i, 'OPEN'],
  [/\b(manda|invia|share|condividi)\b/i, 'SHARE'],
]

function explicitIntents(text: string): Set<SuggestedAction['kind']> {
  const found = new Set<SuggestedAction['kind']>()
  for (const [rx, kind] of INTENTS) if (rx.test(text)) found.add(kind)
  return found
}

/* ------------------------------------------------------------------ *
 * Titolo evento
 * ------------------------------------------------------------------ */

/** Quanto dura, quando il testo lo lascia intuire: una cena non è una call. */
function defaultDurationMinutes(text: string): number {
  if (/\b(cena|pranzo|dinner|lunch|brunch|aperitivo|drinks|concerto|concert|partita|match|spettacolo|show|teatro)\b/i.test(text)) return 120
  if (/\b(volo|flight|treno|train)\b/i.test(text)) return 120
  return 60
}

const EVENT_WORDS =
  /\b(cena|pranzo|colazione|aperitivo|riunione|meeting|call|appuntamento|visita|volo|treno|partita|concerto|lezione|corso|checkup|dinner|lunch|breakfast|drinks|interview|appointment|flight|train|match|show|class|standup|demo|review)\b/i

function eventTitle(text: string, strip: Range[], lang: Lang): string {
  let masked = ''
  for (let i = 0; i < text.length; i++) {
    masked += strip.some((r) => i >= r.start && i < r.end) ? ' ' : text[i]
  }
  const firstLine = masked.split('\n').find((l) => l.trim().length > 0) ?? masked
  let title = firstLine
    .replace(/\b(alle|ore|at|on|il|the|da|from|a partire da|dalle)\b\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:\u2014\u2013-]+|[\s,;:\u2014\u2013-]+$/g, '')
    .trim()
  if (title.length > 70) title = `${title.slice(0, 67).trim()}…`
  if (title.length < 3) {
    const hit = EVENT_WORDS.exec(text)
    title = hit ? capitalize(hit[0]) : lang === 'it' ? 'Nuovo evento' : 'New event'
  }
  return capitalize(title)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ------------------------------------------------------------------ *
 * Risposte suggerite (fallback locale, senza AI)
 * ------------------------------------------------------------------ */

export function localReplies(text: string, lang: Lang, now = new Date()): string[] {
  const dayHit = findDate(text, now, lang, [])
  const day = dayHit?.raw?.trim()
  const it = lang === 'it'

  if (day) {
    return it
      ? [`Per me ${day} va benissimo.`, `${capitalize(day)} ok, a che ora?`, `Purtroppo ${day} non posso, un altro giorno?`]
      : [`Sure, ${day} works for me.`, `${capitalize(day)} is fine. What time?`, `Sorry, I can't on ${day}. Another day?`]
  }
  if (/\?/.test(text)) {
    return it
      ? ['Sì, per me va bene.', 'Ok! Mi dici qualcosa in più?', 'Al momento non riesco, ti aggiorno io.']
      : ['Yes, that works for me.', 'Sounds good — can you tell me more?', "I can't right now, I'll get back to you."]
  }
  return it
    ? ['Ricevuto, grazie!', 'Perfetto, ci sono.', 'Ti rispondo tra poco.']
    : ['Got it, thanks!', 'Perfect, I’m in.', 'I’ll get back to you shortly.']
}

/* ------------------------------------------------------------------ *
 * Etichette
 * ------------------------------------------------------------------ */

export const ACTION_LABEL: Record<SuggestedAction['kind'], string> = {
  CALL: 'CALL',
  TEXT: 'TEXT',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  COPY: 'COPY',
  OPEN: 'OPEN',
  NAVIGATE: 'NAVIGATE',
  CALENDAR: 'ADD TO CALENDAR',
  CONTACT: 'SAVE CONTACT',
  SEARCH: 'SEARCH',
  REPLY: 'REPLY',
  TRANSLATE: 'TRANSLATE',
  SHARE: 'SHARE',
  NOTE: 'SAVE NOTE',
}

/* ------------------------------------------------------------------ *
 * Arricchimento: cosa si accetta dal modello
 * ------------------------------------------------------------------ */

function short(value: string | undefined, max: number): string | undefined {
  const v = value?.trim()
  return v && v.length <= max ? v : undefined
}

/** Un luogo suggerito dal modello vale solo se compare davvero nel testo letto. */
/** Note dell'evento: l'annotazione del modello (se c'è) e poi il testo di partenza. */
function eventNotes(modelNotes: string | undefined, text: string): string {
  const source = text.length > 600 ? `${text.slice(0, 597)}\u2026` : text
  if (!modelNotes || source.toLowerCase().includes(modelNotes.toLowerCase())) return source
  return `${modelNotes}\n\n${source}`
}

function grounded(value: string | undefined, text: string): string | undefined {
  const v = short(value, 120)
  if (!v) return undefined
  const needle = v.toLowerCase().replace(/\s+/g, ' ')
  return text.toLowerCase().replace(/\s+/g, ' ').includes(needle) ? v : undefined
}

/* ------------------------------------------------------------------ *
 * Il motore
 * ------------------------------------------------------------------ */

export function analyze(input: string, options: DetectOptions = {}): Analysis {
  const text = (input ?? '').replace(/\r\n/g, '\n').trim()
  const now = options.now ?? new Date()
  const lang = options.lang ?? detectLang(text)
  const source = options.source ?? 'text'

  const entities: Entity[] = []
  const taken: Range[] = []

  if (!text) {
    return { text, lang, entities, primary: null, secondary: [], confidence: 'low', source, usedAI: !!options.usedAI }
  }

  // --- schemi espliciti da QR code: hanno la precedenza su tutto ---
  const wifi = /WIFI:(?:[STPH]:[^;]*;){1,5};?/i.exec(text)
  if (wifi) {
    const ssid = /S:([^;]*)/i.exec(wifi[0])?.[1] ?? ''
    const pass = /P:([^;]*)/i.exec(wifi[0])?.[1] ?? ''
    pushEntity(entities, taken, {
      kind: 'wifi', value: pass || ssid, raw: wifi[0],
      start: wifi.index, end: wifi.index + wifi[0].length,
      meta: { ssid, password: pass },
    })
  }

  // --- email ---
  for (const m of text.matchAll(EMAIL_RE)) {
    const raw = m[0]
    pushEntity(entities, taken, {
      kind: 'email', value: raw.toLowerCase(), raw,
      start: m.index!, end: m.index! + raw.length,
    })
  }

  // --- url ---
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(/[.,;:!?)\]]+$/, '')
    pushEntity(entities, taken, {
      kind: 'url', value: normalizeUrl(raw), raw,
      start: m.index!, end: m.index! + raw.length,
    })
  }

  // --- iban ---
  for (const m of text.matchAll(IBAN_RE)) {
    if (!isValidIban(m[0])) continue
    pushEntity(entities, taken, {
      kind: 'iban', value: m[0].replace(/\s+/g, '').toUpperCase(), raw: m[0],
      start: m.index!, end: m.index! + m[0].length,
    })
  }

  // --- data/ora (prima dei telefoni: "12.09.2026" non è un numero) ---
  let dateHit = findDate(text, now, lang, taken)
  if (dateHit) taken.push({ start: dateHit.start, end: dateHit.end })
  let timeHit = findTime(text, taken)
  if (timeHit) taken.push({ start: timeHit.start, end: timeHit.end })

  // Il modello normalizza le date che il parser non capisce ("Sabato 20
  // Settembre h. 21"), ma non può inventarle: giorno e ora devono comparire
  // nel testo come numeri.
  const modelEvent = options.enrich?.event
  if (!dateHit && modelEvent?.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(modelEvent.date)
    if (m) {
      const day = Number(m[3])
      const monthName = new Date(Number(m[1]), Number(m[2]) - 1, day).toLocaleDateString('it-IT', { month: 'long' })
      const dayInText = new RegExp(`(?<!\\d)${day}(?!\\d)`).test(text)
      const monthInText = new RegExp(`\\b${Number(m[2])}\\b`).test(text) || new RegExp(monthName, 'i').test(text) ||
        new RegExp(new Date(Number(m[1]), Number(m[2]) - 1, day).toLocaleDateString('en-GB', { month: 'long' }), 'i').test(text)
      if (dayInText && monthInText) {
        dateHit = { start: 0, end: 0, date: new Date(Number(m[1]), Number(m[2]) - 1, day), raw: modelEvent.date }
      }
    }
  }
  if (!timeHit && modelEvent?.time) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(modelEvent.time)
    if (m && new RegExp(`(?<!\\d)${Number(m[1])}(?!\\d)`).test(text)) {
      timeHit = { start: 0, end: 0, hour: Number(m[1]), minute: Number(m[2]), raw: modelEvent.time, approx: false }
    }
  }

  let calendarEvent: CalendarEvent | null = null
  if (dateHit || timeHit) {
    const base = dateHit ? new Date(dateHit.date) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (timeHit) base.setHours(timeHit.hour, timeHit.minute, 0, 0)
    else base.setHours(9, 0, 0, 0)
    // Ora senza data e già passata: si intende domani.
    if (!dateHit && timeHit && base.getTime() < now.getTime()) base.setDate(base.getDate() + 1)
    const minutes = modelEvent?.durationMinutes && modelEvent.durationMinutes >= 15 && modelEvent.durationMinutes <= 720
      ? modelEvent.durationMinutes
      : defaultDurationMinutes(text)
    const end = new Date(base.getTime() + minutes * 60 * 1000)
    const strip: Range[] = []
    if (dateHit && dateHit.end > dateHit.start) strip.push(dateHit)
    if (timeHit && timeHit.end > timeHit.start) strip.push(timeHit)
    const raw = [dateHit?.raw, timeHit?.raw].filter(Boolean).join(' ')
    const start = dateHit ? dateHit.start : timeHit!.start
    const endIdx = timeHit ? timeHit.end : dateHit!.end
    calendarEvent = {
      // Il modello dà un titolo umano ("Cena con Anna da Nobu") dove l'euristica
      // darebbe la prima riga; il luogo però deve stare nel testo.
      title: short(options.enrich?.event?.title, 80) ?? eventTitle(text, strip, lang),
      start: toLocalIso(base),
      end: toLocalIso(end),
      location: grounded(options.enrich?.event?.location, text),
      // Il testo di partenza dentro all'evento: fra un mese si capisce ancora
      // perché sta in agenda.
      notes: eventNotes(short(options.enrich?.event?.notes, 200), text),
      allDay: !timeHit,
    }
    entities.push({
      kind: 'datetime', value: toLocalIso(base), raw,
      start, end: Math.max(endIdx, start + 1),
      meta: { approxTime: !!timeHit?.approx, hasTime: !!timeHit },
    })
  }

  // --- telefono ---
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0].trim()
    const range = { start: m.index! + (m[0].length - m[0].trimStart().length), end: m.index! + m[0].length }
    if (overlaps(range, taken)) continue
    const digits = raw.replace(/\D/g, '')
    const hasPlus = /^(\+|00)/.test(raw)
    const nearby = text.slice(Math.max(0, range.start - 30), range.start)
    const hinted = PHONE_HINT.test(nearby)
    if (digits.length < 7 || digits.length > 15) continue
    if (!hasPlus && !hinted && digits.length < 9) continue
    if (/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(raw)) continue
    if (options.strictNumbers && !hasPlus && !hinted) {
      // Da una lettura incerta, una sequenza di cifre senza né prefisso né
      // parola-chiave né raggruppamento è quasi sempre rumore, non un numero.
      const grouped = /\d[\s.\-]\d/.test(raw) && digits.length >= 9 && digits.length <= 13
      if (!grouped) continue
    }
    pushEntity(entities, taken, {
      kind: 'phone', value: normalizePhone(raw), raw,
      start: range.start, end: range.end,
    })
  }

  // --- codice OTP ---
  const otp = /\b(?:codice|code|otp|pin|verifica|verification)\D{0,20}?(\d{4,8})\b/i.exec(text)
  if (otp && !overlaps({ start: otp.index, end: otp.index + otp[0].length }, taken)) {
    const at = text.indexOf(otp[1], otp.index)
    pushEntity(entities, taken, {
      kind: 'otp', value: otp[1], raw: otp[1], start: at, end: at + otp[1].length,
    })
  }

  // --- importo ---
  const amount = /(?:[\u20ac$\u00a3]\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s?(?:\u20ac|eur|euro|usd|\$))/i.exec(text)
  if (amount && !overlaps({ start: amount.index, end: amount.index + amount[0].length }, taken)) {
    pushEntity(entities, taken, {
      kind: 'amount', value: amount[0].trim(), raw: amount[0],
      start: amount.index, end: amount.index + amount[0].length,
    })
  }

  // --- indirizzo (dopo tutto il resto: si ferma davanti alle entità note) ---
  const address = findAddress(text, taken)
  if (address) {
    pushEntity(entities, taken, {
      kind: 'address', value: address.raw, raw: address.raw,
      start: address.start, end: address.end,
    })
  }

  // --- messaggio ---
  const msg = analyseMessage(text, options.hintKind)
  if (msg.isMessage) {
    entities.push({ kind: 'message', value: text, raw: text, start: 0, end: text.length, meta: { question: msg.isQuestion } })
  }

  /* ---------------- ranking ---------------- */

  const intents = explicitIntents(text)
  const get = (k: Entity['kind']) => entities.find((e) => e.kind === k)
  const candidates: SuggestedAction[] = []

  const add = (a: SuggestedAction) => candidates.push(a)

  const phone = get('phone')
  const email = get('email')
  const iban = get('iban')
  const url = get('url')
  const addr = get('address')
  const dt = get('datetime')
  const otpE = get('otp')
  const wifiE = get('wifi')

  if (wifiE) {
    add({ kind: 'COPY', label: ACTION_LABEL.COPY, subject: String(wifiE.meta?.ssid ?? 'Wi-Fi'), value: wifiE.value, score: 0.95, entity: wifiE })
  }
  if (otpE) {
    add({ kind: 'COPY', label: ACTION_LABEL.COPY, subject: otpE.value, value: otpE.value, score: 0.93, entity: otpE })
  }
  if (iban) {
    add({ kind: 'COPY', label: ACTION_LABEL.COPY, subject: formatIban(iban.value), value: iban.value, score: 0.92, entity: iban })
  }
  if (addr) {
    add({ kind: 'NAVIGATE', label: ACTION_LABEL.NAVIGATE, subject: addr.value, value: addr.value, score: 0.88, entity: addr })
  }
  const enrich = options.enrich
  const messageDraft = short(enrich?.messageDraft, 400)
  const contactName = short(enrich?.contact?.name, 80)
  const contact = (phone || email)
    ? {
        name: contactName,
        company: short(enrich?.contact?.company, 80),
        role: short(enrich?.contact?.role, 80),
        phone: phone?.value,
        email: email?.value,
      }
    : undefined
  // Un biglietto da visita con un nome: la cosa più utile in un tap è salvare
  // tutto — nome, ruolo, azienda, numero, email — non chiamare al buio.
  const isCard = options.hintKind === 'contact' && !!contactName

  if (phone) {
    const who = contactName ?? phone.raw.trim()
    add({ kind: 'CALL', label: ACTION_LABEL.CALL, subject: who, value: phone.value, score: 0.86, entity: phone })
    if (phone.value.startsWith('+')) {
      // wa.me accetta solo numeri in formato internazionale.
      add({ kind: 'WHATSAPP', label: ACTION_LABEL.WHATSAPP, subject: who, value: phone.value, score: 0.42, entity: phone,
        draft: messageDraft ? { body: messageDraft } : undefined })
    }
    add({ kind: 'TEXT', label: ACTION_LABEL.TEXT, subject: who, value: phone.value, score: messageDraft ? 0.5 : 0.38, entity: phone,
      draft: messageDraft ? { body: messageDraft } : undefined })
  }
  if (contact && (phone || email)) {
    const anchor = phone ?? email!
    add({ kind: 'CONTACT', label: ACTION_LABEL.CONTACT, subject: contactName ?? anchor.raw.trim(), value: anchor.value,
      score: isCard ? 0.9 : 0.34, entity: anchor, contact })
  }
  if (email) {
    const subject = short(enrich?.emailDraft?.subject, 120)
    const body = short(enrich?.emailDraft?.body, 1200)
    add({ kind: 'EMAIL', label: ACTION_LABEL.EMAIL, subject: contactName ?? email.value, value: email.value,
      score: body ? 0.84 : 0.8, entity: email, draft: body ? { subject, body } : undefined })
  }
  if (dt && calendarEvent) {
    const penalty = msg.isQuestion ? 0.18 : 0 // una data solo "proposta" non è un evento confermato
    const bonus = EVENT_WORDS.test(text) ? 0.06 : 0
    add({
      kind: 'CALENDAR', label: ACTION_LABEL.CALENDAR,
      subject: `${calendarEvent.title} — ${humanDate(calendarEvent, lang)}`,
      value: calendarEvent.title, score: 0.78 - penalty + bonus, entity: dt,
      // L'indirizzo trovato dal motore vince (è verificato); altrimenti il luogo
      // proposto dal modello, purché compaia nel testo.
      event: { ...calendarEvent, location: addr?.value ?? calendarEvent.location },
    })
  }
  if (url) {
    add({ kind: 'OPEN', label: ACTION_LABEL.OPEN, subject: url.raw, value: url.value, score: 0.8, entity: url })
  }
  if (msg.isMessage) {
    const messageEntity = get('message')!
    const bonus = msg.isQuestion ? 0.2 : 0
    add({
      kind: 'REPLY', label: ACTION_LABEL.REPLY, subject: firstSentence(text), value: text,
      score: 0.72 + bonus, entity: messageEntity,
      replies: options.replies?.length ? options.replies.slice(0, 3) : localReplies(text, lang, now),
    })
  }

  // Fallback: c'è sempre qualcosa da fare con del testo.
  const cleanText = text.length > 300 ? `${text.slice(0, 300)}…` : text
  add({ kind: 'COPY', label: ACTION_LABEL.COPY, subject: cleanText, value: text, score: 0.4,
    entity: { kind: 'title', value: text, raw: text, start: 0, end: text.length } })
  const query = short(enrich?.searchQuery, 120) ?? firstSentence(text)
  add({ kind: 'SEARCH', label: ACTION_LABEL.SEARCH, subject: query, value: query, score:
    options.hintKind === 'product' ? 0.7 : 0.36,
    entity: { kind: 'title', value: text, raw: text, start: 0, end: text.length } })
  // Salvare quello che si è appena letto è utile su qualunque cattura: vale
  // più su un testo lungo, dove non c'è un'entità sola da cui ripartire.
  add({ kind: 'NOTE', label: ACTION_LABEL.NOTE, subject: short(enrich?.title, 80) ?? firstSentence(text), value: text,
    score: text.length > 120 ? 0.44 : 0.32,
    entity: { kind: 'title', value: text, raw: text, start: 0, end: text.length } })
  if (text.length > 12) {
    add({ kind: 'TRANSLATE', label: ACTION_LABEL.TRANSLATE, subject: firstSentence(text), value: text, score: 0.2,
      entity: { kind: 'title', value: text, raw: text, start: 0, end: text.length } })
  }

  // Un'intenzione scritta a chiare lettere non è un indizio da sommare agli
  // altri: è una richiesta. Chi scrive "prendi nota" non vuole che un'euristica
  // sulle date gli passi davanti per un centesimo di punteggio. Il piccolo
  // termine finale conserva l'ordine quando le intenzioni esplicite sono più
  // d'una ("chiamalo e salvalo").
  for (const c of candidates) {
    if (intents.has(c.kind)) c.score = Math.max(c.score, 0.9) + c.score * 0.01
  }

  candidates.sort((a, b) => b.score - a.score)

  const primary = candidates[0] ?? null
  const seen = new Set<string>()
  const secondary = candidates
    .slice(1)
    .filter((c) => {
      const key = `${c.kind}:${c.value}`
      if (c.score < 0.3 || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)

  const top = primary?.score ?? 0
  const runnerUp = candidates[1]?.score ?? 0
  let confidence: Confidence = 'low'
  if (top >= 0.75 && top - runnerUp >= 0.05) confidence = 'high'
  else if (top >= 0.55) confidence = 'medium'

  return {
    text,
    title: short(options.enrich?.title, 80),
    lang,
    entities,
    primary,
    secondary,
    confidence,
    source,
    usedAI: !!options.usedAI,
  }
}

/* ------------------------------------------------------------------ *
 * Helper di presentazione
 * ------------------------------------------------------------------ */

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim()
}

export function firstSentence(text: string): string {
  const line = text.split('\n').find((l) => l.trim().length > 0)?.trim() ?? text.trim()
  const cut = line.split(/(?<=[.!?])\s/)[0] ?? line
  return cut.length > 90 ? `${cut.slice(0, 87).trim()}…` : cut
}

export function humanDate(event: CalendarEvent, lang: Lang): string {
  const d = new Date(event.start)
  const locale = lang === 'it' ? 'it-IT' : 'en-GB'
  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  if (event.allDay) return day
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}
