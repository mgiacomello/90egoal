import { senderOf } from '../inbox'
import { conflicts, parseInvitation, type BusyLike } from '../invites'
import {
  applyDecision,
  applyDone,
  fromCommand,
  fromFlight,
  fromInvitation,
  fromPaymentNotice,
  isDue,
  parseDone,
  renderMandates,
  tick,
  type Citation,
  type Mandate,
  type MandateDraft,
} from '../lifecycle'
import { parseCommand } from '../mandates'
import { listMandates, logRun, openMandate, recentDocuments, updateMandate, upcomingEvents } from '../memory'
import { deliverWhatsApp, webhookConfigured, whatsappConfigured } from '../notify'
import { parsePaymentNotice } from '../payments'
import { parseDecision } from '../policy'
import { parseFlight } from '../travel'
import type { StoredDocument } from '../types'

/**
 * I mandati: le cose che BRAIN si è preso in carico.
 *
 * Tre momenti, tutti senza modello:
 *
 *   1. **la scoperta** — a ogni polso si rileggono le mail recenti e
 *      si cercano le cose che hanno un *dopo*: un volo (il check-in che
 *      apre), un avviso di pagamento (la scadenza), un invito che si
 *      scontra con l'agenda (il no da scrivere). Ognuna diventa un
 *      mandato con una chiave stabile, quindi la stessa cosa non si
 *      apre due volte;
 *   2. **l'orologio** — i mandati che hanno un `wakeAt` passato dicono
 *      la loro e decidono quando ripassare (`lifecycle.tick`);
 *   3. **le tue risposte** — "ok 7F2A", "no 7F2A", "fatto 7F2A",
 *      "mandati", "ricordami domani alle 9 …": arrivano da WhatsApp e
 *      cambiano lo stato.
 *
 * Nessuno di questi passi manda, paga o clicca da nessuna parte: un
 * mandato arriva fino a "pronto" e lì aspetta la tua mano. Quando ci
 * sarà un esecutore, entrerà fra "approvato" e "fatto", con le regole
 * di `policy.ts` davanti.
 */

export const MANDATE_AGENT = 'mandate'

const MAIL_WINDOW_DAYS = 21

function citationOf(doc: StoredDocument): Citation {
  return { source: doc.source, title: doc.title, occurredAt: doc.occurredAt, url: doc.url ?? null }
}

