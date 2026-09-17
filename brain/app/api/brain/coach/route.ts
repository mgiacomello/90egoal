import { coach } from '@/lib/brain/agents/coach'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * I numeri dell'anello, già fatti, e un consiglio piccolo sopra.
 * Non è un parere medico e lo dice: qui, nel prompt e nell'interfaccia.
 */
export async function GET(request: Request) {
  try {
    await requireOwner()

    const raw = Number(new URL(request.url).searchParams.get('days'))
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 180) : 30

    return Response.json(await coach(days, request.signal))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere i dati dell\'anello.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
