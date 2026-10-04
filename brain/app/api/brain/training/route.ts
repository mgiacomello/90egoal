import { reviewTraining } from '@/lib/brain/agents/training'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 120

/** Sto facendo sport bene? I numeri li fa il codice, il consiglio il modello. */
export async function GET(request: Request) {
  try {
    await requireOwner()
    const raw = Number(new URL(request.url).searchParams.get('days') ?? 28)
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 180) : 28
    return Response.json(await reviewTraining(days, request.signal))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere gli allenamenti.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