function senderName(body: string): string | null {
  const line = body.match(/^Da:\s*(.*)$/m)?.[1] ?? ''
  const name = line.replace(/<[^>]*>/, '').replace(/"/g, '').trim()
  if (!name || name.includes('@')) return null
  // "Mario Rossi" → "Mario": il saluto è a una persona, non a una firma.
  return name.split(/\s+/)[0]
}

/** "Quando: 2026-10-20T18:00:00+02:00 → 2026-10-20T20:00:00+02:00" nel corpo di un evento → l'intervallo. */
function busyOf(event: StoredDocument): BusyLike {
  const line = event.body.match(/^Quando:\s*(.*)$/m)?.[1] ?? ''
  const [, to] = line.split('→').map((s) => s.trim())
  const end = to && !Number.isNaN(Date.parse(to)) ? new Date(to).toISOString() : new Date(Date.parse(event.occurredAt) + 3_600_000).toISOString()
  return { start: event.occurredAt, end, title: event.title }
}

/** Le mail recenti → i mandati che contengono. Puro a parte le letture. */
export async function discoverMandates(now = new Date()): Promise<{ found: MandateDraft[]; opened: number }> {
  const since = now.getTime() - MAIL_WINDOW_DAYS * 86_400_000
  const [mails, events] = await Promise.all([
    recentDocuments(120, 'gmail').catch(() => [] as StoredDocument[]),
    upcomingEvents(60, 100).catch(() => [] as StoredDocument[]),
  ])
  const busy = events.map(busyOf)
  const found: MandateDraft[] = []

  for (const mail of mails) {
    if (Date.parse(mail.occurredAt) < since) continue
    const sender = senderOf(mail.body) ?? ''
    const text = `${mail.title}\n${mail.body}`
    const cites = [citationOf(mail)]

    const flight = parseFlight(text, sender, mail.occurredAt)
    if (flight && Date.parse(flight.departureIso) > now.getTime()) {
      found.push(fromFlight(flight, cites))
      continue
    }

    const notice = parsePaymentNotice(text)
    if (notice && (notice.amountCents || notice.noticeCode) && (!notice.dueDate || Date.parse(`${notice.dueDate}T22:00:00Z`) > now.getTime())) {
      found.push(fromPaymentNotice(notice, mail.id, mail.title, cites))
      continue
    }

    const inv = parseInvitation(mail.title, mail.body, mail.occurredAt)
    if (inv && Date.parse(inv.startIso) > now.getTime()) {
      const draft = fromInvitation(inv, conflicts(inv, busy), mail.id, { email: sender || null, name: senderName(mail.body) }, cites, now)
      if (draft) found.push(draft)
    }
  }

  let opened = 0
  for (const draft of found) {
    if (await openMandate(draft).catch(() => false)) opened += 1
  }
  return { found, opened }
}

type Channel = 'whatsapp' | 'webhook' | 'console'

async function say(text: string, channel: Channel): Promise<unknown> {
  if (channel === 'whatsapp') return deliverWhatsApp(text, text.replace(/\s+/g, ' ').slice(0, 900))
  if (channel === 'webhook') {
    return fetch(process.env.BRAIN_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => ({ channel: 'webhook', ok: r.ok })).catch((err) => ({ channel: 'webhook', ok: false, detail: (err as Error).message }))
  }
  return { channel: 'console' }
}

export type MandateReport = {
  discovered: number
  opened: number
  announced: number
  woken: number
  channel: Channel
}

/**
 * Il giro del polso sui mandati: scopre quelli nuovi, annuncia quelli
 * mai annunciati, sveglia quelli il cui momento è arrivato.
 */
export async function runMandates(now = new Date()): Promise<MandateReport> {
  const started = Date.now()
  const channel: Channel = whatsappConfigured() ? 'whatsapp' : webhookConfigured() ? 'webhook' : 'console'
  const { found, opened } = await discoverMandates(now)

  const open = await listMandates()
  let announced = 0
  let woken = 0

  for (const m of open) {
    // Il primo messaggio: "ho visto il volo", "ti ho preparato il bonifico".
    if (!m.announcedAt) {
      const delivered = await say(m.text, channel)
      await updateMandate(m.id, { announcedAt: now.toISOString() })
      await logRun({ agent: MANDATE_AGENT, question: m.key, answer: { step: 'announce', code: m.code, title: m.title, delivered, channel }, model: null, hits: 1, latencyMs: Date.now() - started })
      announced += 1
      continue
    }
    if (!isDue(m, now) && !(m.approval && m.status === 'proposed')) continue
    const { say: text, patch } = tick(m, now)
    if (!text && !Object.keys(patch).length) continue
    let delivered: unknown = null
    if (text) delivered = await say(text, channel)
    if (Object.keys(patch).length) await updateMandate(m.id, patch)
    await logRun({ agent: MANDATE_AGENT, question: m.key, answer: { step: 'wake', code: m.code, title: m.title, said: Boolean(text), patch, delivered, channel }, model: null, hits: 1, latencyMs: Date.now() - started })
    if (text) woken += 1
  }

  return { discovered: found.length, opened, announced, woken, channel }
}

/**
 * Un messaggio dal telefono che riguarda i mandati, se lo è. Restituisce
 * la risposta, o null se il messaggio è un'altra cosa (una domanda, un
 * comando del board) e va avanti per la sua strada.
 */
export async function handleMandateMessage(text: string, now = new Date()): Promise<string | null> {
  const open = await listMandates()

  const done = parseDone(text)
  if (done) {
    const out = applyDone(done.code, open, now)
    if (out.mandate && out.patch) await updateMandate(out.mandate.id, out.patch)
    return out.reply
  }

  const decision = parseDecision(text)
  if (decision) {
    const out = applyDecision(decision, open, now)
    if (out.mandate && out.patch) await updateMandate(out.mandate.id, out.patch)
    // Un "ok" senza niente in attesa non è nostro: resta una parola.
    return out.reply || null
  }

  const cmd = parseCommand(text, now)
  if (cmd) {
    if (cmd.kind === 'tasks') return renderMandates(open, now)
    const draft = fromCommand(cmd, now)
    if (!draft) return null
    const fresh = await openMandate(draft)
    // Il messaggio di conferma è l'annuncio: non va ripetuto dal polso.
    if (fresh) {
      const [created] = (await listMandates()).filter((m) => m.key === draft.key)
      if (created) await updateMandate(created.id, { announcedAt: now.toISOString() })
    }
    return fresh ? draft.text : `C'è già: ${draft.title} _[${draft.code}]_`
  }

  return null
}

/** Per la console: aperti e chiusi di recente. */
export async function mandatesForConsole(): Promise<{ open: Mandate[]; closed: Mandate[] }> {
  const all = await listMandates(true, 200)
  const weekAgo = Date.now() - 7 * 86_400_000
  return {
    open: all.filter((m) => ['proposed', 'waiting', 'approved'].includes(m.status)),
    closed: all.filter((m) => m.closedAt && Date.parse(m.closedAt) >= weekAgo).sort((a, b) => Date.parse(b.closedAt!) - Date.parse(a.closedAt!)),
  }
}
