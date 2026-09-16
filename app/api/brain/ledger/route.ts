import { reviewLedger } from '@/lib/brain/agents/ledger'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'

/**
 * I giustificativi mancanti, con le fatture che potrebbero esserlo.
 *
 * Nessuna chiamata a un modello: è tutta aritmetica su quello che c'è
 * già in memoria. Per questo è una GET e risponde subito.
 */
export async function GET(request: Request) {
  try {
    await requireOwner()

    const raw = Number(new URL(request.url).searchParams.get('days'))
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 730) : 90

    return Response.json(await reviewLedger(days))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a controllare i movimenti.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
