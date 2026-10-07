/**
 * I voli nelle mail. Funzione pura: niente rete, niente DOM, nessun
 * import di valori.
 *
 * Una conferma di prenotazione ha sempre le stesse quattro cose: chi
 * vola (la compagnia), il codice di prenotazione, il numero del volo,
 * e quando parte. Qui si tirano fuori con regole, e da lì si calcola
 * quando provare il check-in: dalla prima apertura possibile, e poi
 * di nuovo ogni qualche ora fino a poco prima della chiusura — così
 * non serve sapere al minuto la regola di ogni compagnia, che cambia.
 */

export type Airline = {
  key: string
  name: string
  /** I prefissi IATA dei voli. */
  codes: string[]
  /** I domini su cui il check-in si fa. */
  domains: string[]
  /** La prima apertura possibile, in ore prima della partenza. */
  opensHours: number
  /** La chiusura del check-in online, in ore prima della partenza. */
  closesHours: number
  /** Quanto costa dimenticarselo, in parole. */
  penalty: string | null
}

export const AIRLINES: Airline[] = [
  { key: 'ryanair', name: 'Ryanair', codes: ['FR', 'RK'], domains: ['ryanair.com'], opensHours: 48, closesHours: 2, penalty: 'il check-in in aeroporto si paga' },
  { key: 'easyjet', name: 'easyJet', codes: ['U2', 'EJU', 'EC'], domains: ['easyjet.com'], opensHours: 720, closesHours: 2, penalty: null },
  { key: 'wizz', name: 'Wizz Air', codes: ['W6', 'W4', 'W9'], domains: ['wizzair.com'], opensHours: 48, closesHours: 3, penalty: 'il check-in in aeroporto si paga' },
  { key: 'vueling', name: 'Vueling', codes: ['VY'], domains: ['vueling.com'], opensHours: 168, closesHours: 1, penalty: null },
  { key: 'ita', name: 'ITA Airways', codes: ['AZ'], domains: ['ita-airways.com'], opensHours: 24, closesHours: 1, penalty: null },
  { key: 'lufthansa', name: 'Lufthansa', codes: ['LH'], domains: ['lufthansa.com'], opensHours: 23, closesHours: 1, penalty: null },
  { key: 'britishairways', name: 'British Airways', codes: ['BA'], domains: ['britishairways.com'], opensHours: 24, closesHours: 1, penalty: null },
  { key: 'airfrance', name: 'Air France', codes: ['AF'], domains: ['airfrance.it', 'airfrance.com'], opensHours: 30, closesHours: 1, penalty: null },
  { key: 'klm', name: 'KLM', codes: ['KL'], domains: ['klm.it', 'klm.com'], opensHours: 30, closesHours: 1, penalty: null },
  { key: 'volotea', name: 'Volotea', codes: ['V7'], domains: ['volotea.com'], opensHours: 48, closesHours: 1, penalty: null },
]

export type Flight = {
  airline: Airline
  pnr: string
  flightNumber: string
  /** ISO in UTC, calcolato dall'ora locale scritta nella mail (ora italiana). */
  departureIso: string
  /** "2026-10-17 06:30" com'è scritto, per chi legge. */
  departureLocal: string
  from: string | null
  to: string | null
}

