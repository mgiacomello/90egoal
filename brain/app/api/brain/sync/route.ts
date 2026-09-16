import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { connectorStatuses, syncConnectors } from '@/lib/brain/connectors'
import { memoryStats } from '@/lib/brain/memory'

export const runtime = 'nodejs'
// Leggere cinquanta mail con il dettaglio di ognuna non sta in dieci secondi.
export const maxDuration = 300

/** Lo stato dei connettori, senza toccare niente. */
export async function GET() {
  try {
    await requireOwner()
    const [connectors, stats] = await Promise.all([connectorStatuses(), memoryStats()])
    return Response.json({ connectors, stats })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere lo stato.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Tira dentro quello che c'è di nuovo. Un connettore rotto non ferma gli altri. */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      sources?: unknown
      days?: unknown
      limit?: unknown
    }

    const sources = Array.isArray(body.sources) ? body.sources.map(String) : null
    const days = Number(body.days)
    const limit = Number(body.limit)

    const reports = await syncConnectors(sources, {
      days: Number.isFinite(days) && days > 0 ? Math.min(days, 365) : undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    })

    const stats = await memoryStats()
    return Response.json({ reports, stats })
  } catch (err) {
    const e = toBrainError(err, 'Sincronizzazione fallita.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
