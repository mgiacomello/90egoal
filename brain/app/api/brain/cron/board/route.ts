import { runBoard } from '@/lib/brain/agents/board'
import { isAuthorizedCron } from '@/lib/brain/cron'
import { toBrainError } from '@/lib/brain/errors'
import { executiveName } from '@/lib/brain/agents/board'
import { logRun } from '@/lib/brain/memory'
import { deliverMail } from '@/lib/brain/notify'

export const runtime = 'nodejs'
export const maxDuration = 300

const AGENT = 'cron-board'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Il board si riunisce da solo, ogni mattina dopo la sincronizzazione
 * e il brief, con lo stesso segreto del cron. La mail parte solo se il
 * board ha deciso qualcosa, se qualcuno si è opposto, o se c'è una
 * mossa per il titolare: un board che dice "niente" non scrive.
 */
export async function GET(request: Request) {
  const started = Date.now()
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Non autorizzato.' }, { status: 401 })
  }
  const owner = process.env.BRAIN_OWNER_EMAIL?.trim()
  if (!owner) return Response.json({ error: 'Manca BRAIN_OWNER_EMAIL.' }, { status: 503 })

  try {
    const board = await runBoard(owner)
    let delivery: unknown = null
    if (board.worthSending) {
      const subject = `Board · ${[
        board.synthesis?.decisioni.length ? `${board.synthesis.decisioni.length} decis${board.synthesis.decisioni.length === 1 ? 'ione' : 'ioni'}` : '',
        board.synthesis?.aperti.length ? `${board.synthesis.aperti.length} apert${board.synthesis.aperti.length === 1 ? 'o' : 'i'}` : '',
        board.synthesis?.perTe.length ? `${board.synthesis.perTe.length} per te` : '',
      ].filter(Boolean).join(', ')}`
      const html = `<!doctype html><html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:24px 16px;background:#f6f7f9"><div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 24px"><div style="font-size:18px;font-weight:800;letter-spacing:.08em">BRAIN<span style="color:#e0a63f">.</span> <span style="font-weight:400;font-size:13px;color:#6b7280">il board</span></div><pre style="white-space:pre-wrap;font:15px/1.5 inherit;color:#111827;margin-top:16px">${esc(board.text)}</pre><div style="margin-top:24px;font-size:12px;color:#6b7280">Cinque dirigenti: ${['grace', 'sterling', 'archer', 'harper', 'nova'].map(executiveName).join(', ')}. Ogni riga cita una fonte; le obiezioni restano scritte.</div></div></body></html>`
      delivery = await deliverMail({ subject, text: board.text, html }, board)
    }
    await logRun({ agent: AGENT, question: '', answer: { worthSending: board.worthSending, delivery, replies: board.replies.length }, model: null, hits: board.replies.length, latencyMs: Date.now() - started })
    return Response.json({ ok: true, worthSending: board.worthSending, delivery, durationMs: Date.now() - started })
  } catch (err) {
    const e = toBrainError(err, 'Il board automatico è fallito.')
    await logRun({ agent: AGENT, question: '', answer: { error: e.message }, model: null, hits: 0, latencyMs: Date.now() - started })
    return Response.json({ error: e.message }, { status: e.status })
  }
}
