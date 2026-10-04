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

export type DeliveryChannel = 'email' | 'webhook' | 'whatsapp'

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

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OWNER_NUMBER)
}

export function deliveryConfigured(): boolean {
  return emailConfigured() || webhookConfigured() || whatsappConfigured()
}

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * WhatsApp, al solo numero del titolare. Fuori dalla finestra di 24 ore
 * dall'ultimo suo messaggio, Meta accetta solo un template approvato:
 * allora parte il template (una riga, senza a capo, perché è tutto ciò
 * che accetta) che invita a rispondere "brief" o "board" — e la
 * risposta riapre la finestra per il testo intero.
 */
export async function sendWhatsApp(text: string): Promise<DeliveryResult> {
  const to = (process.env.WHATSAPP_OWNER_NUMBER ?? '').replace(/\D/g, '')
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4096), preview_url: false } }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { channel: 'whatsapp', ok: false, detail: `${res.status} ${detail.slice(0, 300)}` }
    }
    return { channel: 'whatsapp', ok: true, detail: `inviato a ***${to.slice(-4)}` }
  } catch (err) {
    return { channel: 'whatsapp', ok: false, detail: (err as Error).message }
  }
}

export async function sendWhatsAppTemplate(summary: string): Promise<DeliveryResult> {
  const name = process.env.WHATSAPP_TEMPLATE?.trim()
  if (!name) return { channel: 'whatsapp', ok: false, detail: 'fuori dalla finestra di 24 ore e nessun WHATSAPP_TEMPLATE configurato' }
  const to = (process.env.WHATSAPP_OWNER_NUMBER ?? '').replace(/\D/g, '')
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'it' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: summary }] }],
        },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { channel: 'whatsapp', ok: false, detail: `${res.status} ${detail.slice(0, 300)}` }
    }
    return { channel: 'whatsapp', ok: true, detail: `template inviato a ***${to.slice(-4)}` }
  } catch (err) {
    return { channel: 'whatsapp', ok: false, detail: (err as Error).message }
  }
}

/** Testo intero se la finestra è aperta; altrimenti il template con una riga. */
export async function deliverWhatsApp(text: string, summary: string): Promise<DeliveryResult> {
  const first = await sendWhatsApp(text)
  if (first.ok) return first
  // 131047: fuori dalla finestra di 24 ore. 131026: non raggiungibile.
  if (/131047|re-engagement|24 ?h/i.test(first.detail)) return sendWhatsAppTemplate(summary)
  return first
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
 * Consegna una mail qualunque — il board, per esempio — sugli stessi
 * canali del brief. Stesse regole: nessun invio da Gmail, mai.
 */
export async function deliverMail(mail: { subject: string; text: string; html: string }, payload: unknown): Promise<DeliveryReport> {
  const jobs: Promise<DeliveryResult>[] = []
  if (emailConfigured()) jobs.push(sendEmail(mail))
  if (whatsappConfigured()) jobs.push(deliverWhatsApp(`*${mail.subject}*\n\n${mail.text}`, `${mail.subject}. Rispondi "board" per leggerlo.`))
  if (webhookConfigured()) {
    jobs.push(
      (async (): Promise<DeliveryResult> => {
        try {
          const res = await fetch(process.env.BRAIN_WEBHOOK_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: `*${mail.subject}*\n\n${mail.text}`, subject: mail.subject, payload }),
          })
          if (!res.ok) return { channel: 'webhook', ok: false, detail: `${res.status}` }
          return { channel: 'webhook', ok: true, detail: 'consegnato' }
        } catch (err) {
          return { channel: 'webhook', ok: false, detail: (err as Error).message }
        }
      })()
    )
  }
  return { skipped: false, results: await Promise.all(jobs) }
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
  if (whatsappConfigured()) jobs.push(deliverWhatsApp(`*${mail.subject}*\n\n${mail.text}`, `${mail.subject}. Rispondi "brief" per leggerlo.`))

  return { skipped: false, results: await Promise.all(jobs) }
}
