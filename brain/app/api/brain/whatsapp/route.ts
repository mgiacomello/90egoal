import { after } from 'next/server'
import { BOARD_AGENT, runBoard } from '@/lib/brain/agents/board'
import { BRIEF_AGENT, readOpenPoints } from '@/lib/brain/agents/brief'
import { askChiefOfStaff } from '@/lib/brain/agents/chief-of-staff'
import { renderBriefEmail, type MailBrief } from '@/lib/brain/briefmail'
import { EXECUTIVES, type ExecutiveKey } from '@/lib/brain/executives'
import { lastRun, logRun } from '@/lib/brain/memory'
import { sendWhatsApp } from '@/lib/brain/notify'
import { HELP, answerToText, chunkText, parseInbound, routeMessage, sameNumber, verifySignature } from '@/lib/brain/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 300

const AGENT = 'whatsapp'

/**
 * Il webhook di WhatsApp.
 *
 * Tre porte, una dentro l'altra:
 *   1. la firma di Meta sul corpo grezzo — senza, 401 e nessuna lettura;
 *   2. il mittente — se non è il numero del titolare, 200 e silenzio:
 *      il testo non entra in memoria e non riceve risposta;
 *   3. la risposta — va al numero del titolare e a nessun altro.
 *
 * Meta vuole un 200 entro pochi secondi; il lavoro vero parte dopo la
 * risposta con `after`, così un board che ci mette un minuto non
 * diventa un webhook ritentato tre volte.
 */

/** La verifica iniziale del webhook: Meta chiama con il token concordato. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response('Non autorizzato.', { status: 403 })
}

async function lastBriefText(): Promise<string> {
  const run = await lastRun(BRIEF_AGENT)
  if (!run) return 'Nessun brief ancora. Arriva ogni mattina dopo la sincronizzazione.'
  const a = run.answer as Partial<MailBrief> & { generatedAt?: string }
  const points = await readOpenPoints().catch(() => [])
  const brief: MailBrief = {
    generatedAt: a.generatedAt ?? run.createdAt,
    oggi: a.oggi ?? [],
    novita: a.novita ?? [],
    puntiAperti: points.map((p) => ({ text: p.text, openedAt: p.openedAt, age: p.age })),
    conto: a.conto ?? null,
    posta: a.posta ?? null,
    scadenze: a.scadenze ?? [],
  }
  const { subject, text } = renderBriefEmail(brief, process.env.BRAIN_APP_URL ?? '')
  return `*${subject}*\n\n${text}`
}

async function lastBoardText(): Promise<string> {
  const run = await lastRun(BOARD_AGENT)
  const text = (run?.answer as { text?: string } | null)?.text
  return text ? `*Il board*\n\n${text}` : 'Il board non si è ancora riunito. Scrivi "riunisci" per convocarlo adesso.'
}

async function handle(text: string, owner: string): Promise<string> {
  const route = routeMessage(text)
  if (route.kind === 'help') return HELP
  if (route.kind === 'brief') return lastBriefText()
  if (route.kind === 'board') return lastBoardText()
  if (route.kind === 'convene') {
    const board = await runBoard(owner)
    return `*Il board si è riunito*\n\n${board.text || 'Niente da decidere oggi.'}`
  }
  const exec = EXECUTIVES[route.executive as ExecutiveKey] ?? EXECUTIVES.grace
  const answer = await askChiefOfStaff(route.question, { executive: exec.key })
  return answerToText(
    exec.name,
    answer.claims.map((c) => ({ text: c.text, unverified: c.unverified, sources: c.sources })),
    answer.openQuestions
  )
}

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) {
    return new Response('Firma non valida.', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('ok', { status: 200 })
  }

  const owner = process.env.BRAIN_OWNER_EMAIL?.trim() ?? ''
  const ownerNumber = process.env.WHATSAPP_OWNER_NUMBER
  const mine = parseInbound(payload).filter((m) => sameNumber(m.from, ownerNumber))

  if (mine.length && owner) {
    after(async () => {
      for (const m of mine) {
        const started = Date.now()
        let reply: string
        try {
          reply = await handle(m.text, owner)
        } catch (err) {
          reply = `Non sono riuscito a rispondere: ${(err as Error).message}`
        }
        const results = []
        for (const part of chunkText(reply)) results.push(await sendWhatsApp(part))
        await logRun({
          agent: AGENT,
          question: m.text.slice(0, 300),
          answer: { messageId: m.id, parts: results.length, ok: results.every((r) => r.ok), detail: results.map((r) => r.detail) },
          model: null,
          hits: results.length,
          latencyMs: Date.now() - started,
        })
      }
    })
  }

  // Sempre 200: a Meta non serve altro, e a chi scrive dal numero sbagliato non serve niente.
  return new Response('ok', { status: 200 })
}
