import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { readProfile, saveProfile } from '@/lib/brain/profile'

export const runtime = 'nodejs'

/** Il profilo del titolare, com'è scritto. */
export async function GET() {
  try {
    await requireOwner()
    return Response.json({ profile: await readProfile() })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere il profilo.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/** Riscrive il profilo: una nota con un id fisso, letta da ogni dirigente prima di scrivere. */
export async function POST(request: Request) {
  try {
    await requireOwner()
    const body = (await request.json().catch(() => ({}))) as { text?: unknown }
    const text = String(body.text ?? '').trim().slice(0, 6000)
    if (text.length < 20) return Response.json({ error: 'Il profilo è troppo corto per servire a qualcosa.' }, { status: 400 })
    await saveProfile(text)
    return Response.json({ ok: true, profile: text })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a salvare il profilo.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
