/**
 * L'allenamento, in numeri. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * "Sto facendo sport bene?" ha una risposta che non è un parere: con
 * che frequenza, con che mix di intensità, con quanti giorni di fila,
 * e cosa dicono prontezza, frequenza a riposo e HRV nei giorni dopo.
 * Sono tutti numeri dell'anello messi in fila, e si calcolano. Il
 * modello, dopo, dice cosa farci.
 *
 * Le soglie sono quelle di buon senso di chi allena amatori: tre sedute
 * a settimana, non più di quattro giorni di fila, la parte dura fra il
 * dieci e il trentacinque per cento, prontezza che non crolla il
 * giorno dopo. Non sono un parere medico, e il file lo dice.
 */

export type Intensity = 'easy' | 'moderate' | 'hard'

export type Workout = {
  day: string
  activity: string
  intensity: Intensity | null
  minutes: number
  calories: number | null
}

export type TrainingDay = {
  /** "2026-10-04" */
  day: string
  workouts: Workout[]
  steps: number | null
  /** Minuti di attività alta e media, secondo l'anello. */
  highMin: number | null
  mediumMin: number | null
  readiness: number | null
  sleep: number | null
  hrv: number | null
  restingHr: number | null
}

export type WeekLoad = {
  /** Il lunedì della settimana. */
  week: string
  sessions: number
  minutes: number
  hard: number
  /** I giorni con almeno una seduta. */
  days: string[]
}

export type Trend = 'in miglioramento' | 'stabile' | 'in peggioramento'

export type TrainingSummary = {
  from: string | null
  to: string | null
  days: number
  sessions: number
  minutes: number
  weeks: WeekLoad[]
  /** Sedute medie a settimana sulle settimane complete. */
  perWeek: number
  mix: { easy: number; moderate: number; hard: number; total: number }
  longestStreak: number
  /** Prontezza media il giorno dopo una seduta dura, contro gli altri giorni. */
  recovery: { afterHard: number | null; baseline: number | null; delta: number | null }
  /** Sonno medio la notte dopo una seduta, contro le altre. */
  sleepAfter: { afterTraining: number | null; otherNights: number | null; delta: number | null }
  hrvTrend: Trend
  restingHrTrend: Trend
  verdict: { ok: boolean; good: string[]; warnings: string[] }
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Il lunedì della settimana di un giorno. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7
  return addDays(day, -dow)
}

function avg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (!v.length) return null
  return Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10
}

function slopeTrend(values: (number | null)[], threshold: number): Trend {
  const pts = values.map((y, x) => ({ x, y })).filter((p): p is { x: number; y: number } => typeof p.y === 'number')
  if (pts.length < 4) return 'stabile'
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  const cov = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const vx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  if (!vx) return 'stabile'
  const span = (cov / vx) * (pts[n - 1].x - pts[0].x)
  if (span >= threshold) return 'in miglioramento'
  if (span <= -threshold) return 'in peggioramento'
  return 'stabile'
}

/** Una seduta "dura": dichiarata tale, oppure moderata e lunga. */
export function isHard(w: Workout): boolean {
  return w.intensity === 'hard' || (w.intensity === 'moderate' && w.minutes >= 60)
}

export function weeklyLoad(days: TrainingDay[]): WeekLoad[] {
  const byWeek = new Map<string, WeekLoad>()
  for (const d of [...days].sort((a, b) => a.day.localeCompare(b.day))) {
    const week = weekOf(d.day)
    const w = byWeek.get(week) ?? { week, sessions: 0, minutes: 0, hard: 0, days: [] }
    if (d.workouts.length) w.days.push(d.day)
    for (const s of d.workouts) {
      w.sessions += 1
      w.minutes += s.minutes
      if (isHard(s)) w.hard += 1
    }
    byWeek.set(week, w)
  }
  return [...byWeek.values()]
}

export function intensityMix(days: TrainingDay[]): TrainingSummary['mix'] {
  const mix = { easy: 0, moderate: 0, hard: 0, total: 0 }
  for (const d of days) {
    for (const w of d.workouts) {
      mix.total += 1
      if (isHard(w)) mix.hard += 1
      else if (w.intensity === 'moderate') mix.moderate += 1
      else mix.easy += 1
    }
  }
  return mix
}

/** Il numero massimo di giorni consecutivi con una seduta. */
export function longestStreak(days: TrainingDay[]): number {
  const trained = new Set(days.filter((d) => d.workouts.length).map((d) => d.day))
  let best = 0
  for (const day of trained) {
    if (trained.has(addDays(day, -1))) continue
    let n = 1
    while (trained.has(addDays(day, n))) n += 1
    best = Math.max(best, n)
  }
  return best
}

