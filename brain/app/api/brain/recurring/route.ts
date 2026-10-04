import { reviewSubscriptions } from '@/lib/brain/agents/recurring'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Gli addebiti ricorrenti: quanto costano all'anno, se sono aumentati, quando ripassano. */
export async function GET(request: Request) {
  try {
    await requireOwner()
    const raw = Number(new URL(request.url).searchParams.get('months') ?? 12)
    const months = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24) : 12
    return Response.json(await reviewSubscriptions(months))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere i movimenti.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
