import { isBoardWorthSending, memoExcerpt, renderBoardText, type Board, type BoardClaim, type Memo, type Reply, type Stance, type Synthesis } from '../board'
import { verifyClaims } from '../cite'
import { BOARD_ORDER, EXECUTIVES, type ExecutiveKey } from '../executives'
import { listOpenPoints, logRun, recentDocuments, upcomingEvents } from '../memory'
import { runStructured } from '../model'
import { profileBlock, readProfile } from '../profile'
import { formatEuro } from '../reconcile'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type VerifiedClaim } from '../types'
import { reviewDeadlines } from './deadlines'
import { reviewInbox } from './inbox'
import { reviewLedger } from './ledger'
import { reviewPractice } from './practice'
import { radarSources } from './radar'
import { reviewSubscriptions } from './recurring'
import { reviewRelations } from './relations'
import { proposeSlots } from './slots'
import { trainingFacts } from './training'

/**
 * Il board.
 *
 * Cinque dirigenti, un titolare, tre giri di tavolo.
 *
 *   1. **Scrivanie.** Ogni dirigente consulta i suoi agenti
 *      deterministici — in parallelo, senza modello — e si ritrova
 *      davanti i fatti del suo mandato: numeri, liste, date.
 *   2. **Memo.** In parallelo, ognuno scrive il suo memo: al massimo
 *      quattro punti e le richieste ai colleghi, ogni riga con le fonti.
 *   3. **Repliche.** In parallelo, ognuno legge i memo degli altri —
 *      che sono fonti citabili come un documento — e risponde: accordo,
 *      obiezione, risposta a una richiesta. Un'obiezione deve citare i
 *      fatti della propria scrivania.
 *   4. **Sintesi.** Grace, capo di gabinetto, chiude: cosa il board ha
 *      deciso, cosa resta aperto (le obiezioni non si sciolgono
 *      nascondendole: restano scritte, firmate), cosa tocca al titolare.
 *
 * "Si parlano di continuo" vuol dire: ogni notte dopo la
 * sincronizzazione, e quando lo chiedi. Il verificatore passa su ogni
 * riga di ogni giro, memo compresi — un dirigente che cita un numero
 * che non sta nei fatti della sua scrivania viene scartato come
 * chiunque altro.
 */

export const BOARD_AGENT = 'board'

type Facts = Record<ExecutiveKey, SourceRef[]>

const nameOf = (key: string) => EXECUTIVES[key as ExecutiveKey]?.name ?? key

function calc(id: string, title: string, lines: string[]): SourceRef {
  return {
    handle: '',
    documentId: `calc:${id}`,
    source: 'calc',
    kind: 'note',
    title,
    occurredAt: new Date().toISOString(),
    url: null,
    excerpt: lines.filter(Boolean).join('\n') || '(niente da segnalare)',
  }
}

