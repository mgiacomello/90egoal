import type { BrainDocument } from '../types'
import { BrainError } from '../errors'
import { clip, type Connector, type SyncWindow } from './types'

/**
 * Oura, l'anello.
 *
 * Scelto al posto dello smartwatch per una ragione pratica, non estetica:
 * Oura ha un'API pubblica vera (token personale, Bearer, REST), mentre
 * i dati di Apple Watch non escono dal telefono senza un'app nativa.
 * Un connettore che si accende in due minuti batte un connettore che
 * richiede un'app da pubblicare sullo Store.
 *
 * Un documento al giorno, non uno per misura: la domanda che si fa a
 * un coach è "come ho dormito questa settimana", non "qual era il mio
 * HRV alle 4:12".
 */

const API = 'https://api.ouraring.com/v2/usercollection'

type DailyRow = {
  id?: string
  day?: string
  score?: number
  timestamp?: string
  contributors?: Record<string, number | null>
  total_sleep_duration?: number
  average_hrv?: number
  average_heart_rate?: number
  lowest_heart_rate?: number
  temperature_deviation?: number
  steps?: number
  active_calories?: number
  total_calories?: number
  high_activity_time?: number
  medium_activity_time?: number
}

type SleepPeriod = {
  id?: string
  day?: string
  type?: string
  average_hrv?: number | null
  lowest_heart_rate?: number | null
  total_sleep_duration?: number
}

type WorkoutRow = {
  id?: string
  day?: string
  activity?: string
  intensity?: 'easy' | 'moderate' | 'hard'
  calories?: number | null
  distance?: number | null
  label?: string | null
  start_datetime?: string
  end_datetime?: string
}

const ACTIVITY_LABEL: Record<string, string> = {
  running: 'corsa', walking: 'camminata', cycling: 'bici', swimming: 'nuoto', strength_training: 'pesi',
  yoga: 'yoga', pilates: 'pilates', hiit: 'HIIT', rowing: 'canottaggio', hiking: 'escursione', tennis: 'tennis',
  padel: 'padel', football: 'calcio', soccer: 'calcio', basketball: 'basket', skiing: 'sci', elliptical: 'ellittica',
  crossfit: 'crossfit', boxing: 'boxe', martial_arts: 'arti marziali', climbing: 'arrampicata', golf: 'golf',
}

const INTENSITY_LABEL: Record<string, string> = { easy: 'facile', moderate: 'moderata', hard: 'dura' }

function minutesBetween(start?: string, end?: string): number {
  const a = Date.parse(start ?? '')
  const b = Date.parse(end ?? '')
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return Math.round((b - a) / 60_000)
}

function token(): string {
  const value = process.env.OURA_TOKEN
  if (!value) {
    throw new BrainError(
      'Oura non configurato: serve OURA_TOKEN (token personale da cloud.ouraring.com/personal-access-tokens).',
      503
    )
  }
  return value
}

async function ouraJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new BrainError(`Oura ha risposto ${res.status}: ${detail.slice(0, 300)}`, 502)
  }
  return (await res.json()) as T
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Da secondi a "7h 45m": un punteggio si legge, 27.900 secondi no. */
function duration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** I "contributors" di Oura sono in inglese: qui diventano leggibili. */
const CONTRIBUTOR_LABEL: Record<string, string> = {
  deep_sleep: 'sonno profondo',
  efficiency: 'efficienza',
  latency: 'latenza',
  rem_sleep: 'sonno REM',
  restfulness: 'continuità',
  timing: 'orario',
  total_sleep: 'durata totale',
  activity_balance: 'equilibrio attività',
  body_temperature: 'temperatura corporea',
  hrv_balance: 'equilibrio HRV',
  previous_day_activity: 'attività del giorno prima',
  previous_night: 'notte precedente',
  recovery_index: 'indice di recupero',
  resting_heart_rate: 'frequenza a riposo',
  sleep_balance: 'equilibrio sonno',
  meet_daily_targets: 'obiettivi giornalieri',
  move_every_hour: 'movimento ogni ora',
  training_frequency: 'frequenza allenamenti',
  training_volume: 'volume allenamenti',
  stay_active: 'tempo attivo',
}

