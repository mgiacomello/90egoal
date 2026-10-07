/**
 * Il ciclo di vita di un mandato. Funzione pura: niente rete, niente
 * DOM, nessun import di valori.
 *
 * Un mandato nasce da una mail (un volo, un avviso di pagamento, un
 * invito) o da un tuo comando ("ricordami…", "comprami…"), e da lì ha
 * **uno stato e un orologio**. Qui c'è tutto quello che si può
 * decidere senza toccare il mondo: come si costruisce dalle cose
 * riconosciute, che cosa dice quando si fa vivo, quando deve farsi
 * vivo la prossima volta, cosa cambia quando rispondi.
 *
 * L'esecutore — chi manda davvero, paga davvero, clicca davvero — non
 * è qui. Finché non c'è, un mandato arriva fino a "pronto": il testo
 * da incollare, il bonifico da copiare, il check-in da fare con il PNR
 * sotto mano. È già la metà del lavoro, ed è la metà che si dimentica.
 */

import type { Invitation, BusyLike } from './invites.ts'
import { declineText } from './invites.ts'
import type { Command } from './mandates.ts'
import type { PaymentNotice } from './payments.ts'
import { paymentPack } from './payments.ts'
import { approvalCode, isExpired, newApproval, type Approval, type Decision } from './policy.ts'
import type { Flight } from './travel.ts'
import { checkinPlan, nextAttempt } from './travel.ts'

export type MandateKind = 'checkin' | 'payment' | 'invite' | 'remind' | 'buy' | 'pay' | 'errand'

export type MandateStatus =
  | 'proposed' // aspetta il tuo ok
  | 'waiting' // aspetta il momento, o che tu dica "fatto"
  | 'approved' // hai detto ok, e si va avanti
  | 'done'
  | 'declined'
  | 'expired'

export type Citation = { source: string; title: string; occurredAt: string; url: string | null }

export type Mandate = {
  id: string
  key: string
  kind: MandateKind
  status: MandateStatus
  code: string
  title: string
  text: string
  payload: Record<string, unknown>
  citations: Citation[]
  dueAt: string | null
  wakeAt: string | null
  approval: Approval | null
  announcedAt: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  note: string | null
}

/** Quello che serve per crearne uno: il resto lo mette il database. */
export type MandateDraft = Pick<Mandate, 'key' | 'kind' | 'status' | 'code' | 'title' | 'text' | 'payload' | 'citations' | 'dueAt' | 'wakeAt' | 'approval'>

export const OPEN_STATUSES: MandateStatus[] = ['proposed', 'waiting', 'approved']

export function isOpen(m: Pick<Mandate, 'status'>): boolean {
  return OPEN_STATUSES.includes(m.status)
}

function itDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** "17/10 alle 06:30", in ora italiana, da un ISO UTC. */
export function itWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const month = d.getUTCMonth() + 1
  const offset = month >= 4 && month <= 10 ? 2 : 1
  const local = new Date(d.getTime() + offset * 3_600_000)
  const dd = String(local.getUTCDate()).padStart(2, '0')
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
  const hh = String(local.getUTCHours()).padStart(2, '0')
  const mi = String(local.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm} alle ${hh}:${mi}`
}

function slug(text: string, max = 40): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
}

/* ------------------------------------------------------------------ *
 * Da una cosa riconosciuta a un mandato
 * ------------------------------------------------------------------ */

/** Un volo in una conferma → il check-in da fare quando apre. */
export function fromFlight(flight: Flight, citations: Citation[]): MandateDraft {
  const key = `checkin:${flight.pnr}:${flight.flightNumber}`
  const plan = checkinPlan(flight)
  const route = flight.from && flight.to ? ` ${flight.from}→${flight.to}` : ''
  const code = approvalCode(key)
  const penalty = flight.airline.penalty ? ` Dimenticarlo costa: ${flight.airline.penalty}.` : ''
  return {
    key,
    kind: 'checkin',
    status: 'waiting',
    code,
    title: `Check-in ${flight.airline.name} ${flight.flightNumber}${route} · ${flight.departureLocal}`,
    text: `*Grace* · Ho visto il volo ${flight.airline.name} ${flight.flightNumber}${route} del ${itWhen(flight.departureIso)} (prenotazione ${flight.pnr}). Il check-in apre il ${itWhen(plan.firstAttemptIso)}: ti avviso allora, con tutto sotto mano.${penalty} _[${code}]_`,
    payload: { flight: { ...flight, airline: { key: flight.airline.key, name: flight.airline.name, domains: flight.airline.domains } }, plan },
    citations,
    dueAt: flight.departureIso,
    wakeAt: plan.firstAttemptIso,
    approval: null,
  }
}

/** Un avviso di pagamento → il pacchetto pronto, e un promemoria a ridosso della scadenza. */
export function fromPaymentNotice(notice: PaymentNotice, documentId: string, subject: string, citations: Citation[]): MandateDraft {
  const key = `payment:${documentId}`
  const code = approvalCode(key)
  const what = notice.kind === 'bollo' ? 'Bollo auto' : notice.kind === 'pagopa' ? 'Avviso pagoPA' : 'Bonifico'
  const title = `${what}${notice.beneficiary ? ` · ${notice.beneficiary}` : ''}${notice.dueDate ? ` · entro il ${itDay(notice.dueDate)}` : ''}`
  // Due giorni prima della scadenza, alle 9 italiane; senza scadenza, non si torna sopra.
  const wakeAt = notice.dueDate ? new Date(Date.parse(`${notice.dueDate}T07:00:00Z`) - 2 * 86_400_000).toISOString() : null
  return {
    key,
    kind: 'payment',
    status: 'waiting',
    code,
    title,
    text: `*Sterling* · Da "${subject}": ${what.toLowerCase()} da fare${notice.dueDate ? ` entro il ${itDay(notice.dueDate)}` : ''}. Ti ho preparato i dati, un campo per riga:\n\n${paymentPack(notice)}\n\nQuando l'hai pagato scrivi *fatto ${code}*. _[${code}]_`,
    payload: { notice, subject },
    citations,
    dueAt: notice.dueDate ? `${notice.dueDate}T22:00:00.000Z` : null,
    wakeAt,
    approval: null,
  }
}

/** Un invito con un conflitto in agenda → il "no, grazie" pronto, che parte solo con il tuo ok. */
export function fromInvitation(
  inv: Invitation,
  busy: BusyLike[],
  documentId: string,
  sender: { email: string | null; name: string | null },
  citations: Citation[],
  now: Date
): MandateDraft | null {
  if (!busy.length) return null
  const key = `invite:${documentId}`
  const code = approvalCode(key)
  const clash = busy[0].title ? `"${busy[0].title}"` : 'un impegno'
  const decline = declineText(inv, sender.name)
  const approval = newApproval(key, 'send_email', `Declinare "${inv.title}" (${itDay(inv.day)})`, now)
  return {
    key,
    kind: 'invite',
    status: 'proposed',
    code,
    title: `Invito: ${inv.title} · ${itDay(inv.day)}`,
    text: `*Grace* · Invito a "${inv.title}" il ${itDay(inv.day)}${inv.timeLocal ? ` alle ${inv.timeLocal}` : ''}, ma in agenda hai già ${clash}. Ti ho scritto il no:\n\n${decline}\n\nRispondi *ok ${code}* e lo tengo pronto da mandare, *no ${code}* se invece vuoi andarci. _[${code}]_`,
    payload: { invitation: inv, conflicts: busy.slice(0, 3), to: sender.email, decline },
    citations,
    dueAt: inv.startIso,
    wakeAt: null,
    approval: { ...approval, code },
  }
}

/** Un tuo comando → un mandato. */
export function fromCommand(cmd: Command, now: Date): MandateDraft | null {
  if (cmd.kind === 'tasks') return null
  if (cmd.kind === 'remind') {
    const key = `remind:${cmd.atIso.slice(0, 16)}:${slug(cmd.what)}`
    const code = approvalCode(key)
    return {
      key,
      kind: 'remind',
      status: 'waiting',
      code,
      title: `Promemoria: ${cmd.what}`,
      text: `Segnato: ti ricordo "${cmd.what}" il ${itWhen(cmd.atIso)}. _[${code}]_`,
      payload: { what: cmd.what, atIso: cmd.atIso },
      citations: [],
      dueAt: cmd.atIso,
      wakeAt: cmd.atIso,
      approval: null,
    }
  }
  const key = `${cmd.kind}:${now.toISOString().slice(0, 10)}:${slug(cmd.goal)}`
  const code = approvalCode(key)
  const label = cmd.kind === 'buy' ? 'Acquisto' : cmd.kind === 'pay' ? 'Pagamento' : 'Commissione'
  return {
    key,
    kind: cmd.kind,
    status: 'waiting',
    code,
    title: `${label}: ${cmd.goal}`,
    text: `Preso in carico: "${cmd.goal}". Non so ancora muovermi da solo su un sito — quando potrò, lo farò da qui e ti chiederò l'ok prima di pagare o mandare. Intanto resta nella lista: scrivi *mandati* per vederla, *fatto ${code}* quando è risolto. _[${code}]_`,
    payload: { goal: cmd.goal },
    citations: [],
    dueAt: null,
    wakeAt: null,
    approval: null,
  }
}

