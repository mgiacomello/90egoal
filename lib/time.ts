// Orari di gioco: si ragiona sempre nell'ora di Roma, si salva sempre in UTC.
// Funzioni pure, senza dipendenze: testate in scripts/game.test.ts.

const ROME = 'Europe/Rome'

// Scarto (in minuti) fra l'ora di Roma e UTC in un dato istante: +60 d'inverno, +120 d'estate.
export function romeOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ROME,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const n = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  return Math.round((asUtc - at.getTime()) / 60000)
}

// "2026-10-17" + "14:30" (ora di Roma) → istante UTC in ISO.
export function romeToUtcIso(date: string, time = '00:00'): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  // Due passaggi: il primo stima lo scarto, il secondo lo corregge a cavallo del cambio d'ora.
  let ts = guess - romeOffsetMinutes(new Date(guess)) * 60000
  ts = guess - romeOffsetMinutes(new Date(ts)) * 60000
  return new Date(ts).toISOString()
}

// Istante ISO → { date: "2026-10-17", time: "14:30" } nell'ora di Roma.
export function utcToRome(iso: string): { date: string; time: string } {
  const at = new Date(iso)
  const local = new Date(at.getTime() + romeOffsetMinutes(at) * 60000)
  const s = local.toISOString()
  return { date: s.slice(0, 10), time: s.slice(11, 16) }
}

// Il primo calcio d'inizio fra le partite che hanno data e ora: è la scadenza naturale della schedina.
export function firstKickoffIso(partite: { date: string; ora?: string | null }[]): string | null {
  const times = partite
    .filter(p => p.date && p.ora && /^\d{1,2}:\d{2}$/.test(p.ora))
    .map(p => romeToUtcIso(p.date, p.ora as string))
    .sort()
  return times[0] ?? null
}
