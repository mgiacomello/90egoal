import { askChiefOfStaff } from '@/lib/brain/agents/chief-of-staff'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'

/** Una domanda alla memoria. La risposta è già verificata: le fonti ci sono. */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as { question?: unknown }
    const question = String(body.question ?? '').trim().slice(0, 600)
    if (!question) {
      return Response.json({ error: 'Scrivi una domanda.' }, { status: 400 })
    }

    const answer = await askChiefOfStaff(question, { signal: request.signal })
    return Response.json(answer)
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a rispondere.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