/* ------------------------------------------------------------------ *
 * L'orologio: cosa dice un mandato quando si sveglia
 * ------------------------------------------------------------------ */

export type Tick = { say: string | null; patch: Partial<Mandate> }

/** Va svegliato adesso? */
export function isDue(m: Pick<Mandate, 'status' | 'wakeAt'>, now: Date): boolean {
  return isOpen(m) && Boolean(m.wakeAt) && Date.parse(m.wakeAt!) <= now.getTime()
}

/**
 * Il polso sveglia un mandato: dice quello che c'è da dire adesso e
 * decide quando ripassare. Chi non ha niente da dire (per esempio un
 * invito che aspetta il tuo ok) resta com'è.
 */
export function tick(m: Mandate, now: Date): Tick {
  if (!isOpen(m)) return { say: null, patch: {} }

  if (m.approval && isExpired(m.approval, now) && m.status === 'proposed') {
    return { say: null, patch: { status: 'expired', closedAt: now.toISOString(), note: 'approvazione scaduta' } }
  }

  if (!isDue(m, now)) return { say: null, patch: {} }

  switch (m.kind) {
    case 'remind': {
      const what = String(m.payload.what ?? m.title)
      return { say: `⏰ *Promemoria* · ${what} _[${m.code}]_`, patch: { status: 'done', wakeAt: null, closedAt: now.toISOString() } }
    }
    case 'checkin': {
      const flight = m.payload.flight as Flight | undefined
      const plan = m.payload.plan as ReturnType<typeof checkinPlan> | undefined
      if (!flight || !plan) return { say: null, patch: { status: 'expired', closedAt: now.toISOString(), note: 'dati mancanti' } }
      const next = nextAttempt(plan, now)
      const domain = flight.airline.domains?.[0] ?? ''
      const reminders = Number(m.payload.reminders ?? 0)
      if (reminders >= 1 && !next) {
        return { say: null, patch: { status: 'expired', wakeAt: null, closedAt: now.toISOString(), note: 'check-in chiuso senza conferma' } }
      }
      const say = reminders === 0
        ? `✈️ *Check-in aperto* · ${flight.airline.name} ${flight.flightNumber} del ${itWhen(flight.departureIso)}. Prenotazione *${flight.pnr}*${domain ? `, su ${domain}` : ''}. Fatto? Scrivi *fatto ${m.code}*. _[${m.code}]_`
        : `✈️ Il check-in per ${flight.airline.name} ${flight.flightNumber} (${flight.pnr}) è ancora da fare: chiude ${itWhen(plan.lastAttemptIso)}. *fatto ${m.code}* quando l'hai fatto. _[${m.code}]_`
      return { say, patch: { wakeAt: next, payload: { ...m.payload, reminders: reminders + 1 } } }
    }
    case 'payment': {
      const notice = m.payload.notice as PaymentNotice | undefined
      if (!notice) return { say: null, patch: { wakeAt: null } }
      if (m.dueAt && Date.parse(m.dueAt) + 7 * 86_400_000 < now.getTime()) {
        return { say: null, patch: { status: 'expired', wakeAt: null, closedAt: now.toISOString(), note: 'scadenza passata senza conferma' } }
      }
      const say = `💳 *Sterling* · ${m.title}: non mi risulta ancora pagato.\n\n${paymentPack(notice)}\n\n*fatto ${m.code}* quando è andato. _[${m.code}]_`
      // Si ripassa il giorno della scadenza, poi basta.
      const again = m.dueAt && Date.parse(m.dueAt) - 13 * 3_600_000 > now.getTime() ? new Date(Date.parse(m.dueAt) - 13 * 3_600_000).toISOString() : null
      return { say, patch: { wakeAt: again } }
    }
    default:
      return { say: null, patch: { wakeAt: null } }
  }
}

/* ------------------------------------------------------------------ *
 * Le tue risposte
 * ------------------------------------------------------------------ */

