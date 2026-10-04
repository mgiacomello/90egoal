import { reviewDeadlines } from '@/lib/brain/agents/deadlines'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Le scadenze nei prossimi giorni, calcolate, con la frase da cui vengono. */
export async function GET(request: Request) {
  try {
    await requireOwner()
    const raw = Number(new URL(request.url).searchParams.get('days') ?? 120)
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 365) : 120
    return Response.json(await reviewDeadlines(days))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere le scadenze.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