function day(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/* ------------------------------------------------------------------ *
 * 1. Le scrivanie
 * ------------------------------------------------------------------ */

async function graceFacts(owner: string): Promise<SourceRef[]> {
  const [inbox, deadlines, slots, points, events, training] = await Promise.all([
    reviewInbox(owner, 1).catch(() => null),
    reviewDeadlines(14).catch(() => null),
    proposeSlots({ days: 5 }).catch(() => null),
    listOpenPoints().catch(() => []),
    upcomingEvents(3, 20).catch(() => []),
    trainingFacts(28).catch(() => null),
  ])
  const out: SourceRef[] = []
  out.push(
    calc('agenda', 'Scrivania di Grace: agenda dei prossimi tre giorni', events.map((e) => `${day(e.occurredAt)} ${e.occurredAt.slice(11, 16)} UTC · ${e.title}${e.participants?.length ? ` · con ${e.participants.join(', ')}` : ''}`))
  )
  if (inbox) {
    out.push(
      calc('posta', 'Scrivania di Grace: chi aspetta una risposta', [
        `${inbox.rows.length} thread in cui l'ultima parola non è del titolare.`,
        ...inbox.rows.slice(0, 8).map((r) => `- ${r.title} · da ${r.from} · da ${r.ageDays} giorni${r.asks ? ' · chiede qualcosa' : ''}${r.direct ? '' : ' · in copia'}`),
      ])
    )
  }
  if (deadlines) {
    out.push(
      calc('scadenze', 'Scrivania di Grace: scadenze nei prossimi 14 giorni', [
        `${deadlines.rows.length} scadenze.`,
        ...deadlines.rows.slice(0, 10).map((r) => `- ${day(r.date)}${r.urgency === 'scaduta' ? ' (SCADUTA)' : ''} · ${r.label} · ${r.title}`),
      ])
    )
  }
  if (slots) out.push(calc('finestre', 'Scrivania di Grace: finestre libere nei prossimi 5 giorni', slots.slots.map((s) => `- ${s.label}`)))
  out.push(calc('punti', 'Scrivania di Grace: punti aperti', points.map((p) => `- ${p.text} (aperto il ${day(p.openedAt)})`)))
  if (training && training.summary.sessions) {
    out.push({ ...training.source, documentId: 'calc:allenamento', title: 'Scrivania di Grace: allenamento, riepilogo calcolato' })
  }
  return out
}

async function quinnFacts(owner: string): Promise<SourceRef[]> {
  const [practice, deadlines] = await Promise.all([reviewPractice(owner).catch(() => null), reviewDeadlines(45).catch(() => null)])
  const out: SourceRef[] = []
  if (practice) {
    out.push(
      calc('pratiche', 'Scrivania di Quinn: pratiche, ore stimate e fatture', [
        `${practice.matters.length} pratiche attive. Le ore sono una stima (incontri per durata, mail 10/5 minuti).`,
        ...practice.unbilled.slice(0, 6).map((m) => `- ORE SENZA FATTURA: ${m.label} · ${String(m.unbilledHours).replace('.', ',')} h stimate dall'ultima fattura${m.lastInvoiceAt ? ` del ${day(m.lastInvoiceAt)}` : ' (nessuna fattura in memoria)'}`),
        ...practice.withoutEngagement.slice(0, 6).map((m) => `- SENZA INCARICO: ${m.label} · ${m.touches} contatti, nessuna lettera di incarico in memoria`),
        ...practice.newContacts.slice(0, 6).map((m) => `- NOME NUOVO (controllo conflitti): ${m.label} · primo contatto ${day(m.firstTouchAt)}`),
      ])
    )
  }
  if (deadlines) {
    out.push(
      calc('termini', 'Scrivania di Quinn: termini e scadenze nei prossimi 45 giorni', [
        ...deadlines.rows.slice(0, 10).map((r) => `- ${day(r.date)}${r.urgency === 'scaduta' ? ' (SCADUTA)' : ''} · ${r.label} · ${r.title}`),
      ])
    )
  }
  return out
}

async function sterlingFacts(): Promise<SourceRef[]> {
  const [ledger, subs, tx] = await Promise.all([
    reviewLedger(60).catch(() => null),
    reviewSubscriptions(12).catch(() => null),
    recentDocuments(200, 'qonto').catch(() => []),
  ])
  const out: SourceRef[] = []
  const since30 = Date.now() - 30 * 86_400_000
  const since90 = Date.now() - 90 * 86_400_000
  const sum = (from: number, side: 'credit' | 'debit') =>
    tx
      .filter((d) => Date.parse(d.occurredAt) >= from && d.metadata?.side === side)
      .reduce((s, d) => s + Math.round(Math.abs(Number(d.metadata?.amount ?? 0)) * 100), 0)
  const top = new Map<string, number>()
  for (const d of tx.filter((d) => Date.parse(d.occurredAt) >= since90 && d.metadata?.side === 'credit')) {
    const k = String(d.metadata?.counterparty ?? '')
    top.set(k, (top.get(k) ?? 0) + Math.round(Math.abs(Number(d.metadata?.amount ?? 0)) * 100))
  }
  out.push(
    calc('cassa', 'Scrivania di Sterling: incassi e uscite', [
      `Ultimi 30 giorni: incassi € ${formatEuro(sum(since30, 'credit'))}, uscite € ${formatEuro(sum(since30, 'debit'))}.`,
      `Ultimi 90 giorni: incassi € ${formatEuro(sum(since90, 'credit'))}, uscite € ${formatEuro(sum(since90, 'debit'))}.`,
      'Chi ha pagato di più negli ultimi 90 giorni:',
      ...[...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `- ${k}: € ${formatEuro(v)}`),
    ])
  )
  if (ledger) {
    out.push(
      calc('giustificativi', 'Scrivania di Sterling: giustificativi mancanti', [
        `${ledger.missing} pagamenti senza giustificativo su ${ledger.examined} negli ultimi ${ledger.days} giorni, per € ${formatEuro(ledger.missingCents)}; ${ledger.resolvable} hanno già una fattura in memoria.`,
        ...ledger.rows.slice(0, 8).map((r) => `- ${day(r.transaction.occurredAt)} · ${r.transaction.label} · € ${formatEuro(r.transaction.amountCents)}`),
      ])
    )
  }
  if (subs) {
    out.push(
      calc('abbonamenti', 'Scrivania di Sterling: abbonamenti', [
        `${subs.subscriptions.length} abbonamenti per € ${formatEuro(subs.yearlyCents)} all'anno.`,
        ...subs.subscriptions.slice(0, 10).map((s) => `- ${s.label} · ${s.cadence} · € ${formatEuro(s.typicalCents)} · € ${formatEuro(s.yearlyCents)}/anno${s.increased ? ' · AUMENTATO' : ''}${s.overdue ? ' · forse finito' : ''}`),
      ])
    )
  }
  return out
}

async function archerFacts(owner: string): Promise<SourceRef[]> {
  const [relations, inbox, deadlines] = await Promise.all([
    reviewRelations(owner).catch(() => null),
    reviewInbox(owner, 1).catch(() => null),
    reviewDeadlines(60).catch(() => null),
  ])
  const out: SourceRef[] = []
  if (relations) {
    out.push(
      calc('relazioni', 'Scrivania di Archer: relazioni che si raffreddano e più attive', [
        `${relations.relations} relazioni; ${relations.cooling.length} si stanno raffreddando.`,
        ...relations.cooling.slice(0, 8).map((r) => `- SI RAFFREDDA: ${r.label} · silenzio da ${r.silenceDays} giorni · di solito ogni ${r.rhythmDays ?? '?'} · ${r.touches} contatti`),
        ...relations.active.slice(0, 6).map((r) => `- attiva: ${r.label} · ${r.touches} contatti · ultimo ${day(r.lastAt)}`),
      ])
    )
  }
  if (inbox) {
    const asks = inbox.rows.filter((r) => r.asks)
    out.push(calc('richieste', 'Scrivania di Archer: chi ha chiesto qualcosa e aspetta', asks.slice(0, 8).map((r) => `- ${r.title} · ${r.from} · da ${r.ageDays} giorni`)))
  }
  if (deadlines) {
    const commercial = deadlines.rows.filter((r) => r.kind === 'disdetta' || r.kind === 'rinnovo' || r.kind === 'scadenza')
    out.push(calc('contratti', 'Scrivania di Archer: contratti in scadenza o da rinnovare nei prossimi 60 giorni', commercial.slice(0, 8).map((r) => `- ${day(r.date)} · ${r.label} · ${r.title}`)))
  }
  return out
}

async function harperFacts(owner: string): Promise<SourceRef[]> {
  const [radar, relations] = await Promise.all([radarSources(7, 10).catch(() => null), reviewRelations(owner).catch(() => null)])
  const out: SourceRef[] = []
  if (relations) {
    out.push(calc('pubblico', 'Scrivania di Harper: con chi si parla di più', relations.active.slice(0, 8).map((r) => `- ${r.label} · ${r.touches} contatti`)))
  }
  if (radar) out.push(...radar.offered)
  return out
}

async function novaFacts(): Promise<SourceRef[]> {
  const radar = await radarSources(10, 12).catch(() => null)
  return radar ? radar.offered : []
}

/* ------------------------------------------------------------------ *
 * 2–4. Il tavolo
 * ------------------------------------------------------------------ */

const RULES = `REGOLE NON NEGOZIABILI
1. Ogni riga deve venire dalle FONTI e dichiarare da quali, con il loro handle (F1, F2…). Una riga senza handle valido viene scartata automaticamente.
2. Numeri, importi, date e nomi vanno copiati esattamente dalla fonte citata. Un controllo automatico li confronta.
3. Non usare conoscenze tue sul mondo o sulle persone. Se la tua scrivania non dice niente, scrivi poco: un memo corto e vero batte un memo lungo e gonfiato.
4. Parla da dirigente al titolare: italiano, frasi brevi, niente premesse, niente "come CFO ritengo".`

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${day(ref.occurredAt)}\nTitolo: ${ref.title}\n${ref.excerpt}`)
    .join('\n\n---\n\n')
}

function handles(refs: SourceRef[]): SourceRef[] {
  return refs.map((r, i) => ({ ...r, handle: `F${i + 1}` }))
}

function toBoardSources(claims: VerifiedClaim[]): BoardClaim[] {
  return claims.map((c) => ({
    text: c.text,
    unverified: c.unverified,
    sources: c.sources.map(({ handle, source, title, occurredAt, url }) => ({ handle, source, title, occurredAt, url })),
  }))
}

const MEMO_TOOL = {
  name: 'memo',
  description: 'Il memo del dirigente per il board: i punti del suo mandato e le richieste ai colleghi.',
  input_schema: {
    type: 'object' as const,
    properties: {
      punti: {
        type: 'array',
        description: 'Al massimo quattro. Ognuno: un fatto e cosa comporta, con le fonti.',
        items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] },
      },
      richieste: {
        type: 'array',
        description: 'Cosa chiedi a un collega perché il tuo mandato vada avanti. Solo se serve davvero. Al massimo due.',
        items: {
          type: 'object',
          properties: {
            a: { type: 'string', enum: BOARD_ORDER },
            text: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['a', 'text', 'sources'],
        },
      },
    },
    required: ['punti', 'richieste'],
  },
}

async function writeMemo(key: ExecutiveKey, facts: SourceRef[], today: string, profile: string, signal?: AbortSignal): Promise<Memo> {
  const exec = EXECUTIVES[key]
  const offered = handles(facts)
  if (!offered.length) return { executive: key, punti: [], richieste: [], model: 'nessuno', dropped: 0 }

  const colleagues = BOARD_ORDER.filter((k) => k !== key).map((k) => `${k} = ${EXECUTIVES[k].name}, ${EXECUTIVES[k].title}`).join('; ')
  // Memo e repliche vanno sul modello veloce: sono cinque chiamate in
  // parallelo per giro, e il board deve chiudersi in un paio di minuti.
  // La sintesi, che è una sola, va sul modello migliore.
  const { data, model } = await runStructured<{ punti?: RawClaim[]; richieste?: (RawClaim & { a?: string })[] }>({
    task: 'draft',
    system: `Sei ${exec.name}, ${exec.title} (${exec.role}) del titolare. Mandato: ${exec.mandate}\nCarattere: ${exec.persona}\n\nStai scrivendo il tuo memo per il board di oggi, ${today}. I colleghi: ${colleagues}.\n\n${RULES}${profile}`,
    user: ['FONTI (la tua scrivania)', '', formatSources(offered)].join('\n'),
    tool: MEMO_TOOL,
    signal,
  })
  const punti = verifyClaims(Array.isArray(data.punti) ? data.punti.slice(0, 4) : [], offered)
  const richieste: Memo['richieste'] = []
  let dropped = punti.dropped.length
  for (const r of Array.isArray(data.richieste) ? data.richieste.slice(0, 2) : []) {
    const a = BOARD_ORDER.find((k) => k === r.a && k !== key)
    const { claims } = verifyClaims([{ text: String(r.text ?? ''), sources: Array.isArray(r.sources) ? r.sources : [] }], offered)
    if (!a || !claims.length) {
      dropped += 1
      continue
    }
    richieste.push({ a, text: claims[0].text, sources: toBoardSources(claims)[0].sources })
  }
  return { executive: key, punti: toBoardSources(punti.claims), richieste, model, dropped }
}

function memoSource(memo: Memo): SourceRef {
  const exec = EXECUTIVES[memo.executive as ExecutiveKey]
  return {
    handle: '',
    documentId: `memo:${memo.executive}`,
    source: 'board',
    kind: 'note',
    title: `Memo di ${exec.name} (${exec.title})`,
    occurredAt: new Date().toISOString(),
    url: null,
    excerpt: memoExcerpt(memo, nameOf),
  }
}

const REPLY_TOOL = {
  name: 'replica',
  description: 'Le repliche del dirigente ai memo dei colleghi.',
  input_schema: {
    type: 'object' as const,
    properties: {
      risposte: {
        type: 'array',
        description: 'Al massimo quattro. "risposta" a una richiesta rivolta a te; "obiezione" dove i fatti della tua scrivania contraddicono un collega; "accordo" solo se cambia qualcosa; "richiesta" se da un memo nasce una cosa che ti serve.',
        items: {
          type: 'object',
          properties: {
            a: { type: 'string', enum: BOARD_ORDER },
            stance: { type: 'string', enum: ['accordo', 'obiezione', 'risposta', 'richiesta'] },
            text: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['a', 'stance', 'text', 'sources'],
        },
      },
    },
    required: ['risposte'],
  },
}

async function writeReplies(key: ExecutiveKey, facts: SourceRef[], memos: Memo[], today: string, profile: string, signal?: AbortSignal): Promise<Reply[]> {
  const exec = EXECUTIVES[key]
  const others = memos.filter((m) => m.executive !== key && (m.punti.length || m.richieste.length))
  if (!others.length) return []
  const offered = handles([...facts, ...others.map(memoSource)])
  const askedOfMe = others.flatMap((m) => m.richieste.filter((r) => r.a === key).map((r) => `${nameOf(m.executive)} ti chiede: ${r.text}`))

  const { data } = await runStructured<{ risposte?: (RawClaim & { a?: string; stance?: string })[] }>({
    task: 'draft',
    system: `Sei ${exec.name}, ${exec.title} (${exec.role}). Mandato: ${exec.mandate}\nCarattere: ${exec.persona}\n\nÈ il secondo giro del board di oggi, ${today}: hai letto i memo dei colleghi e rispondi. Un'obiezione vale solo se cita i fatti della TUA scrivania che contraddicono il collega. Rispondi sempre alle richieste rivolte a te.\n\n${RULES}${profile}`,
    user: [
      askedOfMe.length ? `RICHIESTE RIVOLTE A TE:\n${askedOfMe.map((a) => `- ${a}`).join('\n')}` : 'Nessuna richiesta rivolta a te.',
      '',
      'FONTI (la tua scrivania, poi i memo dei colleghi)',
      '',
      formatSources(offered),
    ].join('\n'),
    tool: REPLY_TOOL,
    signal,
  })

  const out: Reply[] = []
  for (const r of Array.isArray(data.risposte) ? data.risposte.slice(0, 4) : []) {
    const to = BOARD_ORDER.find((k) => k === r.a && k !== key)
    const stance = (['accordo', 'obiezione', 'risposta', 'richiesta'] as Stance[]).find((s) => s === r.stance) ?? 'risposta'
    const { claims } = verifyClaims([{ text: String(r.text ?? ''), sources: Array.isArray(r.sources) ? r.sources : [] }], offered)
    if (!to || !claims.length) continue
    out.push({ from: key, to, stance, text: claims[0].text, sources: toBoardSources(claims)[0].sources })
  }
  return out
}

