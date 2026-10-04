import { pulse } from '@/lib/brain/agents/initiatives'
import { syncConnectors } from '@/lib/brain/connectors'
import { isAuthorizedCron } from '@/lib/brain/cron'
import { toBrainError } from '@/lib/brain/errors'
import { logRun } from '@/lib/brain/memory'

export const runtime = 'nodejs'
export const maxDuration = 300

const AGENT = 'cron-pulse'

/**
 * Il polso: ogni mezz'ora, una sincronizzazione leggera e poi i
 * dirigenti che si fanno vivi se hanno qualcosa da dire adesso. Stesso
 * segreto del cron. Su Vercel Hobby i cron sono due al giorno: questo
 * lo chiama un'azione di GitHub (`.github/workflows/brain-pulse.yml`),
 * o qualunque altro orologio con il Bearer giusto.
 */
export async function GET(request: Request) {
  const started = Date.now()
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Non autorizzato.' }, { status: 401 })
  }
  const owner = process.env.BRAIN_OWNER_EMAIL?.trim()
  if (!owner) return Response.json({ error: 'Manca BRAIN_OWNER_EMAIL.' }, { status: 503 })

  try {
    const reports = await syncConnectors(['gmail', 'gcal', 'qonto', 'web', 'oura'], { limit: 60 }).catch(() => [])
    const report = await pulse(owner)
    await logRun({
      agent: AGENT,
      question: '',
      answer: { synced: reports.map((r) => ({ source: r.source, stored: r.stored, error: r.error })), ...report, sent: report.sent.map((i) => i.key) },
      model: null,
      hits: report.sent.length,
      latencyMs: Date.now() - started,
    })
    return Response.json({ ok: true, ...report, sent: report.sent.map((i) => ({ key: i.key, executive: i.executive })), durationMs: Date.now() - started })
  } catch (err) {
    const e = toBrainError(err, 'Il polso è fallito.')
    await logRun({ agent: AGENT, question: '', answer: { error: e.message }, model: null, hits: 0, latencyMs: Date.now() - started })
    return Response.json({ error: e.message }, { status: e.status })
  }
}
