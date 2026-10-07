import { handleMandateMessage, mandatesForConsole, runMandates } from '@/lib/brain/agents/mandates'
import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { listMandates, updateMandate } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 120

/** I mandati: aperti, e chiusi negli ultimi sette giorni. */
export async function GET() {
  try {
    await requireOwner()
    return Response.json(await mandatesForConsole())
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a leggere i mandati.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}

/**
 * Dalla console: `scan` (cerca nelle mail adesso), `say` (lo stesso
 * testo che manderesti su WhatsApp: "fatto 7F2A", "ricordami…"), oppure
 * `done` / `decline` su un id.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; id?: unknown; text?: unknown }
    const action = String(body.action ?? '')
    const now = new Date()

    if (action === 'scan') {
      const report = await runMandates(now)
      return Response.json({ report, ...(await mandatesForConsole()) })
    }

    if (action === 'say') {
      const text = String(body.text ?? '').trim()
      if (!text) throw new BrainError('Niente da dire.', 400)
      const reply = await handleMandateMessage(text, now)
      return Response.json({ reply: reply ?? 'Non è un comando sui mandati. Prova "mandati", "fatto <codice>", "ricordami domani alle 9 di …".', ...(await mandatesForConsole()) })
    }

    const id = String(body.id ?? '').trim()
    if (!id) throw new BrainError('Manca l\'id del mandato.', 400)
    const found = (await listMandates(true, 200)).find((m) => m.id === id)
    if (!found) throw new BrainError('Mandato non trovato.', 404)

    if (action === 'done') await updateMandate(id, { status: 'done', wakeAt: null, closedAt: now.toISOString() })
    else if (action === 'decline') await updateMandate(id, { status: 'declined', wakeAt: null, closedAt: now.toISOString() })
    else if (action === 'approve' && found.status === 'proposed' && found.approval) {
      await updateMandate(id, { status: 'approved', approval: { ...found.approval, grantedAt: now.toISOString() } })
    } else throw new BrainError('Azione non riconosciuta.', 400)

    return Response.json(await mandatesForConsole())
  } catch (err) {
    const e = toBrainError(err, 'Operazione sul mandato fallita.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