const SYNTHESIS_TOOL = {
  name: 'sintesi',
  description: 'La chiusura del board, scritta dal capo di gabinetto per il titolare.',
  input_schema: {
    type: 'object' as const,
    properties: {
      decisioni: { type: 'array', description: 'Cosa il board ha deciso: solo dove nessuna obiezione è rimasta in piedi. Al massimo cinque.', items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] } },
      aperti: { type: 'array', description: 'I disaccordi rimasti, con i nomi: "Archer e Sterling non concordano su…". Non sciogliere tu quello che il board non ha sciolto.', items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] } },
      perTe: { type: 'array', description: 'Cosa tocca al titolare, al massimo tre mosse, ognuna con un verbo e, se c\'è, una data.', items: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } }, required: ['text', 'sources'] } },
    },
    required: ['decisioni', 'aperti', 'perTe'],
  },
}

async function synthesize(memos: Memo[], replies: Reply[], today: string, profile: string, signal?: AbortSignal): Promise<Synthesis> {
  const grace = EXECUTIVES.grace
  const replySources: SourceRef[] = BOARD_ORDER.filter((k) => replies.some((r) => r.from === k)).map((k) => ({
    handle: '',
    documentId: `repliche:${k}`,
    source: 'board',
    kind: 'note',
    title: `Repliche di ${EXECUTIVES[k].name}`,
    occurredAt: new Date().toISOString(),
    url: null,
    excerpt: replies.filter((r) => r.from === k).map((r) => `[${r.stance}] a ${nameOf(r.to)}: ${r.text}`).join('\n'),
  }))
  const offered = handles([...memos.filter((m) => m.punti.length || m.richieste.length).map(memoSource), ...replySources])
  if (!offered.length) return { decisioni: [], aperti: [], perTe: [], model: 'nessuno', dropped: 0 }

  const { data, model } = await runStructured<{ decisioni?: RawClaim[]; aperti?: RawClaim[]; perTe?: RawClaim[] }>({
    task: 'answer',
    system: `Sei ${grace.name}, ${grace.title}. Chiudi il board di oggi, ${today}, per il titolare: cosa è stato deciso, cosa resta aperto, cosa tocca a lui. I disaccordi non si sciolgono nascondendoli: restano scritti con i nomi.\n\n${RULES}${profile}`,
    user: ['FONTI (i memo e le repliche del board)', '', formatSources(offered)].join('\n'),
    tool: SYNTHESIS_TOOL,
    signal,
  })
  const decisioni = verifyClaims(Array.isArray(data.decisioni) ? data.decisioni.slice(0, 5) : [], offered)
  const aperti = verifyClaims(Array.isArray(data.aperti) ? data.aperti : [], offered)
  const perTe = verifyClaims(Array.isArray(data.perTe) ? data.perTe.slice(0, 3) : [], offered)
  return {
    decisioni: toBoardSources(decisioni.claims),
    aperti: toBoardSources(aperti.claims),
    perTe: toBoardSources(perTe.claims),
    model,
    dropped: decisioni.dropped.length + aperti.dropped.length + perTe.dropped.length,
  }
}

