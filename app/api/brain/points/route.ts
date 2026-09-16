import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { closePoint, listOpenPoints, reopenPoint } from '@/lib/brain/memory'

export const runtime = 'nodejs'

/**
 * Chiudere un punto aperto.
 *
 * È l'unico modo in cui un punto si chiude, e non è una limitazione:
 * è il motivo per cui la lista è credibile. Un sistema che chiude da
 * solo quello di cui nessuno parla più non è una memoria, è un
 * dimenticatoio con una barra di avanzamento.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown
      action?: unknown
      note?: unknown
    }

    const id = String(body.id ?? '').trim()
    if (!id) throw new BrainError('Manca l\'id del punto.', 400)

    const action = String(body.action ?? 'close')
    if (action === 'reopen') await reopenPoint(id)
    else await closePoint(id, String(body.note ?? '').trim().slice(0, 500) || undefined)

    return Response.json({ puntiAperti: await listOpenPoints() })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito ad aggiornare il punto.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
