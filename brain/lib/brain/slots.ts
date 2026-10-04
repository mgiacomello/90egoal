/**
 * Gli spazi liberi in agenda. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * È la metà onesta della "GiorgiaAI" del post: non fissa niente e non
 * scrive a nessuno, ma la parte che costa tempo — guardare l'agenda,
 * trovare tre finestre decenti, scriverle in una mail — la fa, e la fa
 * con il calendario, non con un modello che l'agenda la immagina.
 *
 * Ora italiana senza Intl: UTC+2 da aprile a ottobre, UTC+1 altrimenti.
 * Grossolano ai bordi del cambio d'ora, e per proporre uno slot basta.
 */

export type Busy = { start: string; end: string }

export type Slot = {
  /** ISO UTC */
  start: string
  end: string
  /** "lunedì 6 ottobre, 10:00–11:00" */
  label: string
}

export type SlotOptions = {
  from: Date
  days?: number
  durationMin?: number
  bufferMin?: number
  /** Ore italiane. */
  workStart?: number
  workEnd?: number
  count?: number
  maxPerDay?: number
}

const DOW = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const MONTH = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

function offsetFor(month1to12: number): number {
  return month1to12 >= 4 && month1to12 <= 10 ? 2 : 1
}

/** Da un istante alle sue parti in ora italiana. */
export function romeParts(date: Date): { y: number; m: number; d: number; h: number; min: number; dow: number } {
  const probe = new Date(date.getTime() + offsetFor(date.getUTCMonth() + 1) * 3_600_000)
  return {
    y: probe.getUTCFullYear(),
    m: probe.getUTCMonth() + 1,
    d: probe.getUTCDate(),
    h: probe.getUTCHours(),
    min: probe.getUTCMinutes(),
    dow: probe.getUTCDay(),
  }
}

/** Da ora italiana a istante UTC. */
export function fromRome(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m - 1, d, h, min) - offsetFor(m) * 3_600_000)
}

/**
 * "2026-09-07T10:00:00+02:00 → 2026-09-07T11:00:00+02:00" oppure
 * "2026-09-07 → 2026-09-08" (giornata intera). Senza fine: un'ora.
 */
export function parseWhen(line: string): Busy | null {
  const m = line.match(/(\d{4}-\d{2}-\d{2}(?:T[\d:.+\-Z]+)?)\s*(?:→|->)?\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.+\-Z]+)?)?/)
  if (!m) return null
  const allDay = !m[1].includes('T')
  const start = new Date(allDay ? `${m[1]}T00:00:00Z` : m[1])
  if (Number.isNaN(start.getTime())) return null
  let end: Date
  if (m[2]) end = new Date(allDay ? `${m[2]}T00:00:00Z` : m[2])
  else end = new Date(start.getTime() + (allDay ? 86_400_000 : 3_600_000))
  if (Number.isNaN(end.getTime())) return null
  if (allDay) {
    // Una giornata intera in agenda: in ora italiana, non UTC.
    const s = new Date(`${m[1]}T00:00:00Z`)
    const e = new Date(`${(m[2] ?? m[1])}T00:00:00Z`)
    const sd = fromRome(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate(), 0, 0)
    const ed = m[2]
      ? fromRome(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate(), 0, 0)
      : new Date(sd.getTime() + 86_400_000)
    return { start: sd.toISOString(), end: ed.toISOString() }
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

function label(start: Date, end: Date): string {
  const s = romeParts(start)
  const e = romeParts(end)
  const hm = (p: { h: number; min: number }) => `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`
  return `${DOW[s.dow]} ${s.d} ${MONTH[s.m - 1]}, ${hm(s)}–${hm(e)}`
}

/** 10–12 e 15–17 sono le ore in cui una call non rovina la giornata. */
function preference(h: number): number {
  if (h >= 10 && h < 12) return 0
  if (h >= 15 && h < 17) return 1
  return 2
}

/**
 * Le finestre libere nei prossimi giorni lavorativi, con un margine
 * prima e dopo ogni impegno. Al massimo `maxPerDay` per giorno, perché
 * tre proposte lo stesso pomeriggio non sono tre proposte.
 */
export function freeSlots(busy: Busy[], options: SlotOptions): Slot[] {
  const {
    from, days = 10, durationMin = 60, bufferMin = 15,
    workStart = 9, workEnd = 18, count = 3, maxPerDay = 1,
  } = options

  const intervals = busy
    .map((b) => ({ s: Date.parse(b.start) - bufferMin * 60_000, e: Date.parse(b.end) + bufferMin * 60_000 }))
    .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e))

  const now = romeParts(from)
  const found: Slot[] = []

  for (let offset = 0; offset <= days && found.length < count * 3; offset += 1) {
    const dayStart = fromRome(now.y, now.m, now.d + offset, workStart, 0)
    const parts = romeParts(dayStart)
    if (parts.dow === 0 || parts.dow === 6) continue
    const dayEnd = fromRome(parts.y, parts.m, parts.d, workEnd, 0)

    const candidates: Slot[] = []
    for (let t = dayStart.getTime(); t + durationMin * 60_000 <= dayEnd.getTime(); t += 30 * 60_000) {
      // Mai nel passato, e mai nell'ora che sta per scoccare.
      if (t < from.getTime() + 60 * 60_000) continue
      const end = t + durationMin * 60_000
      const clash = intervals.some((b) => b.s < end && b.e > t)
      if (clash) continue
      candidates.push({ start: new Date(t).toISOString(), end: new Date(end).toISOString(), label: label(new Date(t), new Date(end)) })
    }
    candidates.sort((a, b) => {
      const pa = preference(romeParts(new Date(a.start)).h)
      const pb = preference(romeParts(new Date(b.start)).h)
      return pa - pb || a.start.localeCompare(b.start)
    })
    found.push(...candidates.slice(0, maxPerDay))
  }

  return found.slice(0, count)
}

/** La mail, formattata e non generata. */
export function proposalText(slots: Slot[], topic?: string): string | null {
  if (!slots.length) return null
  const lines = [
    'Ciao,',
    '',
    `per ${topic?.trim() || 'sentirci'} ti propongo ${slots.length === 1 ? 'questa finestra' : `${slots.length} alternative`} (ora italiana):`,
    '',
    ...slots.map((s) => `- ${s.label}`),
    '',
    'Se nessuna va bene, dimmi tu due o tre finestre e mi adatto.',
    '',
    'A presto,',
  ]
  return lines.join('\n')
}