export type BoardRun = Board & { facts: Record<ExecutiveKey, number>; text: string; worthSending: boolean }

export async function runBoard(ownerEmail: string, signal?: AbortSignal): Promise<BoardRun> {
  const started = Date.now()
  const today = day(new Date().toISOString())
  const profile = profileBlock(await readProfile().catch(() => null))

  // 1. Le scrivanie, in parallelo e senza modello.
  const [grace, quinn, sterling, archer, harper, nova] = await Promise.all([
    graceFacts(ownerEmail),
    quinnFacts(ownerEmail),
    sterlingFacts(),
    archerFacts(ownerEmail),
    harperFacts(ownerEmail),
    novaFacts(),
  ])
  const facts: Facts = { grace, quinn, sterling, archer, harper, nova }

  // 2. I memo, in parallelo.
  const memos = await Promise.all(BOARD_ORDER.map((k) => writeMemo(k, facts[k], today, profile, signal)))

  // 3. Le repliche, in parallelo: ognuno legge gli altri.
  const replies = (await Promise.all(BOARD_ORDER.map((k) => writeReplies(k, facts[k], memos, today, profile, signal)))).flat()

  // 4. La sintesi.
  const synthesis = await synthesize(memos, replies, today, profile, signal)

  const board: Board = { generatedAt: new Date().toISOString(), memos, replies, synthesis }
  const run: BoardRun = {
    ...board,
    facts: { grace: grace.length, quinn: quinn.length, sterling: sterling.length, archer: archer.length, harper: harper.length, nova: nova.length },
    text: renderBoardText(board, nameOf),
    worthSending: isBoardWorthSending(board),
  }

  await logRun({
    agent: BOARD_AGENT,
    question: today,
    answer: run,
    model: synthesis.model,
    hits: memos.reduce((s, m) => s + m.punti.length, 0) + replies.length,
    latencyMs: Date.now() - started,
  })
  return run
}

export { nameOf as executiveName }
