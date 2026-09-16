import { isWorthSending, renderBriefEmail, type MailBrief } from './briefmail'

/**
 * La consegna del brief.
 *
 * Chiude il cerchio che il cron aveva aperto a metà: il sistema parte
 * da solo **e** ti trova, invece di aspettare che apri una pagina.
 *
 * Una scelta che va detta, perché la strada comoda era l'altra:
 * **il brief non viene spedito con Gmail.** Gli scope OAuth di questo
 * prodotto sono tutti `.readonly`, e l'unica cosa che li rende una
 * garanzia e non una promessa è che nessuno li allarghi quando fa
 * comodo. Aggiungere `gmail.send` per risparmiare una chiave di posta
 * significherebbe che da domani un agente *può* scrivere a nome tuo —
 * e la frase "nessun agente può mandare una mail" smetterebbe di
 * essere vera. Quindi la posta esce da un canale suo, separato, che
 * non ha accesso a niente.
 *
 * Due canali, entrambi facoltativi:
 *  - **email** via Resend (una chiave, una chiamata HTTP);
 *  - **webhook** generico, che riceve il brief in JSON e lo porta
 *    dove vuoi — Slack, Telegram, n8n. Il campo `text` è già pronto
 *    per un incoming webhook di Slack.
 *
 * Se non ne configuri nessuno, il brief resta sulla console e basta:
 * niente si rompe.
 */

export type DeliveryChannel = 'email' | 'webhook'

export type DeliveryResult = {
  channel: DeliveryChannel
  ok: boolean
  detail: string
}

export type DeliveryReport = {
  /** Il brief non meritava di svegliare nessuno. */
  skipped: boolean
  results: DeliveryResult[]
}

function consoleUrl(): string {
  return process.env.BRAIN_APP_URL?.trim().replace(/\/$/, '') ?? ''
}

function recipient(): string {
  return (process.env.BRAIN_MAIL_TO || process.env.BRAIN_OWNER_EMAIL || '').trim()
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.BRAIN_MAIL_FROM && recipient())
}

export function webhookConfigured(): boolean {
  return Boolean(process.env.BRAIN_WEBHOOK_URL)
}

export function deliveryConfigured(): boolean {
  return emailConfigured() || webhookConfigured()
}

async function sendEmail(mail: { subject: string; text: string; html: string }): Promise<DeliveryResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.BRAIN_MAIL_FROM,
        to: [recipient()],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { channel: 'email', ok: false, detail: `${res.status} ${detail.slice(0, 200)}` }
    }
    return { channel: 'email', ok: true, detail: `inviata a ${recipient()}` }
  } catch (err) {
    return { channel: 'email', ok: false, detail: (err as Error).message }
  }
}

async function sendWebhook(brief: MailBrief, mail: { subject: string; text: string }): Promise<DeliveryResult> {
  try {
    const res = await fetch(process.env.BRAIN_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` in cima e già formattato: un incoming webhook di Slack
      // legge quello e ignora il resto, senza bisogno di un adattatore.
      body: JSON.stringify({ text: `*${mail.subject}*\n\n${mail.text}`, subject: mail.subject, brief }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { channel: 'webhook', ok: false, detail: `${res.status} ${detail.slice(0, 200)}` }
    }
    return { channel: 'webhook', ok: true, detail: 'consegnato' }
  } catch (err) {
    return { channel: 'webhook', ok: false, detail: (err as Error).message }
  }
}

/**
 * Consegna il brief sui canali configurati.
 *
 * `force` salta il controllo su "vale la pena": serve al pulsante di
 * prova, perché al primo giro bisogna poter verificare che la posta
 * esca davvero, anche in una giornata in cui non c'è niente da dire.
 */
export async function deliverBrief(brief: MailBrief, force = false): Promise<DeliveryReport> {
  if (!force && !isWorthSending(brief)) {
    // Il silenzio è a sua volta un'informazione: una mail quotidiana che
    // dice "niente di nuovo" viene archiviata senza leggerla entro una
    // settimana, e da lì in poi non si legge nemmeno quella che conta.
    return { skipped: true, results: [] }
  }

  const mail = renderBriefEmail(brief, consoleUrl())
  const jobs: Promise<DeliveryResult>[] = []

  if (emailConfigured()) jobs.push(sendEmail(mail))
  if (webhookConfigured()) jobs.push(sendWebhook(brief, mail))

  return { skipped: false, results: await Promise.all(jobs) }
}
