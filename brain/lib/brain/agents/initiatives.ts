import { dayKey, inHowLong, pickInitiatives, weekKey, type Initiative } from '../initiatives'
import { EXECUTIVES } from '../executives'
import { logRun, recentDocuments, recentRuns, upcomingEvents } from '../memory'
import { deliverWhatsApp, webhookConfigured, whatsappConfigured } from '../notify'
import { selectSignals } from '../radar'
import { formatEuro } from '../reconcile'
import { reviewDeadlines } from './deadlines'
import { reviewInbox } from './inbox'
import { reviewLedger } from './ledger'
import { reviewPractice } from './practice'
import { reviewSubscriptions } from './recurring'
import { reviewRelations } from './relations'

/**
 * Le iniziative: i dirigenti che si fanno vivi.
 *
 * Ogni mezz'ora il polso (`/api/brain/cron/pulse`) sincronizza le fonti
 * e chiede a ogni dirigente se ha qualcosa da dire **adesso**. Le
 * regole su cosa vale la pena dire sono deterministiche — un incontro
 * fra due ore, una scadenza domani, un addebito senza fattura, una
 * relazione che tace da quaranta giorni — e il testo è formattato, non
 * generato: non c'è niente da inventare, e un "ti scrivo perché" deve
 * essere esatto. Il modello entra solo se rispondi ("agenda", una
 * domanda), e allora passa dal verificatore come sempre.
 *
 * Poi stanno zitti: una cosa si dice una volta, al massimo due per
 * dirigente e sei in tutto al giorno, mai di notte salvo urgenze.
 */

export const INITIATIVE_AGENT = 'initiative'

const SENT_WINDOW_DAYS = 45

