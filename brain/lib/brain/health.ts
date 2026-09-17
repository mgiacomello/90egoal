/**
 * La salute, in numeri. Funzione pura: niente rete, niente DOM.
 *
 * Vale qui la stessa scelta fatta per l'amministrazione, e per la
 * stessa ragione: **una media è una media, una tendenza è una pendenza,
 * e nessuna delle due si delega a un modello.** Un punteggio di sonno
 * letto male non fa danni come un IBAN, ma un "stai dormendo meglio"
 * detto quando la curva scende è esattamente il tipo di frase che fa
 * smettere di fidarsi di un coach.
 *
 * Quindi il modello, quando arriva, riceve i numeri già fatti — medie,
 * direzione, giorni peggiori — e il suo lavoro è dire *cosa farci*, non
 * *quanto fanno*. E lo dice citando le fonti, come tutto il resto.
 *
 * Una cosa che va detta prima di ogni altra: **niente di questo è un
 * parere medico.** Sono numeri di un anello e correlazioni con
 * un'agenda. Il file lo sa, il prompt lo sa, l'interfaccia lo dice.
 */

export type HealthDay = {
  /** ISO, solo la data: "2026-09-14". */
  day: string
  sleep: number | null
  readiness: number | null
  activity: number | null
}

export type Metric = 'sleep' | 'readiness' | 'activity'

export const METRIC_LABEL: Record<Metric, string> = {
  sleep: 'sonno',
  readiness: 'prontezza',
  activity: 'attività',
}

export type Trend = 'in miglioramento' | 'stabile' | 'in peggioramento'

/** La media dei valori presenti. Un giorno senza dato non è uno zero. */
export function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!present.length) return null
  return Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 10) / 10
}

/**
 * La direzione di una serie: pendenza dei minimi quadrati sui giorni
 * presenti, letta come variazione totale sull'intervallo.
 *
 * Sotto i quattro punti si dice "stabile" e basta: con tre giorni una
 * retta passa dove vuoi, e una tendenza che non regge a un giorno in
 * più non è una tendenza. Sopra, servono almeno tre punti di
 * differenza fra inizio e fine per parlare di movimento — un punteggio
 * Oura oscilla di due o tre da solo.
 */
export function trend(days: HealthDay[], metric: Metric): Trend {
  const points = days
    .map((d, i) => ({ x: i, y: d[metric] }))
    .filter((p): p is { x: number; y: number } => typeof p.y === 'number')

  if (points.length < 4) return 'stabile'

  const n = points.length
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  const cov = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0)
  const varX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0)
  if (varX === 0) return 'stabile'

  const slope = cov / varX
  const span = slope * (points[n - 1].x - points[0].x)

  if (span >= 3) return 'in miglioramento'
  if (span <= -3) return 'in peggioramento'
  return 'stabile'
}

/** I giorni peggiori per una metrica: sono quelli su cui si può imparare. */
export function worstDays(days: HealthDay[], metric: Metric, n = 3): HealthDay[] {
  return days
    .filter((d) => typeof d[metric] === 'number')
    .sort((a, b) => (a[metric] as number) - (b[metric] as number))
    .slice(0, n)
}

export type MetricSummary = {
  metric: Metric
  label: string
  average: number | null
  /** Media dei primi giorni della finestra, per il confronto. */
  earlier: number | null
  /** Media degli ultimi sette. */
  recent: number | null
  trend: Trend
  worst: HealthDay[]
  /** Quanti giorni avevano il dato. */
  samples: number
}

export type HealthSummary = {
  from: string | null
  to: string | null
  days: number
  metrics: MetricSummary[]
}

export function summarize(days: HealthDay[]): HealthSummary {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const recent = sorted.slice(-7)
  const earlier = sorted.slice(0, Math.max(0, sorted.length - 7))

  const metrics = (['sleep', 'readiness', 'activity'] as Metric[]).map((metric) => ({
    metric,
    label: METRIC_LABEL[metric],
    average: average(sorted.map((d) => d[metric])),
    earlier: average(earlier.map((d) => d[metric])),
    recent: average(recent.map((d) => d[metric])),
    trend: trend(sorted, metric),
    worst: worstDays(sorted, metric),
    samples: sorted.filter((d) => typeof d[metric] === 'number').length,
  }))

  return {
    from: sorted[0]?.day ?? null,
    to: sorted[sorted.length - 1]?.day ?? null,
    days: sorted.length,
    metrics,
  }
}

/* ------------------------------------------------------------------ *
 * Il calendario come spiegazione
 * ------------------------------------------------------------------ */

export type CalendarDay = {
  /** ISO, solo la data. */
  day: string
  /** Titoli degli eventi di quel giorno. */
  events: string[]
  /** L'ultimo evento del giorno finiva tardi. */
  lateEnd: boolean
}

export type Correlation = {
  /** Il giorno con la prontezza bassa. */
  day: string
  readiness: number
  /** Cosa c'era il giorno prima. */
  before: CalendarDay | null
}

/**
 * Cosa c'era in agenda il giorno prima di ogni giornata di prontezza
 * bassa.
 *
 * Non è statistica — con tre settimane di dati non lo sarebbe niente —
 * è il gesto che fa un coach umano guardando due fogli affiancati:
 * "i tuoi tre giorni peggiori vengono tutti dopo una cena di lavoro".
 * Il pattern lo si mette davanti agli occhi; a decidere se è un
 * pattern è chi lo legge.
 */
export function explainWorst(
  days: HealthDay[],
  calendar: CalendarDay[],
  n = 3
): Correlation[] {
  const byDay = new Map(calendar.map((c) => [c.day, c]))
  return worstDays(days, 'readiness', n).map((d) => {
    const prev = previousDay(d.day)
    return {
      day: d.day,
      readiness: d.readiness as number,
      before: byDay.get(prev) ?? null,
    }
  })
}

export function previousDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Da un istante a "2026-09-14", sempre in UTC come i giorni Oura. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

/** Ora di Roma senza Intl: UTC+2 d'estate, UTC+1 d'inverno, decisi dal mese.
 *  Grossolano ma deterministico, e per "sera" o "tardi" basta e avanza. */
function romeHour(iso: string): number | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const month = d.getUTCMonth() + 1
  const offset = month >= 4 && month <= 10 ? 2 : 1
  return (d.getUTCHours() + offset) % 24
}

/** Un evento che finisce dopo le 21 in ora italiana è "tardi". */
export function isLate(isoEnd: string): boolean {
  const h = romeHour(isoEnd)
  return h !== null && (h >= 21 || h < 4)
}

/** Un evento che comincia dalle 19 in poi è "di sera": cene, aperitivi, eventi. */
export function isEvening(isoStart: string): boolean {
  const h = romeHour(isoStart)
  return h !== null && (h >= 19 || h < 4)
}
