import { askChiefOfStaff } from '@/lib/brain/agents/chief-of-staff'
import { BOARD_ORDER, type ExecutiveKey } from '@/lib/brain/executives'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'

export const runtime = 'nodejs'

/** Una domanda alla memoria. La risposta è già verificata: le fonti ci sono. */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as { question?: unknown; executive?: unknown }
    const question = String(body.question ?? '').trim().slice(0, 600)
    if (!question) {
      return Response.json({ error: 'Scrivi una domanda.' }, { status: 400 })
    }

    const executive = BOARD_ORDER.find((k) => k === body.executive) as ExecutiveKey | undefined
    const answer = await askChiefOfStaff(question, { signal: request.signal, executive })
    return Response.json(answer)
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a rispondere.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
