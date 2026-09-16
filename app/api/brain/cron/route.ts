import { syncConnectors } from '@/lib/brain/connectors'
import { CRON_AGENT, CRON_LIMIT, isAuthorizedCron } from '@/lib/brain/cron'
import { toBrainError } from '@/lib/brain/errors'
import { logRun } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * L'esecuzione automatica.
 *
 * È il passo che cambia davvero il prodotto: fino a ieri la memoria si
 * aggiornava perché premevi un tasto, da qui in poi si aggiorna da sola
 * e il tasto resta solo per quando hai fretta.
 *
 * Non si autentica come il resto di BRAIN: qui non c'è nessuno loggato,
 * c'è uno scheduler. Il controllo è un segreto condiviso, e in assenza
 * del segreto la porta è chiusa — mai aperta "perché tanto è un cron".
 *
 * Un connettore che fallisce non ferma gli altri, e il suo errore
 * finisce nel registro: `syncConnectors` restituisce un rapporto per
 * fonte proprio perché una sincronizzazione parziale si deve vedere.
 */
export async function GET(request: Request) {
  const started = Date.now()

  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    // Nessun dettaglio sul perché: a uno scheduler non serve, a un curioso sì.
    return Response.json({ error: 'Non autorizzato.' }, { status: 401 })
  }

  try {
    const reports = await syncConnectors(null, { limit: CRON_LIMIT })
    const stored = reports.reduce((sum, r) => sum + r.stored, 0)
    const failed = reports.filter((r) => r.error)

    await logRun({
      agent: CRON_AGENT,
      question: '',
      answer: { reports, stored, failed: failed.length },
      model: null,
      hits: stored,
      latencyMs: Date.now() - started,
    })

    return Response.json({
      ok: failed.length === 0,
      stored,
      reports,
      durationMs: Date.now() - started,
    })
  } catch (err) {
    const e = toBrainError(err, 'Sincronizzazione automatica fallita.')

    // Anche il fallimento va nel registro: una memoria che ha smesso di
    // aggiornarsi in silenzio è peggio di una memoria vuota, perché
    // sembra aggiornata.
    await logRun({
      agent: CRON_AGENT,
      question: '',
      answer: { error: e.message },
      model: null,
      hits: 0,
      latencyMs: Date.now() - started,
    })

    return Response.json({ error: e.message }, { status: e.status })
  }
}
