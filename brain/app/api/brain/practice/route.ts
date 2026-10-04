import { reviewPractice } from '@/lib/brain/agents/practice'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Pratiche per cliente: ore stimate, incassi, chi è senza fattura, senza incarico, nuovo. */
export async function GET() {
  try {
    const owner = await requireOwner()
    return Response.json(await reviewPractice(owner.email))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere le pratiche.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
