import type { BrainDocument, SourceKey } from '../types'
import { lastSyncedAt, markSynced, rememberDocuments } from '../memory'
import { calendarConnector } from './gcal'
import { driveConnector } from './gdrive'
import { gmailConnector } from './gmail'
import { ouraConnector } from './oura'
import { qontoConnector } from './qonto'
import type { Connector, ConnectorStatus } from './types'

/**
 * Il registro dei connettori.
 *
 * Aggiungerne uno significa scrivere un file che restituisce
 * `BrainDocument[]` e infilarlo in questa lista. Memoria, ricerca,
 * ranking, citazioni e interfaccia non cambiano di una riga: è il
 * motivo per cui il documento normalizzato viene prima di tutto.
 */
export const CONNECTORS: Connector[] = [
  gmailConnector,
  calendarConnector,
  driveConnector,
  qontoConnector,
  ouraConnector,
]

export function connectorByKey(key: string): Connector | undefined {
  return CONNECTORS.find((c) => c.key === key)
}

export async function connectorStatuses(): Promise<ConnectorStatus[]> {
  return Promise.all(
    CONNECTORS.map(async (c) => {
      let connected = false
      try {
        connected = c.configured() ? await c.connected() : false
      } catch {
        connected = false
      }
      let syncedAt: string | null = null
      try {
        syncedAt = await lastSyncedAt(c.key)
      } catch {
        syncedAt = null
      }
      return {
        key: c.key,
        label: c.label,
        hint: c.hint,
        configured: c.configured(),
        connected,
        syncedAt,
      }
    })
  )
}

export type SyncReport = {
  source: SourceKey
  label: string
  fetched: number
  stored: number
  skipped: number
  error: string | null
}

/** Quanto indietro guardare quando un connettore non ha mai sincronizzato. */
const FIRST_RUN_DAYS = 30
/** Sovrapposizione sulle sincronizzazioni successive: un documento arrivato
 *  in ritardo non deve cadere nella fessura fra due finestre. */
const OVERLAP_HOURS = 6

async function windowFor(connector: Connector, days?: number): Promise<Date> {
  if (days) return new Date(Date.now() - days * 86_400_000)
  const last = await lastSyncedAt(connector.key)
  if (!last) return new Date(Date.now() - FIRST_RUN_DAYS * 86_400_000)
  return new Date(Date.parse(last) - OVERLAP_HOURS * 3_600_000)
}

/**
 * Sincronizza uno o più connettori.
 *
 * Un connettore che fallisce non ferma gli altri: l'errore finisce nel
 * suo rapporto e la memoria prende comunque quello che è riuscita a
 * prendere. Una sincronizzazione parziale è meglio di niente, purché
 * si veda che è parziale.
 */
export async function syncConnectors(
  keys: string[] | null,
  options: { limit?: number; days?: number } = {}
): Promise<SyncReport[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const targets = keys?.length
    ? CONNECTORS.filter((c) => keys.includes(c.key))
    : CONNECTORS.filter((c) => c.configured())

  const reports: SyncReport[] = []

  for (const connector of targets) {
    const report: SyncReport = {
      source: connector.key,
      label: connector.label,
      fetched: 0,
      stored: 0,
      skipped: 0,
      error: null,
    }

    try {
      if (!connector.configured()) throw new Error('non configurato')
      const since = await windowFor(connector, options.days)
      const docs: BrainDocument[] = await connector.fetch({ since, limit })
      report.fetched = docs.length

      const result = await rememberDocuments(docs)
      report.stored = result.stored
      report.skipped = result.skipped

      await markSynced(connector.key)
    } catch (err) {
      report.error = (err as Error).message
    }

    reports.push(report)
  }

  return reports
}