function contributors(row: DailyRow | undefined): string {
  if (!row?.contributors) return ''
  const parts = Object.entries(row.contributors)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${CONTRIBUTOR_LABEL[k] ?? k} ${v}`)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function byDay(rows: DailyRow[]): Map<string, DailyRow> {
  const out = new Map<string, DailyRow>()
  for (const row of rows) if (row.day) out.set(row.day, row)
  return out
}

export const ouraConnector: Connector = {
  key: 'oura',
  label: 'Oura',
  hint: 'Token personale (OURA_TOKEN). Sonno, prontezza e attività: un documento al giorno.',
  configured: () => Boolean(process.env.OURA_TOKEN),

  async connected() {
    if (!this.configured()) return false
    try {
      await ouraJson('/personal_info')
      return true
    } catch {
      return false
    }
  },

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    // Oura ragiona per giornate, non per istanti: la finestra va in date.
    const maxDays = Math.min(limit, 180)
    const start = new Date(Math.max(since.getTime(), Date.now() - maxDays * 86_400_000))
    const params = `?start_date=${isoDay(start)}&end_date=${isoDay(new Date())}`

    const [sleep, readiness, activity, periods, workouts] = await Promise.all([
      ouraJson<{ data?: DailyRow[] }>(`/daily_sleep${params}`),
      ouraJson<{ data?: DailyRow[] }>(`/daily_readiness${params}`),
      ouraJson<{ data?: DailyRow[] }>(`/daily_activity${params}`),
      // HRV e frequenza a riposo stanno nei periodi di sonno, non nel punteggio.
      ouraJson<{ data?: SleepPeriod[] }>(`/sleep${params}`).catch(() => ({ data: [] as SleepPeriod[] })),
      ouraJson<{ data?: WorkoutRow[] }>(`/workout${params}`).catch(() => ({ data: [] as WorkoutRow[] })),
    ])

    const sleepByDay = byDay(sleep.data ?? [])
    const readinessByDay = byDay(readiness.data ?? [])
    const activityByDay = byDay(activity.data ?? [])

    // Il periodo di sonno principale di ogni giorno: il più lungo.
    const periodByDay = new Map<string, SleepPeriod>()
    for (const p of periods.data ?? []) {
      if (!p.day) continue
      const current = periodByDay.get(p.day)
      if (!current || (p.total_sleep_duration ?? 0) > (current.total_sleep_duration ?? 0)) periodByDay.set(p.day, p)
    }
    const workoutsByDay = new Map<string, WorkoutRow[]>()
    for (const w of workouts.data ?? []) {
      if (!w.day) continue
      workoutsByDay.set(w.day, [...(workoutsByDay.get(w.day) ?? []), w])
    }

    const days = [...new Set([...sleepByDay.keys(), ...readinessByDay.keys(), ...activityByDay.keys()])].sort()

    const dayDocs = days.map((day) => {
      const s = sleepByDay.get(day)
      const r = readinessByDay.get(day)
      const a = activityByDay.get(day)
      const p = periodByDay.get(day)
      const ws = (workoutsByDay.get(day) ?? []).map((w) => ({
        activity: ACTIVITY_LABEL[w.activity ?? ''] ?? (w.activity ?? 'attività'),
        intensity: w.intensity ?? null,
        minutes: minutesBetween(w.start_datetime, w.end_datetime),
        calories: typeof w.calories === 'number' ? Math.round(w.calories) : null,
        start: w.start_datetime ?? null,
      }))

      const lines = [
        s?.score != null ? `Sonno: ${s.score}/100${contributors(s)}` : 'Sonno: nessun dato',
        duration(s?.total_sleep_duration) ? `Durata del sonno: ${duration(s?.total_sleep_duration)}` : '',
        r?.score != null ? `Prontezza: ${r.score}/100${contributors(r)}` : '',
        r?.temperature_deviation != null
          ? `Scostamento temperatura: ${r.temperature_deviation > 0 ? '+' : ''}${r.temperature_deviation.toFixed(2)} °C`
          : '',
        a?.score != null ? `Attività: ${a.score}/100${contributors(a)}` : '',
        a?.steps != null ? `Passi: ${a.steps.toLocaleString('it-IT')}` : '',
        a?.active_calories != null ? `Calorie attive: ${a.active_calories}` : '',
        a?.high_activity_time != null || a?.medium_activity_time != null
          ? `Attività alta: ${Math.round((a?.high_activity_time ?? 0) / 60)} min, media: ${Math.round((a?.medium_activity_time ?? 0) / 60)} min`
          : '',
        p?.average_hrv != null ? `HRV media notturna: ${Math.round(p.average_hrv)} ms` : '',
        p?.lowest_heart_rate != null ? `Frequenza a riposo: ${p.lowest_heart_rate} bpm` : '',
        ...ws.map(
          (w) =>
            `Allenamento: ${w.activity}${w.intensity ? `, ${INTENSITY_LABEL[w.intensity]}` : ''}${w.minutes ? `, ${w.minutes} min` : ''}${w.calories ? `, ${w.calories} kcal` : ''}`
        ),
      ].filter(Boolean)

      const summary = [
        s?.score != null ? `sonno ${s.score}` : null,
        r?.score != null ? `prontezza ${r.score}` : null,
        a?.score != null ? `attività ${a.score}` : null,
      ]
        .filter(Boolean)
        .join(', ')

      return {
        source: 'oura',
        kind: 'health',
        externalId: `day:${day}`,
        title: `Oura ${day}${summary ? ` — ${summary}` : ''}`,
        body: clip(lines.join('\n')),
        // Mezzogiorno UTC: così la data del documento resta quella giusta
        // qualunque sia il fuso di chi legge.
        occurredAt: `${day}T12:00:00.000Z`,
        url: null,
        participants: [],
        metadata: {
          sleepScore: s?.score,
          readinessScore: r?.score,
          activityScore: a?.score,
          steps: a?.steps ?? null,
          highMin: a?.high_activity_time != null ? Math.round(a.high_activity_time / 60) : null,
          mediumMin: a?.medium_activity_time != null ? Math.round(a.medium_activity_time / 60) : null,
          hrv: p?.average_hrv != null ? Math.round(p.average_hrv) : null,
          restingHr: p?.lowest_heart_rate ?? null,
          workouts: ws,
        },
      } satisfies BrainDocument
    })

    // Ogni allenamento è anche un documento suo: si cita da solo.
    const workoutDocs = (workouts.data ?? [])
      .filter((w) => w.id && w.day)
      .map((w): BrainDocument => {
        const activity = ACTIVITY_LABEL[w.activity ?? ''] ?? (w.activity ?? 'attività')
        const minutes = minutesBetween(w.start_datetime, w.end_datetime)
        const lines = [
          `Attività: ${activity}`,
          w.intensity ? `Intensità: ${INTENSITY_LABEL[w.intensity]}` : '',
          minutes ? `Durata: ${minutes} min` : '',
          typeof w.calories === 'number' ? `Calorie: ${Math.round(w.calories)} kcal` : '',
          typeof w.distance === 'number' && w.distance > 0 ? `Distanza: ${(w.distance / 1000).toFixed(1).replace('.', ',')} km` : '',
          w.label ? `Etichetta: ${w.label}` : '',
        ].filter(Boolean)
        return {
          source: 'oura',
          kind: 'health',
          externalId: `workout:${w.id}`,
          title: `Allenamento ${w.day} — ${activity}${minutes ? ` ${minutes} min` : ''}${w.intensity ? `, ${INTENSITY_LABEL[w.intensity]}` : ''}`,
          body: clip(lines.join('\n')),
          occurredAt: w.start_datetime ?? `${w.day}T12:00:00.000Z`,
          url: null,
          participants: [],
          metadata: { workout: true, day: w.day, activity, intensity: w.intensity ?? null, minutes, calories: w.calories ?? null },
        }
      })

    return [...dayDocs, ...workoutDocs]
  },
}
