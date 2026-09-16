import { redirect } from 'next/navigation'
import BrainConsole from '@/components/brain/BrainConsole'
import { currentOwner } from '@/lib/brain/auth'
import { connectorStatuses } from '@/lib/brain/connectors'
import { memoryConfigured } from '@/lib/brain/db'
import { memoryStats, recentDocuments, type MemoryStats } from '@/lib/brain/memory'
import type { ConnectorStatus } from '@/lib/brain/connectors/types'
import type { StoredDocument } from '@/lib/brain/types'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
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
  try {
    ;[connectors, stats, documents] = await Promise.all([
      connectorStatuses(),
      memoryStats(),
      recentDocuments(40),
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
      googleOutcome={googleOutcome}
    />
  )
}
