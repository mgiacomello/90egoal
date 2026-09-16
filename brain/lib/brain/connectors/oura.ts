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

    const [sleep, readiness, activity] = await Promise.all([
      ouraJson<{ data?: DailyRow[] }>(`/daily_sleep${params}`),
      ouraJson<{ data?: DailyRow[] }>(`/daily_readiness${params}`),
      ouraJson<{ data?: DailyRow[] }>(`/daily_activity${params}`),
    ])

    const sleepByDay = byDay(sleep.data ?? [])
    const readinessByDay = byDay(readiness.data ?? [])
    const activityByDay = byDay(activity.data ?? [])

    const days = [...new Set([...sleepByDay.keys(), ...readinessByDay.keys(), ...activityByDay.keys()])].sort()

    return days.map((day) => {
      const s = sleepByDay.get(day)
      const r = readinessByDay.get(day)
      const a = activityByDay.get(day)

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
        metadata: { sleepScore: s?.score, readinessScore: r?.score, activityScore: a?.score },
      } satisfies BrainDocument
    })
  },
}
