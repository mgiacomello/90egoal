import { requireOwner } from '@/lib/brain/auth'
import { BrainError, toBrainError } from '@/lib/brain/errors'
import { validateCorrection } from '@/lib/brain/correction'
import { recordCorrection } from '@/lib/brain/memory'

export const runtime = 'nodejs'

/**
 * "Questo è sbagliato, la cosa giusta è quest'altra."
 *
 * L'unico verso in cui la memoria accetta di essere raddrizzata, e il
 * motivo per cui a un certo punto diventa tua. La correzione entra in
 * memoria come documento, quindi da qui in poi verrà trovata e citata
 * come qualunque altra fonte — con la differenza che pesa più di
 * tutte, anche di una più recente.
 */
export async function POST(request: Request) {
  try {
    await requireOwner()

    const body = (await request.json().catch(() => ({}))) as {
      right?: unknown
      wrong?: unknown
      about?: unknown
    }

    const validated = validateCorrection({
      right: String(body.right ?? ''),
      wrong: String(body.wrong ?? ''),
      about: String(body.about ?? ''),
    })
    if (!validated.ok) throw new BrainError(validated.reason, 400)

    const result = await recordCorrection(validated.value)
    return Response.json({
      ...result,
      // `stored: 0` non è un errore: vuol dire che quella correzione
      // c'era già identica, e va detto invece di far credere a un flop.
      note: result.stored ? 'Correzione registrata in memoria.' : 'Questa correzione c\'era già, identica.',
    })
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito a registrare la correzione.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