const DONE = /^(fatto|fatta|done|pagato|pagata|risolto|ok fatto|ho fatto|chiudi)(?=$|[\s,.;:!?])/i
const CODE = /\b(?=[A-Z2-9]*\d)([A-HJ-NP-Z2-9]{4})\b/

/** "fatto 7F2A", "pagato" → la chiusura di un mandato; altrimenti null. */
export function parseDone(text: string): { code: string | null } | null {
  const t = text.trim().replace(/[.!]+$/, '')
  if (!DONE.test(t)) return null
  return { code: t.toUpperCase().match(CODE)?.[1] ?? null }
}

export type Outcome = { reply: string; patch: Partial<Mandate> | null; mandate: Mandate | null }

/**
 * A quale mandato si riferisce una risposta. Con il codice, a quello;
 * senza, solo se ce n'è uno solo che la aspetta — un "ok" detto alla
 * cosa sbagliata è un'azione sbagliata.
 */
export function resolve(code: string | null, candidates: Mandate[]): { match: Mandate | null; ambiguous: boolean } {
  if (code) return { match: candidates.find((m) => m.code === code) ?? null, ambiguous: false }
  if (candidates.length === 1) return { match: candidates[0], ambiguous: false }
  return { match: null, ambiguous: candidates.length > 1 }
}

function listLine(m: Mandate): string {
  return `• ${m.title} _[${m.code}]_`
}

/** "fatto X": si chiude. */
export function applyDone(code: string | null, open: Mandate[], now: Date): Outcome {
  const waiting = open.filter((m) => m.status === 'waiting' || m.status === 'approved')
  const { match, ambiguous } = resolve(code, waiting)
  if (!match) {
    if (ambiguous) return { reply: `Quale? Dimmi il codice:\n${waiting.map(listLine).join('\n')}`, patch: null, mandate: null }
    return { reply: code ? `Non trovo un mandato aperto con codice ${code}.` : 'Non c\'è niente in attesa da chiudere.', patch: null, mandate: null }
  }
  return {
    reply: `✔ Chiuso: ${match.title}.`,
    patch: { status: 'done', wakeAt: null, closedAt: now.toISOString() },
    mandate: match,
  }
}

/** "ok X" / "no X": una decisione su un mandato che aspettava il tuo ok. */
export function applyDecision(decision: Decision, open: Mandate[], now: Date): Outcome {
  const pending = open.filter((m) => m.status === 'proposed' && m.approval && !isExpired(m.approval, now))
  const { match, ambiguous } = resolve(decision.code, pending)
  if (!match) {
    if (ambiguous) return { reply: `Quale? Dimmi il codice:\n${pending.map(listLine).join('\n')}`, patch: null, mandate: null }
    return { reply: '', patch: null, mandate: null }
  }
  if (decision.decision === 'no') {
    return { reply: `Va bene, lascio stare: ${match.title}.`, patch: { status: 'declined', closedAt: now.toISOString() }, mandate: match }
  }
  const granted = { ...match.approval!, grantedAt: now.toISOString() }
  if (match.kind === 'invite') {
    const to = String(match.payload.to ?? '')
    const decline = String(match.payload.decline ?? '')
    return {
      reply: `Approvato. L'invio a nome tuo non è ancora acceso, quindi te lo lascio pronto${to ? ` per ${to}` : ''}:\n\n${decline}\n\n*fatto ${match.code}* quando l'hai mandato.`,
      patch: { status: 'approved', approval: granted },
      mandate: match,
    }
  }
  return { reply: `Approvato: ${match.title}.`, patch: { status: 'approved', approval: granted }, mandate: match }
}

/** La lista per il telefono: "mandati". */
export function renderMandates(open: Mandate[], now: Date): string {
  if (!open.length) return 'Nessun mandato aperto. Un volo, un avviso di pagamento o un invito nelle mail ne aprono uno da soli; "ricordami domani alle 9 …" pure.'
  const lines = ['*I mandati aperti*']
  for (const m of open) {
    const state =
      m.status === 'proposed' ? `aspetta il tuo *ok ${m.code}*` :
      m.status === 'approved' ? `approvato, *fatto ${m.code}* quando è chiuso` :
      m.wakeAt && Date.parse(m.wakeAt) > now.getTime() ? `mi faccio vivo il ${itWhen(m.wakeAt)}` :
      `*fatto ${m.code}* quando è chiuso`
    lines.push(`• ${m.title} — ${state}`)
  }
  return lines.join('\n')
}
