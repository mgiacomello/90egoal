/**
 * Gli addebiti ricorrenti. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * Un abbonamento è una cosa che si paga senza più deciderlo, ed è
 * esattamente per questo che va messo davanti agli occhi una volta
 * ogni tanto: quanto costa all'anno, se è aumentato, quando passa la
 * prossima volta. Sono numeri di un estratto conto, e si calcolano:
 * stessa controparte, stesso ordine di grandezza, stessa cadenza.
 */

export type ChargeLike = {
  id: string
  label: string
  /** Positivo, in centesimi. */
  amountCents: number
  /** ISO */
  occurredAt: string
}

export type Cadence = 'settimanale' | 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale'

export type Subscription = {
  key: string
  label: string
  cadence: Cadence
  /** L'importo tipico (mediana), in centesimi. */
  typicalCents: number
  lastCents: number
  lastAt: string
  /** Quando ci si aspetta il prossimo addebito. */
  nextAt: string
  count: number
  /** Quanto costa in un anno a questa cadenza. */
  yearlyCents: number
  /** L'ultimo addebito supera la mediana di più del 10%. */
  increased: boolean
  /** L'ultimo addebito è in ritardo rispetto alla cadenza: forse è finito. */
  overdue: boolean
  documentIds: string[]
}

const STOP = new Set(['srl', 'spa', 'sas', 'snc', 'ltd', 'llc', 'inc', 'gmbh', 'sarl', 'the', 'and', 'com', 'www', 'pagamento', 'addebito', 'carta', 'card', 'sepa', 'payment', 'prelievo', 'bonifico'])

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "AMZN Mktp IT*2K3J4 Amazon.it" e "Amazon.it *1Z9" sono la stessa controparte. */
export function chargeKey(label: string): string {
  const tokens = fold(label)
    // "*2K3J4" è un codice di transazione, "*Workspace" è un nome.
    .replace(/\*[a-z0-9]*\d[a-z0-9]*/g, ' ')
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
  return [...new Set(tokens)].sort().slice(0, 2).join(' ')
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(b) - Date.parse(a)) / 86_400_000
}

const CADENCES: { name: Cadence; days: number; min: number; max: number }[] = [
  { name: 'settimanale', days: 7, min: 5, max: 9 },
  { name: 'mensile', days: 30, min: 25, max: 36 },
  { name: 'bimestrale', days: 61, min: 55, max: 67 },
  { name: 'trimestrale', days: 91, min: 83, max: 100 },
  { name: 'semestrale', days: 182, min: 170, max: 195 },
  { name: 'annuale', days: 365, min: 340, max: 390 },
]

export function cadenceOf(medianDays: number): Cadence | null {
  return CADENCES.find((c) => medianDays >= c.min && medianDays <= c.max)?.name ?? null
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + Math.round(n))
  return d.toISOString().slice(0, 10)
}

/**
 * Gli abbonamenti fra gli addebiti: almeno tre addebiti alla stessa
 * controparte, con intervalli che tengono una cadenza riconoscibile.
 * Gli importi possono variare (un canone a consumo resta un canone);
 * conta la regolarità nel tempo.
 */
export function findSubscriptions(charges: ChargeLike[], now = new Date()): Subscription[] {
  const groups = new Map<string, ChargeLike[]>()
  for (const c of charges) {
    if (c.amountCents <= 0) continue
    const key = chargeKey(c.label)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }

  const out: Subscription[] = []
  for (const [key, list] of groups) {
    if (list.length < 3) continue
    const sorted = [...list].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    // Due addebiti lo stesso giorno sono un addebito doppio, non una cadenza.
    const days = sorted.map((c) => c.occurredAt.slice(0, 10))
    const unique = sorted.filter((c, i) => i === 0 || c.occurredAt.slice(0, 10) !== days[i - 1])
    if (unique.length < 3) continue

    const gaps = unique.slice(1).map((c, i) => daysBetween(unique[i].occurredAt, c.occurredAt))
    const gap = median(gaps)
    const cadence = cadenceOf(gap)
    if (!cadence) continue
    // Almeno due terzi degli intervalli devono stare nella cadenza: una
    // controparte con tre pagamenti sparsi non è un abbonamento.
    const expected = CADENCES.find((c) => c.name === cadence)!
    const regular = gaps.filter((g) => g >= expected.min && g <= expected.max).length
    if (regular < Math.ceil((gaps.length * 2) / 3)) continue

    const typical = median(unique.map((c) => c.amountCents))
    const last = unique[unique.length - 1]
    const nextAt = addDays(last.occurredAt, expected.days)
    const sinceLast = daysBetween(last.occurredAt, now.toISOString())

    out.push({
      key,
      label: last.label,
      cadence,
      typicalCents: typical,
      lastCents: last.amountCents,
      lastAt: last.occurredAt.slice(0, 10),
      nextAt,
      count: unique.length,
      yearlyCents: Math.round((typical * 365) / expected.days),
      increased: last.amountCents > typical * 1.1,
      overdue: sinceLast > expected.max + 7,
      documentIds: unique.map((c) => c.id),
    })
  }

  return out.sort((a, b) => b.yearlyCents - a.yearlyCents)
}

export function yearlyTotal(subs: Subscription[]): number {
  return subs.filter((s) => !s.overdue).reduce((sum, s) => sum + s.yearlyCents, 0)
}
