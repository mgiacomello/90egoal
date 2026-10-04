import { reviewRelations } from '@/lib/brain/agents/relations'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Chi si sta raffreddando, e chi sono le relazioni più frequenti. */
export async function GET() {
  try {
    const owner = await requireOwner()
    return Response.json(await reviewRelations(owner.email))
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere le relazioni.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