const MONTHS: Record<string, number> = {
  gen: 1, gennaio: 1, jan: 1, january: 1, feb: 2, febbraio: 2, february: 2, mar: 3, marzo: 3, march: 3,
  apr: 4, aprile: 4, april: 4, mag: 5, maggio: 5, may: 5, giu: 6, giugno: 6, jun: 6, june: 6,
  lug: 7, luglio: 7, jul: 7, july: 7, ago: 8, agosto: 8, aug: 8, august: 8, set: 9, sett: 9, settembre: 9, sep: 9, sept: 9, september: 9,
  ott: 10, ottobre: 10, oct: 10, october: 10, nov: 11, novembre: 11, november: 11, dic: 12, dicembre: 12, dec: 12, december: 12,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Ora italiana → UTC, con il cambio d'ora grossolano (aprile–ottobre +2). */
export function romeToUtc(y: number, m: number, d: number, h: number, min: number): string {
  const offset = m >= 4 && m <= 10 ? 2 : 1
  return new Date(Date.UTC(y, m - 1, d, h - offset, min)).toISOString()
}

const PNR_LABELS = /(?:codice\s+(?:di\s+)?prenotazione|prenotazione\s*(?:n\.?|nr\.?|numero)?|booking\s+(?:reference|ref\.?|number|code)|reservation\s+(?:number|code)|confirmation\s+(?:number|code)|pnr|codice\s+pnr)\s*[:#]?\s*([A-Z0-9]{6})\b/i

export function findPnr(text: string): string | null {
  for (const m of text.matchAll(new RegExp(PNR_LABELS.source, 'gi'))) {
    const raw = m[1]
    // Un PNR è scritto in maiuscolo: "Conferma prenotazione\nCodice" non
    // è un codice, è la parola dopo. E ha almeno una lettera: "123456"
    // è un numero d'ordine.
    if (raw !== raw.toUpperCase()) continue
    if (!/[A-Z]/.test(raw)) continue
    return raw
  }
  return null
}

export function findAirline(text: string, sender = ''): Airline | null {
  const t = `${sender} ${text}`.toLowerCase()
  for (const a of AIRLINES) {
    if (a.domains.some((d) => t.includes(d))) return a
  }
  for (const a of AIRLINES) {
    if (t.includes(a.name.toLowerCase())) return a
  }
  return null
}

export function findFlightNumbers(text: string, airline: Airline): string[] {
  const out: string[] = []
  const re = new RegExp(`\\b(${airline.codes.join('|')})\\s?(\\d{1,4})\\b`, 'g')
  for (const m of text.matchAll(re)) {
    const n = `${m[1]}${m[2]}`
    if (!out.includes(n)) out.push(n)
  }
  return out
}

type DateHit = { y: number; m: number; d: number; index: number }

function datesIn(text: string, refYear: number): DateHit[] {
  const out: DateHit[] = []
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
    out.push({ y, m: Number(m[2]), d: Number(m[1]), index: m.index ?? 0 })
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    out.push({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), index: m.index ?? 0 })
  }
  const re = /\b(\d{1,2})\s+([a-zà-ù]{3,9})\.?(?:\s+(\d{2,4}))?\b/gi
  for (const m of text.matchAll(re)) {
    const month = MONTHS[m[2].toLowerCase()]
    if (!month) continue
    const y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : refYear
    out.push({ y, m: month, d: Number(m[1]), index: m.index ?? 0 })
  }
  return out
    .filter((h) => h.m >= 1 && h.m <= 12 && h.d >= 1 && h.d <= 31 && h.y >= 2000)
    .sort((a, b) => a.index - b.index)
}

/**
 * Il volo di una conferma. La data di partenza è la prima data dopo il
 * numero del volo (o, se non c'è, la prima della mail) con un orario
 * entro poche righe; gli aeroporti sono la prima coppia di codici IATA.
 */
export function parseFlight(text: string, sender: string, refIso: string): Flight | null {
  const airline = findAirline(text, sender)
  if (!airline) return null
  const pnr = findPnr(text)
  if (!pnr) return null
  const numbers = findFlightNumbers(text, airline)
  if (!numbers.length) return null

  const flightAt = text.search(new RegExp(`\\b${numbers[0].slice(0, 2)}\\s?${numbers[0].slice(2)}\\b`))
  const refYear = Number(refIso.slice(0, 4)) || new Date().getUTCFullYear()
  const dates = datesIn(text, refYear)
  const date = dates.find((d) => d.index >= Math.max(0, flightAt - 200)) ?? dates[0]
  if (!date) return null

  const after = text.slice(date.index, date.index + 200)
  const time = after.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  if (!time) return null
  const h = Number(time[1])
  const min = Number(time[2])

  const iata = text.match(/\b([A-Z]{3})\s*(?:-|–|→|>|to|a)\s*([A-Z]{3})\b/)
  const departureIso = romeToUtc(date.y, date.m, date.d, h, min)
  if (Date.parse(departureIso) < Date.parse(refIso) - 86_400_000) return null

  return {
    airline,
    pnr,
    flightNumber: numbers[0],
    departureIso,
    departureLocal: `${date.y}-${pad(date.m)}-${pad(date.d)} ${pad(h)}:${pad(min)}`,
    from: iata?.[1] ?? null,
    to: iata?.[2] ?? null,
  }
}

export type CheckinPlan = {
  /** Il primo tentativo: l'apertura più presto possibile. */
  firstAttemptIso: string
  /** Dopo, si riprova ogni tanto, fino a qui. */
  lastAttemptIso: string
  retryEveryMinutes: number
}

export function checkinPlan(flight: Flight): CheckinPlan {
  const dep = Date.parse(flight.departureIso)
  return {
    firstAttemptIso: new Date(dep - flight.airline.opensHours * 3_600_000 + 5 * 60_000).toISOString(),
    lastAttemptIso: new Date(dep - (flight.airline.closesHours + 1) * 3_600_000).toISOString(),
    retryEveryMinutes: 180,
  }
}

/** Il prossimo tentativo dopo un fallimento, o null se è troppo tardi. */
export function nextAttempt(plan: CheckinPlan, now: Date): string | null {
  const next = now.getTime() + plan.retryEveryMinutes * 60_000
  return next <= Date.parse(plan.lastAttemptIso) ? new Date(next).toISOString() : null
}
