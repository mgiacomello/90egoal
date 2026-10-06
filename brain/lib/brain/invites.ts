/**
 * Gli inviti. Funzione pura: niente rete, niente DOM, nessun import di
 * valori.
 *
 * Un invito a un evento è una mail con una data, un luogo o un link per
 * registrarsi, e una parola che lo rende un invito. Se in quell'ora
 * l'agenda è già occupata, la risposta giusta è quasi sempre un "no,
 * grazie" gentile — e quello si scrive da sé.
 */

import { findDates } from './deadlines.ts'

export type Invitation = {
  /** ISO in UTC: l'inizio, se c'è un orario; altrimenti il giorno a mezzogiorno. */
  startIso: string
  hasTime: boolean
  day: string
  /** "18:30" com'è scritto. */
  timeLocal: string | null
  title: string
}

const INVITE = /\b(ti\s+invit\w*|vi\s+invit\w*|siamo\s+lieti\s+di\s+invitar\w*|invito\b|save\s+the\s+date|rsvp|you'?re\s+invited|we'?d\s+love\s+to\s+(?:have|see)\s+you|join\s+us|registrati|iscriviti\s+all'evento|conferma\s+la\s+(?:tua\s+)?partecipazione)\b/i
const NEWSLETTER = /(unsubscribe|disiscriviti|annulla\s+l'iscrizione|newsletter)/i

/** È un invito personale, non una newsletter con un evento dentro? */
export function isInvitation(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`
  if (!INVITE.test(text)) return false
  // Le newsletter invitano tutti: quelle non chiedono una risposta.
  const unsubscribes = NEWSLETTER.test(body) && !/\b(ti|vi)\s+invit/i.test(text)
  return !unsubscribes
}

function romeToUtc(y: number, m: number, d: number, h: number, min: number): string {
  const offset = m >= 4 && m <= 10 ? 2 : 1
  return new Date(Date.UTC(y, m - 1, d, h - offset, min)).toISOString()
}

/** La data dell'evento: la prima data futura nel testo, con l'orario che la segue. */
export function parseInvitation(subject: string, body: string, refIso: string): Invitation | null {
  if (!isInvitation(subject, body)) return null
  const text = `${subject}\n${body}`
  const dates = findDates(text, refIso).filter((d) => d.iso >= refIso.slice(0, 10))
  if (!dates.length) return null
  const d = dates[0]
  const after = text.slice(d.index + d.length, d.index + d.length + 60)
  const time = after.match(/\b(?:alle\s+|ore\s+|h\s*|at\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  const [y, m, day] = d.iso.split('-').map(Number)
  const hasTime = Boolean(time)
  const startIso = hasTime ? romeToUtc(y, m, day, Number(time![1]), Number(time![2])) : `${d.iso}T12:00:00.000Z`
  return {
    startIso,
    hasTime,
    day: d.iso,
    timeLocal: hasTime ? `${time![1].padStart(2, '0')}:${time![2]}` : null,
    title: subject.replace(/^((re|fwd?|i|invito|invitation|save the date)\s*:\s*)+/i, '').trim(),
  }
}

export type BusyLike = { start: string; end: string; title?: string }

/** Che cosa c'è già in agenda a quell'ora (due ore di evento, se l'orario c'è; tutto il giorno, se no). */
export function conflicts(inv: Invitation, busy: BusyLike[]): BusyLike[] {
  const start = Date.parse(inv.startIso)
  const [s, e] = inv.hasTime ? [start, start + 2 * 3_600_000] : [Date.parse(`${inv.day}T07:00:00Z`), Date.parse(`${inv.day}T17:00:00Z`)]
  return busy.filter((b) => Date.parse(b.start) < e && Date.parse(b.end) > s)
}

function itDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Il "no, grazie": formattato, non generato. */
export function declineText(inv: Invitation, senderName: string | null): string {
  const hello = senderName ? `Gentile ${senderName},` : 'Buongiorno,'
  return [
    hello,
    '',
    `grazie mille per l'invito a "${inv.title}" del ${itDay(inv.day)}${inv.timeLocal ? ` alle ${inv.timeLocal}` : ''}.`,
    'Purtroppo in quel momento sono già impegnato e non riuscirò a partecipare.',
    'Spero ci sia occasione per la prossima: tenetemi aggiornato.',
    '',
    'Un caro saluto,',
  ].join('\n')
}
