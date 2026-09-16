import { redirect } from 'next/navigation'
import BrainConsole from '@/components/brain/BrainConsole'
import { currentOwner } from '@/lib/brain/auth'
import { connectorStatuses } from '@/lib/brain/connectors'
import { memoryConfigured } from '@/lib/brain/db'
import { CRON_AGENT } from '@/lib/brain/cron'
import { BRIEF_AGENT, readOpenPoints, type BriefOpenPoint } from '@/lib/brain/agents/brief'
import { lastRun, memoryStats, recentDocuments, type MemoryStats, type RunRecord } from '@/lib/brain/memory'
import type { ConnectorStatus } from '@/lib/brain/connectors/types'
import type { StoredDocument } from '@/lib/brain/types'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

/**
 * L'esito dell'ultima esecuzione automatica, ridotto a una riga.
 * Un cron che ha smesso di girare in silenzio è peggio di un cron che
 * non c'è, perché la memoria *sembra* aggiornata: qui si vede.
 */
function summarizeAutoSync(answer: unknown): string {
  const data = (answer ?? {}) as {
    error?: string
    briefError?: string | null
    reports?: { label: string; error: string | null }[]
  }
  if (data.error) return `non riuscita: ${data.error}`

  const broken = (data.reports ?? []).filter((r) => r.error)
  const parts: string[] = []
  if (broken.length) parts.push(`${broken.map((r) => r.label).join(', ')} in errore`)
  if (data.briefError) parts.push(`brief non scritto (${data.briefError})`)

  return parts.length ? `parziale — ${parts.join('; ')}` : 'riuscita'
}

/** Lo schema non è ancora stato eseguito, oppure mancano le chiavi Supabase. */
function Setup({ message }: { message: string }) {
  return (
    <div className="brain">
      <div className="brain-shell">
        <header className="brain-head">
          <span className="brain-mark">BRAIN<span>.</span></span>
          <span className="brain-role">memoria non pronta</span>
        </header>
        <p className="brain-error" style={{ marginTop: '1.5rem' }}>{message}</p>
        <p className="brain-note brain-section">
          Esegui <code>supabase/migration_brain.sql</code> nell&apos;SQL Editor del progetto, poi
          ricarica. Il dettaglio dei passi è in <code>BRAIN.md</code>.
        </p>
      </div>
    </div>
  )
}

export default async function BrainPage({ searchParams }: PageProps<'/brain'>) {
  // Prima la porta: nessuna query alla memoria prima di sapere chi sta entrando.
  const owner = await currentOwner()
  if (!owner) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    redirect(user ? '/' : '/auth/login')
  }

  if (!memoryConfigured()) {
    return <Setup message="Manca la configurazione di Supabase: servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." />
  }

  let connectors: ConnectorStatus[]
  let stats: MemoryStats
  let documents: StoredDocument[]
  let autoSync: RunRecord | null
  let briefRun: RunRecord | null
  let points: BriefOpenPoint[]
  try {
    ;[connectors, stats, documents, autoSync, briefRun, points] = await Promise.all([
      connectorStatuses(),
      memoryStats(),
      recentDocuments(40),
      lastRun(CRON_AGENT),
      lastRun(BRIEF_AGENT),
      readOpenPoints(),
    ])
  } catch (err) {
    return <Setup message={`La memoria non risponde: ${(err as Error).message}`} />
  }

  const params = await searchParams
  const google = first(params.google)
  const googleOutcome = google
    ? { ok: google === 'ok', detail: first(params.account) || first(params.motivo) }
    : null

  return (
    <BrainConsole
      ownerEmail={owner.email}
      initialConnectors={connectors}
      initialStats={stats}
      initialDocuments={documents}
      initialBrief={
        briefRun ? { ...(briefRun.answer as Record<string, unknown>), at: briefRun.createdAt } : null
      }
      initialPoints={points}
      autoSync={
        autoSync
          ? { at: autoSync.createdAt, stored: autoSync.hits, detail: summarizeAutoSync(autoSync.answer) }
          : null
      }
      googleOutcome={googleOutcome}
    />
  )
}
