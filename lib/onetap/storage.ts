// ONE TAP — memoria locale.
//
// Privacy by design: cronologia e contatore restano nel browser dell'utente.
// Nessuna riga di questo file parla con il server, e non esiste un endpoint che
// possa rileggerli. "Cancella tutto" cancella davvero tutto.
//
// L'accesso passa da uno store esterno (`subscribe`/`getSnapshot`) perché
// localStorage è, appunto, esterno a React: così la UI si idrata senza
// lampeggiare e senza `setState` dentro a un effetto.

import type { HistoryItem, SuggestedAction } from './types'

const HISTORY_KEY = 'onetap.history.v1'
const USAGE_KEY = 'onetap.usage.v1'
const ONBOARDED_KEY = 'onetap.onboarded.v1'

export const FREE_ACTIONS_PER_MONTH = 20
const MAX_HISTORY = 50

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage pieno o disabilitato: l'app continua a funzionare senza memoria.
  }
}

/* ------------------------------------------------------------------ *
 * Stato osservabile
 * ------------------------------------------------------------------ */

export interface OneTapState {
  /** false finché localStorage non è stato letto (server e primo render). */
  hydrated: boolean
  history: HistoryItem[]
  /** Azioni compiute nel mese corrente. */
  used: number
  onboarded: boolean
}

/** Sul server non si sa nulla: si assume "già visto" per non far lampeggiare l'onboarding. */
const SERVER_STATE: OneTapState = Object.freeze({
  hydrated: false,
  history: [],
  used: 0,
  onboarded: true,
})

let state: OneTapState | null = null
const listeners = new Set<() => void>()

function emit(next: OneTapState): void {
  state = next
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): OneTapState {
  if (!state) {
    state = {
      hydrated: true,
      history: read<HistoryItem[]>(HISTORY_KEY, []),
      used: currentUsage().count,
      onboarded: read<boolean>(ONBOARDED_KEY, false),
    }
  }
  return state
}

export function getServerSnapshot(): OneTapState {
  return SERVER_STATE
}

/* ------------------------------------------------------------------ *
 * Contatore mensile
 * ------------------------------------------------------------------ */

interface Usage {
  /** Mese di riferimento, formato YYYY-MM. */
  month: string
  count: number
}

function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function currentUsage(now = new Date()): Usage {
  const stored = read<Usage>(USAGE_KEY, { month: currentMonth(now), count: 0 })
  // Cambio di mese: il conteggio riparte, senza dover ricordare lo storico.
  return stored.month === currentMonth(now) ? stored : { month: currentMonth(now), count: 0 }
}

/* ------------------------------------------------------------------ *
 * Mutazioni
 * ------------------------------------------------------------------ */

/** Registra un'azione eseguita e incrementa il contatore. Restituisce il totale del mese. */
export function recordAction(action: SuggestedAction, preview: string, now = new Date()): number {
  const item: HistoryItem = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.getTime(),
    preview: preview.length > 80 ? `${preview.slice(0, 77)}…` : preview,
    action: action.kind,
    label: action.label,
    value: action.value,
    event: action.event,
    contact: action.contact,
    note: action.note,
  }

  const current = getSnapshot()
  const history = [item, ...current.history].slice(0, MAX_HISTORY)
  const usage = { month: currentMonth(now), count: currentUsage(now).count + 1 }

  write(HISTORY_KEY, history)
  write(USAGE_KEY, usage)
  emit({ ...current, history, used: usage.count })
  return usage.count
}

export function removeFromHistory(id: string): void {
  const current = getSnapshot()
  const history = current.history.filter((h) => h.id !== id)
  write(HISTORY_KEY, history)
  emit({ ...current, history })
}

export function clearHistory(): void {
  const current = getSnapshot()
  write(HISTORY_KEY, [])
  emit({ ...current, history: [] })
}

export function markOnboarded(): void {
  const current = getSnapshot()
  write(ONBOARDED_KEY, true)
  emit({ ...current, onboarded: true })
}

/** Usato dal pannello privacy: azzera davvero tutto, contatore compreso. */
export function wipeEverything(): void {
  if (typeof window !== 'undefined') {
    for (const key of [HISTORY_KEY, USAGE_KEY, ONBOARDED_KEY]) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // niente da fare: lo storage è già inaccessibile
      }
    }
  }
  emit({ hydrated: true, history: [], used: 0, onboarded: false })
}