export function summarize(days: TrainingDay[], today: string): TrainingSummary {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const byDay = new Map(sorted.map((d) => [d.day, d]))
  const weeks = weeklyLoad(sorted)
  // Le settimane complete: non quella in corso.
  const thisWeek = weekOf(today)
  const complete = weeks.filter((w) => w.week < thisWeek)
  const perWeek = complete.length ? Math.round((complete.reduce((s, w) => s + w.sessions, 0) / complete.length) * 10) / 10 : 0

  const hardDays = new Set(sorted.filter((d) => d.workouts.some(isHard)).map((d) => d.day))
  const afterHard = sorted.filter((d) => hardDays.has(addDays(d.day, -1))).map((d) => d.readiness)
  const others = sorted.filter((d) => !hardDays.has(addDays(d.day, -1))).map((d) => d.readiness)
  const recovery = { afterHard: avg(afterHard), baseline: avg(others), delta: null as number | null }
  if (recovery.afterHard !== null && recovery.baseline !== null) recovery.delta = Math.round((recovery.afterHard - recovery.baseline) * 10) / 10

  // Il sonno "della notte dopo" sta nel documento del giorno dopo.
  const trainedDays = new Set(sorted.filter((d) => d.workouts.length).map((d) => d.day))
  const after = sorted.filter((d) => trainedDays.has(addDays(d.day, -1))).map((d) => d.sleep)
  const rest = sorted.filter((d) => !trainedDays.has(addDays(d.day, -1))).map((d) => d.sleep)
  const sleepAfter = { afterTraining: avg(after), otherNights: avg(rest), delta: null as number | null }
  if (sleepAfter.afterTraining !== null && sleepAfter.otherNights !== null) sleepAfter.delta = Math.round((sleepAfter.afterTraining - sleepAfter.otherNights) * 10) / 10

  const hrvTrend = slopeTrend(sorted.map((d) => d.hrv), 5)
  // Per la frequenza a riposo, salire è peggiorare.
  const rhrRaw = slopeTrend(sorted.map((d) => d.restingHr), 3)
  const restingHrTrend: Trend = rhrRaw === 'in miglioramento' ? 'in peggioramento' : rhrRaw === 'in peggioramento' ? 'in miglioramento' : 'stabile'

  const mix = intensityMix(sorted)
  const streak = longestStreak(sorted)
  const sessions = mix.total
  const minutes = sorted.reduce((s, d) => s + d.workouts.reduce((t, w) => t + w.minutes, 0), 0)

  const good: string[] = []
  const warnings: string[] = []
  if (complete.length) {
    if (perWeek >= 3) good.push(`${perWeek} sedute a settimana: la frequenza c'è`)
    else if (perWeek >= 2) warnings.push(`${perWeek} sedute a settimana: una in più farebbe la differenza`)
    else warnings.push(`${perWeek} sedute a settimana: troppo poche perché il corpo si adatti`)
  }
  if (sessions >= 4) {
    const hardShare = mix.hard / sessions
    if (hardShare > 0.35) warnings.push(`${Math.round(hardShare * 100)}% di sedute dure: troppe, il resto deve essere facile`)
    else if (hardShare < 0.1) warnings.push('quasi nessuna seduta dura: manca lo stimolo')
    else good.push(`${Math.round(hardShare * 100)}% di sedute dure, il resto facile: il mix è giusto`)
  }
  if (streak >= 5) warnings.push(`${streak} giorni di fila senza riposo`)
  else if (streak >= 1 && sessions >= 3) good.push('i giorni di riposo ci sono')
  if (recovery.delta !== null) {
    if (recovery.delta <= -10) warnings.push(`prontezza a ${recovery.afterHard} il giorno dopo le sedute dure contro ${recovery.baseline}: il recupero non basta`)
    else good.push(`prontezza che regge il giorno dopo le sedute dure (${recovery.afterHard} contro ${recovery.baseline})`)
  }
  if (restingHrTrend === 'in peggioramento' && hrvTrend === 'in peggioramento') {
    warnings.push('frequenza a riposo in salita e HRV in discesa insieme: segnale di carico accumulato')
  } else if (hrvTrend === 'in miglioramento') {
    good.push('HRV in miglioramento')
  }
  if (sleepAfter.delta !== null && sleepAfter.delta <= -8) warnings.push(`dormi peggio le notti dopo l'allenamento (${sleepAfter.afterTraining} contro ${sleepAfter.otherNights})`)

  return {
    from: sorted[0]?.day ?? null,
    to: sorted[sorted.length - 1]?.day ?? null,
    days: sorted.length,
    sessions,
    minutes,
    weeks,
    perWeek,
    mix,
    longestStreak: streak,
    recovery,
    sleepAfter,
    hrvTrend,
    restingHrTrend,
    verdict: { ok: warnings.length === 0 && sessions > 0, good, warnings },
  }
  void byDay
}