function day(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function who(participants: string[] | undefined, owner: string): string {
  const others = (participants ?? []).filter((p) => p.toLowerCase() !== owner.toLowerCase())
  if (!others.length) return ''
  const names = others.slice(0, 3).map((e) => e.split('@')[0].replace(/[._-]+/g, ' '))
  return ` con ${names.join(', ')}${others.length > 3 ? ` e altri ${others.length - 3}` : ''}`
}

async function candidates(owner: string, now: Date): Promise<Initiative[]> {
  const out: Initiative[] = []
  const today = dayKey(now)
  const week = weekKey(now)
  const G = EXECUTIVES.grace.name
  const S = EXECUTIVES.sterling.name
  const A = EXECUTIVES.archer.name
  const H = EXECUTIVES.harper.name
  const N = EXECUTIVES.nova.name
  const Q = EXECUTIVES.quinn.name

  const [events, deadlines, inbox, ledger, subs, relations, web, oura, practice] = await Promise.all([
    upcomingEvents(1, 20).catch(() => []),
    reviewDeadlines(2).catch(() => null),
    reviewInbox(owner, 3).catch(() => null),
    reviewLedger(3).catch(() => null),
    reviewSubscriptions(12).catch(() => null),
    reviewRelations(owner).catch(() => null),
    recentDocuments(120, 'web').catch(() => []),
    recentDocuments(20, 'oura').catch(() => []),
    reviewPractice(owner).catch(() => null),
  ])

  // Grace: un incontro nelle prossime due ore.
  for (const e of events) {
    const minutes = (Date.parse(e.occurredAt) - now.getTime()) / 60_000
    if (minutes < 15 || minutes > 120) continue
    out.push({
      key: `meeting:${e.id}`,
      executive: 'grace',
      kind: 'meeting',
      urgent: true,
      weight: 100,
      text: `*${G}* · ${inHowLong(e.occurredAt, now)}: "${e.title}"${who(e.participants, owner)}. Rispondi *agenda* e te la preparo da quello che ci siamo già detti.`,
    })
  }

  // Grace: scadenze oggi e domani.
  for (const r of deadlines?.rows ?? []) {
    const isToday = r.date === today
    out.push({
      key: `deadline:${r.documentId}:${r.kind}:${r.date}`,
      executive: 'grace',
      kind: 'deadline',
      urgent: isToday,
      weight: isToday ? 95 : 80,
      text: `*${G}* · ${isToday ? 'Oggi' : r.urgency === 'scaduta' ? 'Scaduta il ' + day(r.date) + ':' : 'Domani'} ${isToday || r.urgency === 'scaduta' ? '' : 'scade: '}${r.label} — ${r.title}. _"${r.quote.slice(0, 160)}"_`,
    })
  }

  // Grace: qualcuno aspetta da tre giorni e ha chiesto qualcosa.
  for (const t of (inbox?.rows ?? []).filter((t) => t.direct && t.asks).slice(0, 3)) {
    out.push({
      key: `waiting:${t.threadId}:${t.lastAt.slice(0, 10)}`,
      executive: 'grace',
      kind: 'waiting',
      urgent: false,
      weight: 60 + Math.min(t.ageDays, 20),
      text: `*${G}* · ${t.from} aspetta una risposta da ${t.ageDays} giorni su "${t.title}". Vuoi una bozza? Scrivi *bozza ${t.title.slice(0, 40)}*.`,
    })
  }

  // Sterling: un addebito senza giustificativo negli ultimi due giorni.
  for (const r of (ledger?.rows ?? []).filter((r) => now.getTime() - Date.parse(r.transaction.occurredAt) < 2 * 86_400_000)) {
    out.push({
      key: `charge:${r.transaction.id}`,
      executive: 'sterling',
      kind: 'charge',
      urgent: false,
      weight: 50,
      text: `*${S}* · ${day(r.transaction.occurredAt)}: € ${formatEuro(r.transaction.amountCents)} a ${r.transaction.label}, senza giustificativo.${r.candidates[0] ? ` In memoria c'è una fattura che sembra corrispondere: "${r.candidates[0].title}".` : ' Quando arriva la fattura, allegala su Qonto.'}`,
    })
  }

  // Sterling: un abbonamento aumentato, o che sembra finito.
  for (const s of (subs?.subscriptions ?? []).filter((s) => s.increased || s.overdue)) {
    out.push({
      key: `subscription:${s.key}:${s.increased ? 'up' : 'off'}:${s.lastAt}`,
      executive: 'sterling',
      kind: 'subscription',
      urgent: false,
      weight: 40,
      text: s.increased
        ? `*${S}* · ${s.label} è salito: € ${formatEuro(s.lastCents)} contro i soliti € ${formatEuro(s.typicalCents)} (${s.cadence}). Fa € ${formatEuro(s.yearlyCents)} all'anno.`
        : `*${S}* · ${s.label} (${s.cadence}, € ${formatEuro(s.typicalCents)}) non passa dal ${day(s.lastAt)}: finito, o cambiato carta?`,
    })
  }

  // Archer: una relazione che si raffredda — una volta a settimana per relazione.
  for (const r of (relations?.cooling ?? []).slice(0, 3)) {
    out.push({
      key: `cooling:${r.key}:${week}`,
      executive: 'archer',
      kind: 'cooling',
      urgent: false,
      weight: 45 + Math.min(Math.round(r.silenceDays / 10), 20),
      text: `*${A}* · ${r.label}: silenzio da ${r.silenceDays} giorni, di solito vi sentivate ogni ${r.rhythmDays}. ${r.recent[0] ? `L'ultima cosa: "${r.recent[0].title}" (${day(r.recent[0].occurredAt)}).` : ''} Un messaggio oggi costa poco.`,
    })
  }

  // Quinn: ore senza fattura (una volta a settimana per cliente), nomi nuovi, incarichi mancanti.
  for (const m of (practice?.unbilled ?? []).slice(0, 2)) {
    out.push({
      key: `unbilled:${m.key}:${week}`,
      executive: 'quinn',
      kind: 'charge',
      urgent: false,
      weight: 48,
      text: `*${Q}* · ${m.label}: circa ${String(m.unbilledHours).replace('.', ',')} ore stimate${m.lastInvoiceAt ? ` dall'ultima fattura del ${day(m.lastInvoiceAt)}` : ', e nessuna fattura in memoria'}. È il momento di una nota spese o di un acconto?`,
    })
  }
  for (const m of (practice?.newContacts ?? []).slice(0, 2)) {
    out.push({
      key: `newcontact:${m.key}`,
      executive: 'quinn',
      kind: 'waiting',
      urgent: false,
      weight: 42,
      text: `*${Q}* · Nome nuovo: ${m.label} (primo contatto ${day(m.firstTouchAt)}). Prima di andare avanti: controllo conflitti e lettera di incarico.`,
    })
  }
  for (const m of (practice?.withoutEngagement ?? []).slice(0, 1)) {
    out.push({
      key: `engagement:${m.key}:${week}`,
      executive: 'quinn',
      kind: 'waiting',
      urgent: false,
      weight: 38,
      text: `*${Q}* · ${m.label}: ${m.touches} contatti e nessuna lettera di incarico in memoria. Se c'è, mettila su Drive; se non c'è, vale la pena farla firmare.`,
    })
  }

  // Harper e Nova: il segnale del giorno, uno a testa.
  const since = now.getTime() - 36 * 3_600_000
  const items = web.filter((d) => Date.parse(d.occurredAt) >= since).map((d) => ({ id: d.id, title: d.title, summary: d.body, occurredAt: d.occurredAt, url: d.url, host: String(d.metadata?.host ?? '') }))
  const signals = selectSignals(items, undefined, 6)
  const top = signals.find((s) => s.score >= 4)
  if (top) {
    out.push({
      key: `signal:${today}`,
      executive: 'harper',
      kind: 'signal',
      urgent: false,
      weight: 35,
      text: `*${H}* · Segnale del giorno: "${top.title}"${top.url ? `\n${top.url}` : ''}\nC'entra con: ${top.hits.slice(0, 4).join(', ')}. Se vuoi l'analisi, scrivi *@harper cosa cambia per noi*.`,
    })
  }
  const launch = signals.find((s) => /producthunt|product hunt/i.test(s.host) || /launch|lancia|releases?|announc/i.test(s.title))
  if (launch && launch !== top) {
    out.push({
      key: `launch:${today}`,
      executive: 'nova',
      kind: 'launch',
      urgent: false,
      weight: 30,
      text: `*${N}* · Prodotto nuovo: "${launch.title}"${launch.url ? `\n${launch.url}` : ''}\nVale un esperimento? Scrivi *@nova* e ti dico cosa proverei.`,
    })
  }

  // Grace: una giornata da prendere piano.
  const days = oura.filter((d) => d.externalId.startsWith('day:'))
  const todayDoc = days.find((d) => d.externalId === `day:${today}`)
  const readiness = typeof todayDoc?.metadata?.readinessScore === 'number' ? todayDoc.metadata.readinessScore : null
  const others = days.filter((d) => d !== todayDoc).map((d) => d.metadata?.readinessScore).filter((v): v is number => typeof v === 'number')
  if (readiness !== null && others.length >= 5) {
    const avg = others.reduce((s, v) => s + v, 0) / others.length
    if (readiness < 60 && readiness < avg - 12) {
      out.push({
        key: `readiness:${today}`,
        executive: 'grace',
        kind: 'readiness',
        urgent: false,
        weight: 55,
        text: `*${G}* · Prontezza a ${readiness} stamattina, contro una media di ${Math.round(avg)}. Giornata da prendere piano: se puoi, niente di pesante prima delle 15.`,
      })
    }
  }

  return out
}

export type PulseReport = {
  candidates: number
  sent: Initiative[]
  held: number
  channel: 'whatsapp' | 'webhook' | 'console'
}

/** Il polso: cosa hanno da dire i dirigenti adesso, e lo dicono. */
export async function pulse(owner: string, now = new Date()): Promise<PulseReport> {
  const started = Date.now()
  const all = await candidates(owner, now)

  const sinceIso = new Date(now.getTime() - SENT_WINDOW_DAYS * 86_400_000).toISOString()
  const already = new Set((await recentRuns(INITIATIVE_AGENT, sinceIso, 500)).map((r) => r.question))

  const budget = Number(process.env.BRAIN_PULSE_BUDGET ?? 6)
  const chosen = pickInitiatives(all, { now, sent: already, total: Number.isFinite(budget) && budget > 0 ? budget : 6 })

  const channel: PulseReport['channel'] = whatsappConfigured() ? 'whatsapp' : webhookConfigured() ? 'webhook' : 'console'
  const sent: Initiative[] = []
  for (const i of chosen) {
    let delivered: unknown = { channel: 'console' }
    if (channel === 'whatsapp') delivered = await deliverWhatsApp(i.text, i.text.replace(/\s+/g, ' ').slice(0, 900))
    else if (channel === 'webhook') {
      delivered = await fetch(process.env.BRAIN_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: i.text, initiative: i }),
      }).then((r) => ({ channel: 'webhook', ok: r.ok })).catch((err) => ({ channel: 'webhook', ok: false, detail: (err as Error).message }))
    }
    // La chiave va nel registro anche se la consegna fallisce: meglio una
    // cosa non detta che la stessa cosa ripetuta a ogni giro.
    await logRun({ agent: INITIATIVE_AGENT, question: i.key, answer: { ...i, delivered, channel }, model: null, hits: 1, latencyMs: Date.now() - started })
    sent.push(i)
  }

  return { candidates: all.length, sent, held: all.length - sent.length, channel }
}
