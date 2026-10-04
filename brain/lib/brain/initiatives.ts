/**
 * Le iniziative. Funzione pura: niente rete, niente DOM, nessun import
 * di valori.
 *
 * Un collaboratore vero non aspetta che tu apra una pagina: si fa vivo
 * quando succede qualcosa che riguarda il suo mandato, e poi sta zitto.
 * Qui c'è la parte che decide **se e quando** farsi vivi, e sono regole,
 * non giudizio:
 *
 *   - una cosa si dice una volta sola (la chiave di ogni iniziativa è
 *     stabile, e quelle già mandate non tornano);
 *   - c'è un budget al giorno, per dirigente e in totale: cinque
 *     persone che ti scrivono dieci volte al giorno sono rumore, e il
 *     rumore si smette di leggere;
 *   - di notte si tace, salvo le cose che non possono aspettare — un
 *     incontro fra due ore, una scadenza oggi.
 */

export type InitiativeKind =
  | 'meeting' // un incontro fra poco
  | 'deadline' // una scadenza oggi o domani
  | 'waiting' // qualcuno aspetta una risposta da giorni
  | 'charge' // un addebito senza giustificativo
  | 'subscription' // un abbonamento aumentato o finito
  | 'cooling' // una relazione che si raffredda
  | 'signal' // un segnale di mercato
  | 'launch' // un prodotto nuovo
  | 'readiness' // una giornata da prendere piano

export type Initiative = {
  /** Stabile: la stessa cosa ha sempre la stessa chiave. */
  key: string
  executive: string
  kind: InitiativeKind
  /** Il messaggio, già scritto per il telefono. */
  text: string
  /** Non aspetta la fine delle ore di silenzio. */
  urgent: boolean
  /** Per ordinare: più alto, prima. */
  weight: number
}

export type PickOptions = {
  now: Date
  /** Le chiavi già mandate, nel periodo che conta. */
  sent: Set<string>
  perExecutive?: number
  total?: number
  /** Ore italiane: da (incluso) a (escluso). */
  quietFrom?: number
  quietTo?: number
}

function romeHour(date: Date): number {
  const month = date.getUTCMonth() + 1
  const offset = month >= 4 && month <= 10 ? 2 : 1
  return (date.getUTCHours() + offset) % 24
}

export function isQuietHour(now: Date, from = 21, to = 8): boolean {
  const h = romeHour(now)
  return from > to ? h >= from || h < to : h >= from && h < to
}

/**
 * Quali iniziative mandare adesso. Dedup, silenzio notturno, budget per
 * dirigente e totale, ordine per peso.
 */
export function pickInitiatives(candidates: Initiative[], options: PickOptions): Initiative[] {
  const { now, sent, perExecutive = 2, total = 6, quietFrom = 21, quietTo = 8 } = options
  const quiet = isQuietHour(now, quietFrom, quietTo)
  const perExec = new Map<string, number>()
  const out: Initiative[] = []

  const fresh = candidates
    .filter((c) => !sent.has(c.key))
    .filter((c) => !quiet || c.urgent)
    .sort((a, b) => b.weight - a.weight)

  const seen = new Set<string>()
  for (const c of fresh) {
    if (seen.has(c.key)) continue
    if (out.length >= total) break
    const n = perExec.get(c.executive) ?? 0
    if (n >= perExecutive) continue
    perExec.set(c.executive, n + 1)
    seen.add(c.key)
    out.push(c)
  }
  return out
}

/** "2026-10-04" per le chiavi che valgono un giorno, "2026-W40" per quelle che valgono una settimana. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** "fra 1 h 40", "fra 25 min". */
export function inHowLong(startIso: string, now: Date): string {
  const minutes = Math.round((Date.parse(startIso) - now.getTime()) / 60_000)
  if (minutes < 60) return `fra ${Math.max(1, minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `fra ${h} h ${String(m).padStart(2, '0')}` : `fra ${h} h`
}
