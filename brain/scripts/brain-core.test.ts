// Test del nucleo deterministico di BRAIN. Zero dipendenze: `npm run test:brain`.
import assert from 'node:assert/strict'
import { chunkDocument, chunkText, normalizeText } from '../lib/brain/chunk.ts'
import { fold, queryTerms, rankHits, recencyWeight, selectSources, toFtsQuery } from '../lib/brain/rank.ts'
import { extractFacts, parseHandles, verifyClaims } from '../lib/brain/cite.ts'
import { pickModel } from '../lib/brain/orchestrator.ts'
import { isAuthorizedCron } from '../lib/brain/cron.ts'
import { matchQuote, normalizeForMatch, tokenize } from '../lib/brain/quote.ts'
import { assessExtraction } from '../lib/brain/pdf.ts'
import { isWorthSending, renderBriefEmail, type MailBrief } from '../lib/brain/briefmail.ts'
import { describeSearch, expandedQuery, mergeTerms, shouldExpand } from '../lib/brain/expand.ts'
import {
  average,
  explainWorst,
  isLate,
  previousDay,
  summarize,
  trend,
  worstDays,
  type HealthDay,
} from '../lib/brain/health.ts'
import {
  addMonths,
  contractDeadlines,
  explicitDeadlines,
  findDates,
  selectDeadlines,
  urgency,
} from '../lib/brain/deadlines.ts'
import { asksSomething, isNoise, recipientsOf, senderOf, waitingOnMe, type MailLike } from '../lib/brain/inbox.ts'
import { freeSlots, parseWhen, proposalText, romeParts } from '../lib/brain/slots.ts'
import { cadenceOf, chargeKey, findSubscriptions, yearlyTotal } from '../lib/brain/recurring.ts'
import { buildRelations, cooling, isNoiseAddress, mostActive, relationKey } from '../lib/brain/relations.ts'
import { decodeEntities, parseFeed, stripHtml } from '../lib/brain/feeds.ts'
import { amountVisible, approvalCode, canActOn, isPaymentAction, isSensitiveField, matchPending, newApproval, parseDecision, payCapCents, registrableDomain, requiresApproval, withinCap } from '../lib/brain/policy.ts'
import { checkinPlan, findPnr, nextAttempt, parseFlight } from '../lib/brain/travel.ts'
import { findIban, formatIban, parsePaymentNotice, paymentPack, validIban } from '../lib/brain/payments.ts'
import { conflicts, declineText, isInvitation, parseInvitation } from '../lib/brain/invites.ts'
import { buildMime, encodeHeader, toBase64Url } from '../lib/brain/mime.ts'
import { parseCommand, parseWhen as parseWhenCmd } from '../lib/brain/mandates.ts'
import { deflateRawSync } from 'node:zlib'
import { docxToText, readZip, textFromDocumentXml } from '../lib/brain/docx.ts'
import { buildMatters, estimateMinutes, matterKey, matterTokens, newContacts, unbilled, withoutEngagement, type TouchLike } from '../lib/brain/practice.ts'
import { inHowLong, isQuietHour, pickInitiatives, weekKey, type Initiative } from '../lib/brain/initiatives.ts'
import { createHmac } from 'node:crypto'
import { answerToText, chunkText as chunkForPhone, compactLine, parseInbound, routeMessage, sameNumber, verifySignature } from '../lib/brain/whatsapp.ts'
import { isBoardWorthSending, memoExcerpt, objections, renderBoardText, repliesTo, threads, type Board } from '../lib/brain/board.ts'
import { DEFAULT_TOPICS, sameStory, scoreItem, selectSignals } from '../lib/brain/radar.ts'
import { intensityMix, longestStreak, summarize as summarizeTraining, weekOf, weeklyLoad, type TrainingDay } from '../lib/brain/training.ts'
import {
  attendees,
  callKey,
  classifyMeetDoc,
  isSamePerson,
  meetingDay,
  meetingTime,
  meetingTitle,
  parseNotes,
  parseTurns,
  pickEvent,
  renderFollowUp,
  segment,
  speakerShares,
} from '../lib/brain/transcript.ts'
import {
  addressesOf,
  displayPerson,
  extractPeople,
  matchesParticipant,
  tokensFromEmail,
  tokensFromName,
} from '../lib/brain/people.ts'
import {
  correctionBody,
  correctionKey,
  correctionTitle,
  validateCorrection,
} from '../lib/brain/correction.ts'
import {
  ageInDays,
  decidePoints,
  fingerprint,
  matchExisting,
  similarity,
  sortByAge,
  staleness,
  type OpenPointLike,
} from '../lib/brain/openpoints.ts'
import {
  findInvoice,
  nameTokens,
  parseAmount,
  parseAmounts,
  reconcile,
  formatDay,
  formatEuro,
  requestInvoiceText,
  type DocLike,
  type TxLike,
} from '../lib/brain/reconcile.ts'
import type { SearchHit, SourceRef } from '../lib/brain/types.ts'

// Riferimento fisso: martedì 15 settembre 2026, 10:00 UTC.
const NOW = new Date('2026-09-15T10:00:00Z')

let passed = 0
let failed = 0

function check(name: string, fn: () => void) {
  try {
    fn()
    passed++
  } catch (err) {
    failed++
    console.error(`✗ ${name}\n  ${(err as Error).message.split('\n')[0]}`)
  }
}

function hit(partial: Partial<SearchHit> & { content: string }): SearchHit {
  return {
    chunkId: Math.floor(Math.random() * 1e6),
    documentId: partial.documentId ?? 'doc-' + Math.random().toString(36).slice(2),
    idx: 0,
    rank: 0.5,
    source: 'gmail',
    kind: 'email',
    title: '',
    occurredAt: '2026-09-14T09:00:00Z',
    url: null,
    participants: [],
    ...partial,
  }
}

function ref(partial: Partial<SourceRef> & { handle: string; excerpt: string }): SourceRef {
  return {
    documentId: 'doc-' + partial.handle,
    source: 'gmail',
    kind: 'email',
    title: '',
    occurredAt: '2026-09-14T09:00:00Z',
    url: null,
    ...partial,
  }
}

/* --- spezzettamento --- */

check('normalizzare non cambia il contenuto, solo gli spazi', () => {
  assert.equal(normalizeText('  a\r\n\r\n\r\n  b  '), 'a\n\nb')
})

check('un testo corto resta un pezzo solo', () => {
  const chunks = chunkText('Ciao, ci vediamo domani.')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].idx, 0)
})

check('i tagli seguono i paragrafi e restano sotto al massimo', () => {
  const paragraph = 'Frase di prova lunga abbastanza da contare. '.repeat(10).trim()
  const chunks = chunkText([paragraph, paragraph, paragraph].join('\n\n'), { max: 500, overlap: 0 })
  assert.ok(chunks.length >= 3, `attesi >=3 pezzi, ricevuti ${chunks.length}`)
  for (const c of chunks) assert.ok(c.content.length <= 500, `pezzo da ${c.content.length}`)
})

check('un paragrafo più lungo del massimo viene tagliato lo stesso', () => {
  const chunks = chunkText('x'.repeat(2000), { max: 400, overlap: 0 })
  assert.ok(chunks.length >= 5)
  for (const c of chunks) assert.ok(c.content.length <= 400)
})

check('la sovrapposizione riporta la coda del pezzo precedente', () => {
  const a = 'Alfa '.repeat(80).trim()
  const b = 'Beta '.repeat(80).trim()
  const chunks = chunkText(`${a}\n\n${b}`, { max: 420, overlap: 60 })
  assert.ok(chunks.length >= 2)
  assert.ok(chunks[1].content.startsWith('Alfa'), 'il secondo pezzo non riparte dalla coda del primo')
})

check('il titolo entra nel primo pezzo: si cerca anche per oggetto', () => {
  const chunks = chunkDocument('Rinnovo contratto Rossi', 'Confermiamo per gennaio.')
  assert.ok(chunks[0].content.startsWith('Rinnovo contratto Rossi'))
})

check('un documento senza corpo resta cercabile per titolo', () => {
  const chunks = chunkDocument('Bonifico a Studio Bianchi', '')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].content, 'Bonifico a Studio Bianchi')
})

/* --- termini e ranking --- */

check('gli accenti non cambiano il peso di una parola', () => {
  assert.equal(fold('Però'), 'pero')
})

check('le parole vuote non finiscono fra i termini', () => {
  const terms = queryTerms('Che cosa ha detto Rossi sul contratto?')
  assert.ok(terms.includes('rossi'))
  assert.ok(terms.includes('contratto'))
  assert.ok(!terms.includes('che'))
  assert.ok(!terms.includes('cosa'))
})

check('un indirizzo email sopravvive come termine unico', () => {
  assert.ok(queryTerms('scrivi a mario.rossi@studio.it').includes('mario.rossi@studio.it'))
})

check('la freschezza dimezza a ogni emivita e non arriva mai a zero', () => {
  const oggi = recencyWeight('2026-09-15T10:00:00Z', NOW, 90)
  const tre_mesi = recencyWeight('2026-06-17T10:00:00Z', NOW, 90)
  const dieci_anni = recencyWeight('2016-09-15T10:00:00Z', NOW, 90)
  assert.ok(oggi > 0.99)
  assert.ok(Math.abs(tre_mesi - 0.5) < 0.05, `atteso ~0.5, ricevuto ${tre_mesi}`)
  assert.ok(dieci_anni > 0, 'la memoria vecchia non deve sparire del tutto')
  assert.ok(dieci_anni < 0.06)
})

check('a parità di parole vince il documento più recente', () => {
  const vecchio = hit({ content: 'accordo di riservatezza con Rossi', occurredAt: '2019-01-10T09:00:00Z' })
  const nuovo = hit({ content: 'accordo di riservatezza con Rossi', occurredAt: '2026-09-10T09:00:00Z' })
  const ranked = rankHits([vecchio, nuovo], 'accordo riservatezza Rossi', { now: NOW })
  assert.equal(ranked[0].documentId, nuovo.documentId)
})

check('chi è nominato nella domanda porta avanti il suo documento', () => {
  const generico = hit({ content: 'aggiornamento sul progetto', rank: 0.9, occurredAt: '2026-09-14T09:00:00Z' })
  const conPersona = hit({
    content: 'aggiornamento sul progetto',
    rank: 0.45,
    occurredAt: '2026-09-14T09:00:00Z',
    participants: ['giulia.bianchi@example.com'],
  })
  const ranked = rankHits([generico, conPersona], 'progetto con Giulia', { now: NOW })
  assert.equal(ranked[0].documentId, conPersona.documentId)
})

check('un documento compare una volta sola, con i suoi pezzi uniti', () => {
  const a1 = hit({ documentId: 'doc-a', idx: 0, content: 'prima parte del contratto' })
  const a2 = hit({ documentId: 'doc-a', idx: 1, content: 'seconda parte del contratto' })
  const b = hit({ documentId: 'doc-b', idx: 0, content: 'contratto diverso' })
  const sources = selectSources(rankHits([a1, a2, b], 'contratto', { now: NOW }))
  assert.equal(sources.length, 2)
  assert.deepEqual(sources.map((s) => s.handle), ['F1', 'F2'])
  const docA = sources.find((s) => s.documentId === 'doc-a')!
  assert.match(docA.excerpt, /prima parte/)
  assert.match(docA.excerpt, /seconda parte/)
})

check('gli handle sono progressivi e senza buchi', () => {
  const hits = Array.from({ length: 5 }, (_, i) => hit({ documentId: `doc-${i}`, content: 'contratto' }))
  const sources = selectSources(rankHits(hits, 'contratto', { now: NOW }), { maxDocuments: 3 })
  assert.deepEqual(sources.map((s) => s.handle), ['F1', 'F2', 'F3'])
})

check('la domanda diventa un OR, altrimenti Postgres cerca tutte le parole insieme', () => {
  assert.equal(toFtsQuery('cosa ha detto Rossi sul rinnovo'), 'detto or rossi or rinnovo')
})

check('una domanda fatta di sole parole vuote non produce interrogazione', () => {
  assert.equal(toFtsQuery('che cosa?'), '')
})

check('gli apici non entrano nell\'interrogazione full-text', () => {
  assert.ok(!toFtsQuery(`contratto "Rossi"`).includes('"'))
})

/* --- verifica delle citazioni: la regola che regge il prodotto --- */

check('un\'affermazione senza fonte valida non viene mostrata', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Confermiamo la riunione.' })]
  const out = verifyClaims([{ text: 'Rossi ha accettato la proposta.', sources: [] }], refs)
  assert.equal(out.claims.length, 0)
  assert.equal(out.dropped.length, 1)
})

check('un handle inventato non salva l\'affermazione', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Confermiamo la riunione.' })]
  const out = verifyClaims([{ text: 'Il contratto è firmato.', sources: ['F7'] }], refs)
  assert.equal(out.claims.length, 0)
  assert.equal(out.dropped[0].sources[0], 'F7')
})

check('fra handle veri e inventati restano solo quelli veri', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Confermiamo la riunione.' })]
  const out = verifyClaims([{ text: 'La riunione è confermata.', sources: ['F1', 'F9'] }], refs)
  assert.equal(out.claims.length, 1)
  assert.deepEqual(out.claims[0].sources.map((s) => s.handle), ['F1'])
})

check('gli handle si leggono anche fra parentesi quadre o minuscoli', () => {
  assert.deepEqual(parseHandles(['[F1]', 'f3']), ['F1', 'F3'])
  assert.deepEqual(parseHandles('vedi F2 e F10'), ['F2', 'F10'])
})

check('un importo che c\'è nella fonte passa il controllo', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Fattura 2026/114 da 1.250,00 euro.' })]
  const out = verifyClaims([{ text: 'La fattura è di 1.250,00 euro.', sources: ['F1'] }], refs)
  assert.equal(out.claims[0].trust, 'verified')
  assert.deepEqual(out.claims[0].unverified, [])
})

check('un importo che nella fonte non c\'è viene marcato, non nascosto', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Fattura 2026/114 da 1.250,00 euro.' })]
  const out = verifyClaims([{ text: 'La fattura è di 2.500,00 euro.', sources: ['F1'] }], refs)
  assert.equal(out.claims.length, 1)
  assert.equal(out.claims[0].trust, 'unchecked-detail')
  assert.ok(out.claims[0].unverified.includes('2.500,00'))
})

check('un IBAN diverso da quello della fonte non passa', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Accredito su IT60X0542811101000000123456.' })]
  const ok = verifyClaims([{ text: 'Bonifico a IT60X0542811101000000123456.', sources: ['F1'] }], refs)
  assert.equal(ok.claims[0].trust, 'verified')
  const ko = verifyClaims([{ text: 'Bonifico a IT60X0542811101000009123456.', sources: ['F1'] }], refs)
  assert.equal(ko.claims[0].trust, 'unchecked-detail')
})

check('un indirizzo email inventato viene marcato', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Scrive mario.rossi@studio.it.' })]
  const ok = verifyClaims([{ text: 'Rispondere a mario.rossi@studio.it.', sources: ['F1'] }], refs)
  assert.equal(ok.claims[0].trust, 'verified')
  const ko = verifyClaims([{ text: 'Rispondere a mario.rossi@studiolegale.it.', sources: ['F1'] }], refs)
  assert.equal(ko.claims[0].trust, 'unchecked-detail')
})

check('la data del documento vale come fonte della data citata', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Ci sentiamo presto.', occurredAt: '2026-03-12T08:30:00Z' })]
  const out = verifyClaims([{ text: 'Il 12/03/2026 hai scritto che vi sareste sentiti.', sources: ['F1'] }], refs)
  assert.equal(out.claims[0].trust, 'verified')
})

check('un orario presente nella fonte passa il controllo', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Appuntamento alle 14:30 in studio.' })]
  const out = verifyClaims([{ text: 'Sei atteso alle 14:30.', sources: ['F1'] }], refs)
  assert.equal(out.claims[0].trust, 'verified')
})

check('i numeri corti non fanno rumore', () => {
  const refs = [ref({ handle: 'F1', excerpt: 'Servono due copie del documento.' })]
  const out = verifyClaims([{ text: 'Servono 2 copie.', sources: ['F1'] }], refs)
  assert.deepEqual(out.claims[0].unverified, [])
})

check('i dettagli si controllano solo sulle fonti citate, non su tutte', () => {
  const refs = [
    ref({ handle: 'F1', excerpt: 'Preventivo da 900,00 euro.' }),
    ref({ handle: 'F2', excerpt: 'Preventivo da 4.800,00 euro.' }),
  ]
  const out = verifyClaims([{ text: 'Il preventivo è di 4.800,00 euro.', sources: ['F1'] }], refs)
  assert.equal(out.claims[0].trust, 'unchecked-detail', 'un numero preso da un altro documento non deve passare')
})

check('extractFacts non conta due volte i numeri dentro a un IBAN', () => {
  const facts = extractFacts('Bonifico su IT60X0542811101000000123456 da 300,00 euro.')
  assert.equal(facts.filter((f) => f.kind === 'iban').length, 1)
  assert.equal(facts.filter((f) => f.kind === 'number').length, 1)
})

check('un\'affermazione vuota viene ignorata senza rumore', () => {
  const out = verifyClaims([{ text: '   ', sources: ['F1'] }], [ref({ handle: 'F1', excerpt: 'x' })])
  assert.equal(out.claims.length, 0)
  assert.equal(out.dropped.length, 0)
})

/* --- orchestrator --- */

check('senza chiavi non si sceglie nessun modello', () => {
  assert.equal(pickModel('answer', {}), null)
})

check('per ragionare sulla memoria si sceglie il modello grande', () => {
  const chosen = pickModel('answer', { anthropic: true })
  assert.equal(chosen?.provider, 'anthropic')
  assert.equal(chosen?.model, 'claude-opus-5')
})

check('per estrarre si sceglie il modello veloce', () => {
  assert.equal(pickModel('extract', { anthropic: true })?.model, 'claude-haiku-4-5-20251001')
})

check('se il provider preferito manca si scende al successivo disponibile', () => {
  const chosen = pickModel('answer', { openai: true })
  assert.equal(chosen?.provider, 'openai')
})

/* --- citazioni testuali: una clausola che non c'è non si analizza --- */

const CONTRATTO = `8.1 Il presente contratto ha durata di 24 (ventiquattro) mesi.
8.2 Ciascuna parte può recedere con preavviso scritto di 30 (trenta) giorni,
da inviarsi a mezzo PEC all'indirizzo indicato in epigrafe.
9.1 Il Fornitore risponde dei danni nei limiti del corrispettivo annuo.`

check('una citazione testuale viene ritrovata', () => {
  const m = matchQuote('preavviso scritto di 30 (trenta) giorni', CONTRATTO)
  assert.equal(m.status, 'exact')
  assert.equal(m.coverage, 1)
})

check('una clausola che nel contratto non c\'è risulta mancante', () => {
  const m = matchQuote('il Cliente rinuncia a ogni azione di rivalsa', CONTRATTO)
  assert.equal(m.status, 'missing')
  assert.equal(m.matched, '')
})

check('gli a capo in mezzo alla frase non fanno fallire il confronto', () => {
  const m = matchQuote('preavviso scritto di 30 (trenta) giorni, da inviarsi a mezzo PEC', CONTRATTO)
  assert.equal(m.status, 'exact')
})

check('virgolette tipografiche e trattini lunghi vengono normalizzati', () => {
  assert.equal(normalizeForMatch('\u201cRecesso\u201d \u2014 30\u00a0giorni'), '"recesso" - 30 giorni')
  assert.equal(normalizeForMatch('pre\u00adavviso'), 'preavviso')
})

check('la punteggiatura NON viene ignorata: in un contratto una virgola pesa', () => {
  assert.ok(normalizeForMatch('durata di 24 (ventiquattro) mesi.').includes('('))
})

check('una citazione quasi giusta è parziale, non esatta e non inventata', () => {
  const m = matchQuote('ciascuna parte può recedere con preavviso scritto di 15 giorni', CONTRATTO)
  assert.equal(m.status, 'partial')
  assert.ok(m.coverage >= 0.6, `copertura ${m.coverage}`)
  assert.equal(m.matched, 'ciascuna parte può recedere con preavviso scritto di')
})

check('poche parole in comune non bastano a far passare una citazione', () => {
  const m = matchQuote('il contratto di durata', CONTRATTO)
  assert.equal(m.status, 'missing')
})

check('una citazione vuota non passa per distrazione', () => {
  assert.equal(matchQuote('   ', CONTRATTO).status, 'missing')
  assert.equal(matchQuote('...', CONTRATTO).status, 'missing')
})

check('tokenize tiene i numeri e butta la punteggiatura', () => {
  assert.deepEqual(tokenize('24 (ventiquattro) mesi.'), ['24', 'ventiquattro', 'mesi'])
})

/* --- salute: una media è una media, una pendenza è una pendenza --- */

function hd(day: string, sleep: number | null, readiness: number | null = sleep, activity: number | null = sleep): HealthDay {
  return { day, sleep, readiness, activity }
}

check('la media ignora i giorni senza dato invece di contarli come zero', () => {
  assert.equal(average([80, null, 70]), 75)
  assert.equal(average([null, null]), null)
})

check('la tendenza sale, scende o sta ferma secondo la pendenza', () => {
  const su = [60, 64, 68, 72, 76, 80].map((v, i) => hd(`2026-09-0${i + 1}`, v))
  const giu = [80, 76, 72, 68, 64, 60].map((v, i) => hd(`2026-09-0${i + 1}`, v))
  const ferma = [70, 72, 69, 71, 70, 72].map((v, i) => hd(`2026-09-0${i + 1}`, v))
  assert.equal(trend(su, 'sleep'), 'in miglioramento')
  assert.equal(trend(giu, 'sleep'), 'in peggioramento')
  assert.equal(trend(ferma, 'sleep'), 'stabile')
})

check('con meno di quattro giorni non si parla di tendenza', () => {
  const tre = [50, 70, 90].map((v, i) => hd(`2026-09-0${i + 1}`, v))
  assert.equal(trend(tre, 'sleep'), 'stabile')
})

check('un\'oscillazione di due punti non è una tendenza', () => {
  const rumore = [70, 71, 70, 72, 71, 72].map((v, i) => hd(`2026-09-0${i + 1}`, v))
  assert.equal(trend(rumore, 'sleep'), 'stabile')
})

check('i giorni peggiori sono i più bassi, e i giorni vuoti non entrano', () => {
  const giorni = [hd('2026-09-01', 80), hd('2026-09-02', null), hd('2026-09-03', 55), hd('2026-09-04', 62)]
  const w = worstDays(giorni, 'sleep', 2)
  assert.deepEqual(w.map((d) => d.day), ['2026-09-03', '2026-09-04'])
})

check('il riassunto separa gli ultimi sette dal prima, per il confronto', () => {
  const giorni = Array.from({ length: 14 }, (_, i) =>
    hd(`2026-09-${String(i + 1).padStart(2, '0')}`, i < 7 ? 60 : 80)
  )
  const s = summarize(giorni)
  const sonno = s.metrics.find((m) => m.metric === 'sleep')!
  assert.equal(sonno.earlier, 60)
  assert.equal(sonno.recent, 80)
  assert.equal(sonno.samples, 14)
  assert.equal(s.from, '2026-09-01')
  assert.equal(s.to, '2026-09-14')
})

check('il giorno prima si calcola anche a cavallo del mese', () => {
  assert.equal(previousDay('2026-09-01'), '2026-08-31')
  assert.equal(previousDay('2026-01-01'), '2025-12-31')
})

check('la prontezza bassa viene affiancata a cosa c\'era il giorno prima', () => {
  const giorni = [hd('2026-09-10', 80, 82), hd('2026-09-11', 70, 55), hd('2026-09-12', 75, 78)]
  const agenda = [{ day: '2026-09-10', events: ['Cena con il cliente'], lateEnd: true }]
  const c = explainWorst(giorni, agenda, 1)
  assert.equal(c[0].day, '2026-09-11')
  assert.equal(c[0].readiness, 55)
  assert.deepEqual(c[0].before?.events, ['Cena con il cliente'])
  assert.equal(c[0].before?.lateEnd, true)
})

check('senza niente in agenda il giorno prima, lo si dice invece di inventare', () => {
  const giorni = [hd('2026-09-11', 70, 55)]
  assert.equal(explainWorst(giorni, [], 1)[0].before, null)
})

check('"tardi" è dopo le 21 in ora italiana, estate e inverno', () => {
  assert.equal(isLate('2026-07-10T19:30:00Z'), true)  // 21:30 a Roma d'estate
  assert.equal(isLate('2026-07-10T18:30:00Z'), false) // 20:30
  assert.equal(isLate('2026-01-10T20:30:00Z'), true)  // 21:30 d'inverno
  assert.equal(isLate('2026-01-10T19:30:00Z'), false) // 20:30
})

/* --- persone: chi era nella stanza è un fatto, non una ricerca --- */

check('da un indirizzo escono nome e cognome, non il dominio', () => {
  assert.deepEqual(tokensFromEmail('giulia.bianchi@studiobianchi.it'), ['giulia', 'bianchi'])
})

check('una casella generica non identifica nessuno', () => {
  assert.deepEqual(tokensFromEmail('amministrazione@studiobianchi.it'), [])
  assert.deepEqual(tokensFromEmail('noreply@acme.com'), [])
})

check('nome scritto per esteso e indirizzo sono la stessa persona', () => {
  const [persona] = extractPeople('Ho parlato con Giulia Bianchi ieri.')
  assert.ok(persona)
  assert.ok(matchesParticipant(persona, 'giulia.bianchi@studiobianchi.it'))
})

check('un omonimo parziale non aggancia', () => {
  const [persona] = extractPeople('Ho parlato con Giulia Bianchi ieri.')
  assert.equal(matchesParticipant(persona, 'marco.bianchi@studiobianchi.it'), false)
  assert.equal(matchesParticipant(persona, 'giulia.verdi@altro.it'), false)
})

check('un indirizzo uguale è certezza, senza bisogno del nome', () => {
  const persona = { email: 'g.b@x.it', tokens: [] }
  assert.equal(matchesParticipant(persona, 'G.B@X.it'), true)
})

check('una parola maiuscola sola non diventa una persona', () => {
  // Altrimenti ogni inizio di frase italiana sarebbe un cognome.
  assert.deepEqual(extractPeople('Domani vediamo. Bianchi ha scritto.').filter((p) => !p.email), [])
})

check('gli indirizzi si estraggono anche in mezzo al testo', () => {
  const people = extractPeople('scrivi a mario.rossi@studio.it e in copia a g.verdi@altro.it')
  assert.deepEqual(addressesOf(people).sort(), ['g.verdi@altro.it', 'mario.rossi@studio.it'])
})

check('gli accenti non separano la stessa persona', () => {
  assert.deepEqual(tokensFromName('Niccolò Dallè'), ['niccolo', 'dalle'])
})

check('una persona si scrive in modo leggibile in un\'intestazione', () => {
  assert.equal(displayPerson({ email: 'giulia.bianchi@x.it', tokens: ['giulia', 'bianchi'] }), 'Giulia Bianchi')
  assert.equal(displayPerson({ email: 'info@x.it', tokens: [] }), 'info@x.it')
})

/* --- correzioni: l'unica fonte che batte tutte le altre --- */

check('una correzione batte un documento più recente', () => {
  const email = hit({
    documentId: 'email',
    kind: 'email',
    content: 'La scadenza per il deposito è giovedì.',
    occurredAt: '2026-09-14T09:00:00Z',
  })
  const correzione = hit({
    documentId: 'correzione',
    kind: 'correction',
    source: 'manual',
    content: 'CORREZIONE: la scadenza per il deposito è venerdì, non giovedì.',
    occurredAt: '2026-09-12T09:00:00Z',
  })
  const ranked = rankHits([email, correzione], 'scadenza deposito', { now: NOW })
  assert.equal(ranked[0].documentId, 'correzione', 'una correzione più vecchia deve comunque vincere')
})

check('il peso della correzione non stravolge documenti che non c\'entrano', () => {
  const pertinente = hit({ documentId: 'pertinente', kind: 'email', content: 'scadenza deposito giovedì' })
  const correzioneAltrove = hit({
    documentId: 'altrove',
    kind: 'correction',
    source: 'manual',
    content: 'CORREZIONE: il numero di telefono di Verdi è un altro.',
  })
  const ranked = rankHits([pertinente, correzioneAltrove], 'scadenza deposito', { now: NOW })
  assert.equal(ranked[0].documentId, 'pertinente')
})

check('serve dire qual è la cosa giusta, il resto è facoltativo', () => {
  assert.equal(validateCorrection({ right: '' }).ok, false)
  assert.equal(validateCorrection({ right: 'ok' }).ok, false, 'due caratteri non sono una correzione')
  assert.equal(validateCorrection({ right: 'È venerdì' }).ok, true)
})

check('una correzione identica a quello che correggeva non è una correzione', () => {
  const v = validateCorrection({ wrong: 'giovedì', right: 'giovedì' })
  assert.equal(v.ok, false)
})

check('i campi troppo lunghi vengono rifiutati con una ragione leggibile', () => {
  const v = validateCorrection({ right: 'x'.repeat(2001) })
  assert.equal(v.ok, false)
  if (!v.ok) assert.match(v.reason, /2000/)
})

check('la validazione restituisce i campi già ripuliti', () => {
  const v = validateCorrection({ right: '  È venerdì  ', wrong: '  giovedì ', about: ' deposito ' })
  assert.ok(v.ok)
  if (v.ok) {
    assert.equal(v.value.right, 'È venerdì')
    assert.equal(v.value.wrong, 'giovedì')
    assert.equal(v.value.about, 'deposito')
  }
})

check('il corpo della correzione è autosufficiente e porta con sé la precedenza', () => {
  const v = validateCorrection({ wrong: 'giovedì', right: 'venerdì', about: 'deposito atto' })
  assert.ok(v.ok)
  if (!v.ok) return
  const body = correctionBody(v.value, NOW)
  assert.match(body, /15\/09\/2026/)
  assert.match(body, /deposito atto/)
  assert.match(body, /SBAGLIATO.*giovedì/)
  assert.match(body, /corretto: venerdì/)
  // La regola viaggia col dato: un prompt si può dimenticare di dirla.
  assert.match(body, /ha la precedenza su qualunque altra fonte/)
})

check('senza il testo sbagliato il corpo resta sensato', () => {
  const v = validateCorrection({ right: 'La scadenza è venerdì' })
  assert.ok(v.ok)
  if (!v.ok) return
  const body = correctionBody(v.value, NOW)
  assert.ok(!body.includes('SBAGLIATO'))
  assert.match(body, /corretto: La scadenza è venerdì/)
})

check('il titolo si legge in un elenco, anche quando il testo è lungo', () => {
  const v = validateCorrection({ right: 'x'.repeat(200) })
  assert.ok(v.ok)
  if (!v.ok) return
  const t = correctionTitle(v.value)
  assert.ok(t.startsWith('Correzione — '))
  assert.ok(t.length < 120)
  assert.ok(t.endsWith('…'))
})

check('la stessa correzione inviata due volte ha la stessa chiave', () => {
  const a = validateCorrection({ right: 'È  venerdì', about: 'deposito' })
  const b = validateCorrection({ right: 'È venerdì', about: 'deposito' })
  assert.ok(a.ok && b.ok)
  if (a.ok && b.ok) assert.equal(correctionKey(a.value), correctionKey(b.value))
})

check('due correzioni che differiscono di una parola restano due', () => {
  const a = validateCorrection({ right: 'La scadenza è venerdì' })
  const b = validateCorrection({ right: 'La scadenza è lunedì' })
  assert.ok(a.ok && b.ok)
  if (a.ok && b.ok) assert.notEqual(correctionKey(a.value), correctionKey(b.value))
})

/* --- espansione della domanda: il modello propone parole, non risposte --- */

check('i termini della domanda vengono sempre prima e non si perdono mai', () => {
  const t = mergeTerms(['pricing'], ['listino', 'tariffe', 'sconto'])
  assert.equal(t[0], 'pricing')
  assert.ok(t.includes('listino'))
})

check('nemmeno un\'espansione lunghissima butta fuori la parola dell\'utente', () => {
  const tanti = Array.from({ length: 40 }, (_, i) => `sinonimo${i}`)
  const t = mergeTerms(['pricing', 'rossi'], tanti)
  assert.ok(t.includes('pricing'), 'la parola della domanda deve sopravvivere al tetto')
  assert.ok(t.includes('rossi'))
  assert.ok(t.length <= 18)
})

check('un "sinonimo" fatto di tre parole viene spezzato e filtrato', () => {
  const t = mergeTerms(['pricing'], ['il listino dei prezzi'])
  assert.ok(t.includes('listino'))
  assert.ok(t.includes('prezzi'))
  assert.ok(!t.includes('il'), 'le parole vuote non diventano termini')
})

check('i doppioni non si moltiplicano, accenti compresi', () => {
  const t = mergeTerms(['società'], ['Societa', 'SOCIETÀ'])
  assert.equal(t.filter((x) => x === 'societa').length, 1)
})

check('l\'interrogazione espansa resta un OR senza apici', () => {
  const q = expandedQuery(['pricing'], ['listino'])
  assert.equal(q, 'pricing or listino')
  assert.ok(!expandedQuery(['contratto'], ['"rossi"']).includes('"'))
})

check('si espande solo quando il primo giro ha trovato poco', () => {
  assert.equal(shouldExpand(3, ['pricing']), true)
  assert.equal(shouldExpand(40, ['pricing']), false)
})

check('una domanda senza termini utili non si espande', () => {
  assert.equal(shouldExpand(0, []), false)
})

check('una ricerca a vuoto dice cosa ha cercato: "non risulta" diventa falsificabile', () => {
  const d = describeSearch(['pricing', 'listino'], 1240)
  assert.ok(d.includes('"pricing"'))
  assert.ok(d.includes('"listino"'))
  assert.ok(d.includes('1240'))
})

check('e lo dice anche quando la domanda non aveva niente su cui cercare', () => {
  assert.ok(describeSearch([], 12).includes('nessun termine'))
})

/* --- il brief nella posta: si formatta, non si rigenera --- */

function mail(partial: Partial<MailBrief> = {}): MailBrief {
  return {
    generatedAt: '2026-09-15T05:00:00Z',
    oggi: [],
    novita: [],
    puntiAperti: [],
    conto: null,
    posta: null,
    scadenze: [],
    ...partial,
  }
}

check('una scadenza vicina, o qualcuno che aspetta da giorni, giustificano la mail; uno che aspetta da ieri no', () => {
  const s = { date: '2026-09-16', label: 'Termine', title: 'Diffida', overdue: false }
  assert.equal(isWorthSending(mail({ scadenze: [s] })), true)
  assert.equal(isWorthSending(mail({ posta: { waiting: 2, direct: 1, oldestDays: 1 } })), false)
  assert.equal(isWorthSending(mail({ posta: { waiting: 2, direct: 1, oldestDays: 5 } })), true)
  const { subject, text, html } = renderBriefEmail(mail({ scadenze: [s], posta: { waiting: 2, direct: 1, oldestDays: 5 } }))
  assert.ok(subject.includes('1 scadenza'), subject)
  assert.ok(subject.includes('2 aspettano te'), subject)
  assert.ok(text.includes('ENTRO QUANDO') && text.includes('16/09/2026'), text)
  assert.ok(html.includes('Chi aspetta te') && html.includes('5 giorni'))
})

const CLAIM = {
  text: 'Bianchi chiede conferma entro giovedì.',
  sources: [
    { source: 'gmail' as const, title: 'Rinnovo contratto', occurredAt: '2026-09-14T08:00:00Z', url: 'https://mail.example/1' },
  ],
}

check('un brief vuoto non sveglia nessuno', () => {
  assert.equal(isWorthSending(mail()), false)
})

check('i punti aperti da soli non giustificano una mail', () => {
  const b = mail({ puntiAperti: [{ text: 'Rispondere a Bianchi', openedAt: '2026-09-14T08:00:00Z', age: 'nuovo' }] })
  assert.equal(isWorthSending(b), false)
})

check('un punto fermo da settimane invece sì', () => {
  const b = mail({ puntiAperti: [{ text: 'Decidere sul rinnovo', openedAt: '2026-08-01T08:00:00Z', age: 'fermo' }] })
  assert.equal(isWorthSending(b), true)
})

check('qualcosa in agenda o di nuovo la giustifica', () => {
  assert.equal(isWorthSending(mail({ oggi: [CLAIM] })), true)
  assert.equal(isWorthSending(mail({ novita: [CLAIM] })), true)
})

check('anche una fattura mancante la giustifica', () => {
  assert.equal(isWorthSending(mail({ conto: { missing: 1, missingCents: 125000, resolvable: 0 } })), true)
})

check('l\'oggetto dice cosa c\'è dentro, non "il tuo brief"', () => {
  const { subject } = renderBriefEmail(mail({ oggi: [CLAIM, CLAIM], conto: { missing: 3, missingCents: 1, resolvable: 0 } }))
  assert.ok(subject.includes('2 in agenda'), subject)
  assert.ok(subject.includes('3 senza fattura'), subject)
})

check('le fonti sopravvivono nella mail, con canale e data', () => {
  const { text, html } = renderBriefEmail(mail({ oggi: [CLAIM] }))
  assert.ok(text.includes('Email 14/09'), text)
  assert.ok(html.includes('Rinnovo contratto'))
  assert.ok(html.includes('https://mail.example/1'), 'il link alla fonte deve restare cliccabile')
})

check('un dettaglio non verificato resta marcato anche nella mail', () => {
  const claim = { ...CLAIM, unverified: ['2.500,00'] }
  const { text, html } = renderBriefEmail(mail({ novita: [claim] }))
  assert.ok(text.includes('2.500,00'))
  assert.ok(html.includes('non compare nelle fonti citate'))
})

check('gli importi nella mail sono formattati in italiano', () => {
  const { text } = renderBriefEmail(mail({ conto: { missing: 2, missingCents: 125000, resolvable: 1 } }))
  assert.ok(text.includes('€ 1.250,00'), text)
})

check('il testo dell\'utente viene messo in sicurezza nell\'HTML', () => {
  const cattivo = { ...CLAIM, text: '<script>alert(1)</script> & "virgolette"' }
  const { html } = renderBriefEmail(mail({ oggi: [cattivo] }))
  assert.ok(!html.includes('<script>'), 'lo script non deve arrivare intatto')
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('&amp;'))
})

check('una sezione vuota non lascia un titolo orfano', () => {
  const { html } = renderBriefEmail(mail({ oggi: [CLAIM] }))
  assert.ok(html.includes('Oggi e domani'))
  assert.ok(!html.includes('Cosa è arrivato'), 'la sezione senza contenuto non va stampata')
})

/* --- punti aperti: si chiudono solo a mano --- */

function point(partial: Partial<OpenPointLike> & { text: string }): OpenPointLike {
  return {
    id: 'p-' + Math.random().toString(36).slice(2),
    fingerprint: fingerprint(partial.text),
    openedAt: '2026-09-01T09:00:00Z',
    lastSeenAt: '2026-09-01T09:00:00Z',
    ...partial,
  }
}

check('lo stesso impegno in ordine diverso ha la stessa impronta', () => {
  assert.equal(
    fingerprint('Chiedere la fattura a Rossi'),
    fingerprint('A Rossi, chiedere la fattura')
  )
})

check('due impegni diversi hanno impronte diverse', () => {
  assert.notEqual(
    fingerprint('Chiedere la fattura a Rossi'),
    fingerprint('Chiedere la fattura a Bianchi')
  )
})

check('la somiglianza riconosce la riformulazione', () => {
  const a = 'Rispondere a Bianchi sulla proposta di rinnovo del contratto'
  const b = 'Devo ancora rispondere a Bianchi sulla proposta di rinnovo'
  assert.ok(similarity(a, b) >= 0.6, `somiglianza ${similarity(a, b)}`)
})

check('la somiglianza non fonde due cose diverse', () => {
  const a = 'Rispondere a Bianchi sul rinnovo'
  const b = 'Pagare la parcella del notaio Verdi'
  assert.ok(similarity(a, b) < 0.6)
})

check('un punto riformulato ritrova quello che c\'è già', () => {
  const esistente = point({ text: 'Rispondere a Bianchi sulla proposta di rinnovo del contratto' })
  const found = matchExisting('Devo ancora rispondere a Bianchi sulla proposta di rinnovo', [esistente])
  assert.equal(found?.id, esistente.id)
})

check('fra più candidati vince il più somigliante, non il primo', () => {
  const vago = point({ id: 'vago', text: 'Rispondere a Bianchi' })
  const preciso = point({ id: 'preciso', text: 'Rispondere a Bianchi sulla proposta di rinnovo del contratto' })
  const found = matchExisting('Rispondere a Bianchi sulla proposta di rinnovo del contratto', [vago, preciso])
  assert.equal(found?.id, 'preciso')
})

check('un punto nuovo non viene confuso con quelli aperti', () => {
  const esistente = point({ text: 'Rispondere a Bianchi sul rinnovo' })
  assert.equal(matchExisting('Prenotare il volo per Bruxelles', [esistente]), null)
})

check('decidePoints apre i nuovi e riconosce i vecchi', () => {
  const esistente = point({ id: 'vecchio', text: 'Rispondere a Bianchi sulla proposta di rinnovo' })
  const d = decidePoints(
    ['Devo rispondere a Bianchi sulla proposta di rinnovo', 'Prenotare il volo per Bruxelles'],
    [esistente]
  )
  assert.equal(d.length, 2)
  assert.deepEqual(d[0], { action: 'keep', id: 'vecchio', text: 'Rispondere a Bianchi sulla proposta di rinnovo' })
  assert.equal(d[1].action, 'open')
})

check('due frasi simili nello stesso brief non diventano due righe', () => {
  const d = decidePoints(
    ['Chiedere la fattura allo Studio Bianchi', 'Bisogna chiedere la fattura allo Studio Bianchi'],
    []
  )
  assert.equal(d.filter((x) => x.action === 'open').length, 1)
})

check('decidePoints non chiude mai niente da solo', () => {
  const vecchio = point({ id: 'v', text: 'Una cosa di cui oggi nessuno parla' })
  const d = decidePoints(['Tutt\'altro argomento, il volo per Bruxelles'], [vecchio])
  // Nessuna decisione tocca il punto vecchio: resta aperto, e basta.
  assert.ok(!d.some((x) => x.action === 'keep' && x.id === 'v'))
  assert.equal(d.length, 1)
  assert.equal(d[0].action, 'open')
})

check('un testo vuoto non apre un punto', () => {
  assert.deepEqual(decidePoints(['  ', ''], []), [])
})

check('l\'età dice quanto stai rimandando', () => {
  assert.equal(ageInDays('2026-09-14T09:00:00Z', NOW), 1)
  assert.equal(staleness('2026-09-14T09:00:00Z', NOW), 'nuovo')
  assert.equal(staleness('2026-09-08T09:00:00Z', NOW), 'in attesa')
  assert.equal(staleness('2026-08-01T09:00:00Z', NOW), 'fermo')
})

check('i più vecchi vanno in cima: sono quelli che eviti', () => {
  const ordinati = sortByAge([
    { openedAt: '2026-09-14T09:00:00Z', id: 'nuovo' },
    { openedAt: '2026-07-01T09:00:00Z', id: 'vecchio' },
  ])
  assert.equal(ordinati[0].id, 'vecchio')
})

/* --- riconciliazione: l'aritmetica non si delega a un modello --- */

function tx(partial: Partial<TxLike> = {}): TxLike {
  return {
    id: 'tx-1',
    label: 'STUDIO BIANCHI SRL',
    amountCents: 125000,
    occurredAt: '2026-09-10T09:00:00Z',
    hasAttachment: false,
    ...partial,
  }
}

function doc(partial: Partial<DocLike> & { text: string }): DocLike {
  return {
    id: 'doc-1',
    title: 'Fattura',
    occurredAt: '2026-09-05T09:00:00Z',
    ...partial,
  }
}

check('formato italiano: il punto separa le migliaia', () => {
  assert.equal(parseAmount('1.250,00'), 125000)
  assert.equal(parseAmount('€ 1.250,00'), 125000)
  assert.equal(parseAmount('1.250'), 125000)
})

check('formato inglese: la virgola separa le migliaia', () => {
  assert.equal(parseAmount('1,250.00'), 125000)
  assert.equal(parseAmount('$1,250.00'), 125000)
})

check('un separatore solo con due cifre in fondo è un decimale', () => {
  assert.equal(parseAmount('1,25'), 125)
  assert.equal(parseAmount('1.25'), 125)
})

check('separatori ripetuti sono per forza migliaia', () => {
  assert.equal(parseAmount('1.250.000'), 125000000)
  assert.equal(parseAmount('1,250,000'), 125000000)
})

check('un numero intero resta intero', () => {
  assert.equal(parseAmount('900'), 90000)
  assert.equal(parseAmount('0,50'), 50)
})

check('quello che non è un numero non diventa un importo', () => {
  assert.equal(parseAmount('abc'), null)
  assert.equal(parseAmount(''), null)
})

check('REGRESSIONE: "1250,00" vale 1250 euro, non 125', () => {
  // La prima versione riconosceva il formato dentro alla regex e si
  // fermava dopo tre cifre. È l'errore che questo modulo esiste per
  // impedire, e ci è cascato per primo.
  assert.deepEqual(parseAmounts('1250,00 €'), [125000])
  assert.deepEqual(parseAmounts('1250,50 €'), [125050])
  assert.deepEqual(parseAmounts('1.250,00 €'), [125000])
  assert.deepEqual(parseAmounts('1,250.00 USD'), [125000])
})

check('dal testo escono gli importi, non i numeri di protocollo', () => {
  const importi = parseAmounts('Fattura n. 12 del 2026 — imponibile 1.000,00, totale 1.220,00')
  assert.ok(importi.includes(100000))
  assert.ok(importi.includes(122000))
  assert.ok(!importi.includes(1200), 'il numero di fattura non è un importo')
  assert.ok(!importi.includes(202600), 'l\'anno non è un importo')
})

check('un intero nudo conta solo se ha una valuta accanto', () => {
  assert.deepEqual(parseAmounts('totale 900 euro'), [90000])
  assert.deepEqual(parseAmounts('€ 900'), [90000])
  assert.deepEqual(parseAmounts('pratica 900 del registro'), [])
})

check('gli importi si formattano senza Intl: il risultato non dipende dall\'host', () => {
  assert.equal(formatEuro(125000), '1.250,00')
  assert.equal(formatEuro(1250000000), '12.500.000,00')
  assert.equal(formatEuro(50), '0,50')
  assert.equal(formatEuro(-125000), '-1.250,00')
  assert.equal(formatDay('2026-09-10T09:00:00Z'), '10/09/2026')
  assert.equal(formatDay('non una data'), '—')
})

check('il nome del fornitore perde le forme societarie e il rumore bancario', () => {
  const t = nameTokens('PAGAMENTO CARTA STUDIO BIANCHI SRL')
  assert.ok(t.includes('bianchi'))
  assert.ok(t.includes('studio') === false, '"studio" è troppo generico')
  assert.ok(!t.includes('srl'))
  assert.ok(!t.includes('pagamento'))
})

check('senza importo identico non si è nemmeno candidati', () => {
  const c = findInvoice(tx(), [doc({ text: 'Fattura Bianchi, totale 999,00 euro' })])
  assert.equal(c.length, 0)
})

check('importo, nome e data vicina: abbinamento certo', () => {
  const c = findInvoice(tx(), [doc({ text: 'Fattura Bianchi 1.250,00 euro' })])
  assert.equal(c.length, 1)
  assert.equal(c[0].confidence, 'certa')
  assert.ok(c[0].why.some((w) => w.includes('importo identico')))
  assert.ok(c[0].why.some((w) => w.includes('bianchi')))
})

check('stesso importo ma nessun nome in comune: solo probabile', () => {
  const c = findInvoice(tx(), [doc({ text: 'Fattura Verdi 1.250,00 euro' })])
  assert.equal(c[0].confidence, 'probabile')
})

check('stesso importo e nome ma a un anno di distanza: non è certa', () => {
  const c = findInvoice(tx(), [doc({ text: 'Fattura Bianchi 1.250,00', occurredAt: '2024-01-05T09:00:00Z' })])
  assert.equal(c[0].confidence, 'probabile')
  assert.ok(c[0].why.includes('data lontana'))
})

check('fra due candidati vince quello con nome e data migliori', () => {
  const c = findInvoice(tx(), [
    doc({ id: 'lontano', text: 'Fattura 1.250,00', occurredAt: '2023-01-01T09:00:00Z' }),
    doc({ id: 'giusto', text: 'Fattura Bianchi 1.250,00', occurredAt: '2026-09-09T09:00:00Z' }),
  ])
  assert.equal(c[0].documentId, 'giusto')
})

check('un movimento col giustificativo non compare fra i problemi', () => {
  const r = reconcile([tx({ hasAttachment: true })], [])
  assert.equal(r.length, 0)
})

check('prima i movimenti senza nessun candidato: sono le fatture da chiedere', () => {
  const r = reconcile(
    [
      tx({ id: 'con-candidato', amountCents: 125000 }),
      tx({ id: 'orfano', amountCents: 777700, label: 'ACME LIMITED' }),
    ],
    [doc({ text: 'Fattura Bianchi 1.250,00' })]
  )
  assert.equal(r[0].transaction.id, 'orfano')
  assert.equal(r[0].candidates.length, 0)
  assert.equal(r[1].candidates.length, 1)
})

check('il testo per chiedere la fattura porta importo e data giusti', () => {
  const testo = requestInvoiceText(tx())
  assert.ok(testo.includes('€ 1.250,00'), testo)
  assert.ok(testo.includes('10/09/2026'))
  assert.ok(testo.includes('STUDIO BIANCHI SRL'))
})

/* --- PDF: un guscio vuoto non deve passare per documento letto --- */

const PAGINA_VERA = `Contratto di fornitura di servizi professionali stipulato fra le parti
in data odierna. Le parti convengono quanto segue in ordine alla durata,
al corrispettivo, alle modalità di recesso e alla legge applicabile al
presente rapporto contrattuale, come meglio specificato negli articoli
che seguono e negli allegati che ne costituiscono parte integrante.`

check('una pagina di contratto vera passa', () => {
  assert.equal(assessExtraction(PAGINA_VERA, 1), 'ok')
})

check('un PDF scansionato non ha livello di testo', () => {
  assert.equal(assessExtraction('', 12), 'no-text-layer')
  assert.equal(assessExtraction('   \n  \n ', 12), 'no-text-layer')
})

check('quattro righe di intestazione su venti pagine restano una scansione', () => {
  const briciole = 'Studio Legale Rossi — pag. 1 di 20\nRiservato\n'
  assert.equal(assessExtraction(briciole.repeat(3), 20), 'no-text-layer')
})

check('la densità conta: lo stesso testo su una pagina va bene, su cento no', () => {
  assert.equal(assessExtraction(PAGINA_VERA, 1), 'ok')
  assert.equal(assessExtraction(PAGINA_VERA, 100), 'no-text-layer')
})

check('un PDF senza spazi estratti è illeggibile, non "ok"', () => {
  const senzaSpazi = Array.from({ length: 40 }, () => 'contrattodifornituradiservizipro').join(' ')
  assert.equal(assessExtraction(senzaSpazi, 1), 'garbled')
})

check('numeri e simboli senza parole non sono testo', () => {
  assert.equal(assessExtraction('12 34 56 78 90 '.repeat(40), 1), 'no-text-layer')
})

check('senza numero di pagine si decide comunque sul totale', () => {
  assert.equal(assessExtraction(PAGINA_VERA, 0), 'ok')
  assert.equal(assessExtraction('poco', 0), 'no-text-layer')
})

/* --- esecuzione automatica: la porta è chiusa per difetto --- */

check('senza CRON_SECRET configurato non entra nessuno', () => {
  assert.equal(isAuthorizedCron('Bearer qualunque', undefined), false)
  assert.equal(isAuthorizedCron('Bearer qualunque', ''), false)
})

check('senza header non entra nessuno', () => {
  assert.equal(isAuthorizedCron(null, 'segreto'), false)
  assert.equal(isAuthorizedCron('', 'segreto'), false)
})

check('il segreto giusto entra, anche con Bearer minuscolo', () => {
  assert.equal(isAuthorizedCron('Bearer segreto', 'segreto'), true)
  assert.equal(isAuthorizedCron('bearer segreto', 'segreto'), true)
  assert.equal(isAuthorizedCron('  Bearer segreto  ', 'segreto'), true)
})

check('un segreto sbagliato o di lunghezza diversa non entra', () => {
  assert.equal(isAuthorizedCron('Bearer sbagliato', 'segreto'), false)
  assert.equal(isAuthorizedCron('Bearer segret', 'segreto'), false)
  assert.equal(isAuthorizedCron('Bearer segretoo', 'segreto'), false)
})

check('il segreto nudo senza schema Bearer non basta', () => {
  assert.equal(isAuthorizedCron('segreto', 'segreto'), false)
  assert.equal(isAuthorizedCron('Basic segreto', 'segreto'), false)
})

/* ------------------------------------------------------------------ *
 * transcript: le call di Meet
 * ------------------------------------------------------------------ */

const MEET_TRANSCRIPT = `Kickoff progetto Alfa (2026-09-15 at 10:02 GMT+2) – Transcript
Attendees
Marco Giacomello, Giulia Bianchi
Transcript
This editable transcript was computer generated and might contain errors.
00:00:05
Marco Giacomello: Buongiorno Giulia, partiamo dal contratto.
Giulia Bianchi: Sì. Vi mando la bozza entro venerdì 19,
con il canone a 1.250 euro al mese.
00:01:10
Marco Giacomello: Perfetto, allora io preparo la lettera di incarico.`

check('classifyMeetDoc riconosce trascrizione e appunti, in inglese e in italiano', () => {
  assert.equal(classifyMeetDoc('Kickoff (2026-09-15 at 10:02 GMT+2) – Transcript'), 'transcript')
  assert.equal(classifyMeetDoc('Kickoff – Trascrizione'), 'transcript')
  assert.equal(classifyMeetDoc('Kickoff - Notes by Gemini'), 'notes')
  assert.equal(classifyMeetDoc('Kickoff — Appunti di Gemini'), 'notes')
  assert.equal(classifyMeetDoc('Contratto di fornitura.pdf'), null)
  assert.equal(classifyMeetDoc('Transcript delle lezioni'), null)
})

check('meetingTitle toglie suffisso e data; meetingDay la prende dal titolo o dal documento', () => {
  assert.equal(meetingTitle('Kickoff progetto Alfa (2026-09-15 at 10:02 GMT+2) – Transcript'), 'Kickoff progetto Alfa')
  assert.equal(meetingTitle('Kickoff – Notes by Gemini'), 'Kickoff')
  assert.equal(meetingDay('Kickoff (2026-09-15 at 10:02 GMT+2) – Transcript', '2026-09-16T08:00:00Z'), '2026-09-15')
  assert.equal(meetingDay('Kickoff – Notes by Gemini', '2026-09-16T08:00:00Z'), '2026-09-16')
})

check('il formato italiano vero di Meet: "Titolo - 2026/09/14 15:00 BST - Appunti di Gemini"', () => {
  const t = 'Trade Secret - 2026/09/14 15:00 BST - Appunti di Gemini'
  assert.equal(classifyMeetDoc(t), 'notes')
  assert.equal(meetingTitle(t), 'Trade Secret')
  assert.equal(meetingDay(t, '2026-01-01T00:00:00Z'), '2026-09-14')
  assert.equal(meetingTime(t), '15:00')
  assert.equal(meetingTitle('Riunione iniziata 2026/09/02 10:07 CEST - Appunti di Gemini'), 'Riunione del 02/09/2026 alle 10:07')
  assert.equal(meetingTime('Kickoff – Notes by Gemini'), null)
})

check('due call lo stesso giorno con lo stesso titolo non sono la stessa call', () => {
  const a = callKey('Mlv Mg - 2026/08/31 13:40 CEST - Appunti di Gemini', '2026-08-31T11:46:00Z')
  const b = callKey('Mlv Mg - 2026/08/31 13:43 CEST - Appunti di Gemini', '2026-08-31T11:56:00Z')
  const c = callKey('Mlv Mg - 2026/08/31 13:40 CEST - Trascrizione', '2026-08-31T11:50:00Z')
  assert.notEqual(a, b)
  assert.equal(a, c)
})

check('isSamePerson riconosce il titolare dal nome, e non riconosce il gruppo', () => {
  assert.equal(isSamePerson('Mario Rossi', 'mario.rossi@esempio.it'), true)
  assert.equal(isSamePerson('Anna Verdi Rossi', 'rossi@studio.it'), true)
  assert.equal(isSamePerson('Il gruppo', 'mario.rossi@esempio.it'), false)
  assert.equal(isSamePerson('Luca Bianchi', 'mario.rossi@esempio.it'), false)
})

const GEMINI_NOTES = `Note
set 7, 2026
Prova
invitato Mario Rossi <mario.rossi@esempio.it> <anna@studio.it>
Allegati Prova
Riepilogo
La discussione ha definito l'architettura.
Decisioni
Concordato
- Struttura di prezzo Il prezzo base è fissato a 30.000 euro.
Passaggi successivi
- [Anna Verdi] {Foto Coworking}: Inviare le fotografie.
- [Mario Rossi] Prenotare auto: Prenotare un veicolo.
- [Il gruppo] Testare flusso: Testare tutto.
Dettagli
- Configurazione postazione: Anna ha confermato.
Dovresti rivedere le note di Gemini per assicurarti che siano accurate.
Qual è la qualità di queste note?`

check('parseNotes legge gli appunti di Gemini per sezioni, con chi davanti a ogni passaggio', () => {
  const n = parseNotes(GEMINI_NOTES)
  assert.deepEqual(n.attendees, ['mario.rossi@esempio.it', 'anna@studio.it'])
  assert.deepEqual(n.riepilogo, ["La discussione ha definito l'architettura."])
  assert.deepEqual(n.decisioni, ['Struttura di prezzo Il prezzo base è fissato a 30.000 euro.'])
  assert.equal(n.passaggi.length, 3)
  assert.deepEqual(n.passaggi[0], { chi: 'Anna Verdi', etichetta: 'Foto Coworking', testo: 'Inviare le fotografie.' })
  assert.deepEqual(n.passaggi[1], { chi: 'Mario Rossi', etichetta: 'Prenotare auto', testo: 'Prenotare un veicolo.' })
  assert.equal(n.passaggi[2].chi, 'Il gruppo')
  assert.deepEqual(n.dettagli, ['Configurazione postazione: Anna ha confermato.'])
  assert.equal(n.empty, false)
})

check('pickEvent trova l\'evento in agenda: stesso giorno, stesso titolo, inizio più vicino', () => {
  const events = [
    { title: 'Mlv Mg', occurredAt: '2026-08-31T11:40:00Z', participants: ['a@x.it'] },
    { title: 'Mlv Mg', occurredAt: '2026-08-31T11:58:00Z', participants: ['b@x.it'] },
    { title: 'Altro', occurredAt: '2026-08-31T09:00:00Z', participants: [] },
    { title: 'Mlv Mg', occurredAt: '2026-09-01T11:40:00Z', participants: ['c@x.it'] },
  ]
  // Meet scrive 13:58 CEST; l'agenda ha 11:58 UTC: lo scarto di due ore va tollerato.
  assert.equal(pickEvent(events, 'MLV MG', '2026-08-31', '13:58')?.participants[0], 'b@x.it')
  assert.equal(pickEvent(events, 'mlv mg', '2026-08-31', '13:40')?.participants[0], 'a@x.it')
  assert.equal(pickEvent(events, 'Mlv Mg', '2026-09-01', null)?.participants[0], 'c@x.it')
  assert.equal(pickEvent(events, 'Kickoff', '2026-08-31', '13:40'), null)
})

check('parseNotes riconosce gli appunti vuoti ("non c\'era abbastanza conversazione")', () => {
  const n = parseNotes(`Note
Riepilogo
Non è stato prodotto un riepilogo per questa riunione perché non c'era abbastanza conversazione.
Passaggi successivi
Nessun passaggio successivo suggerito trovato per questa riunione.
Dettagli
Non sono stati prodotti dettagli per questa riunione.`)
  assert.equal(n.empty, true)
  assert.deepEqual(n.decisioni, [])
  assert.deepEqual(n.passaggi, [])
  assert.deepEqual(n.dettagli, [])
})

check('callKey tiene insieme trascrizione e appunti della stessa riunione', () => {
  const a = callKey('Kickoff Progetto Alfa (2026-09-15 at 10:02 GMT+2) – Transcript', '2026-09-15T09:00:00Z')
  const b = callKey('kickoff progetto alfa (2026-09-15 at 10:02 GMT+2) – Notes by Gemini', '2026-09-15T09:30:00Z')
  const c = callKey('kickoff progetto alfa (2026-09-22 at 10:02 GMT+2) – Notes by Gemini', '2026-09-22T09:30:00Z')
  assert.equal(a, b)
  assert.notEqual(a, c)
})

check('parseTurns salta intestazione e timestamp e unisce le righe di continuazione', () => {
  const turns = parseTurns(MEET_TRANSCRIPT)
  assert.equal(turns.length, 3)
  assert.equal(turns[0].speaker, 'Marco Giacomello')
  assert.equal(turns[1].text, 'Sì. Vi mando la bozza entro venerdì 19, con il canone a 1.250 euro al mese.')
  assert.equal(turns[2].speaker, 'Marco Giacomello')
})

check('attendees legge gli invitati in testa', () => {
  assert.deepEqual(attendees(MEET_TRANSCRIPT), ['Marco Giacomello', 'Giulia Bianchi'])
  assert.deepEqual(attendees('Solo testo, senza intestazione'), [])
})

check('speakerShares somma a uno e mette per primo chi ha parlato di più', () => {
  const shares = speakerShares(parseTurns(MEET_TRANSCRIPT))
  assert.equal(shares.length, 2)
  assert.equal(shares[0].speaker, 'Marco Giacomello')
  assert.ok(Math.abs(shares[0].share + shares[1].share - 1) <= 0.01)
  assert.deepEqual(speakerShares([]), [])
})

check('segment non spezza mai un intervento a metà', () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({ speaker: `P${i}`, text: 'x'.repeat(100) }))
  const parts = segment(turns, 250)
  assert.equal(parts.length, 5)
  for (const p of parts) assert.equal(p.split('\n').length, 2)
  assert.equal(segment([{ speaker: 'A', text: 'x'.repeat(900) }], 250).length, 1)
})

check('renderFollowUp formatta le sezioni piene e sparisce se sono tutte vuote', () => {
  const mail = renderFollowUp({
    title: 'Kickoff',
    day: '2026-09-15',
    to: ['Giulia Bianchi', 'Luca Verdi'],
    decisioni: ['Si parte a ottobre'],
    impegni: ['Giulia Bianchi: manda la bozza — entro venerdì 19'],
    domande: [],
  })
  assert.ok(mail)
  assert.equal(mail.subject, 'Riepilogo — Kickoff')
  assert.ok(mail.text.startsWith('Ciao Giulia e Luca,'))
  assert.ok(mail.text.includes('15/09/2026'))
  assert.ok(mail.text.includes('Cosa abbiamo deciso\n- Si parte a ottobre'))
  assert.ok(mail.text.includes('Prossimi passi'))
  assert.ok(!mail.text.includes('Da chiarire'))
  assert.equal(renderFollowUp({ title: 'X', day: '2026-09-15', to: [], decisioni: [], impegni: [], domande: [] }), null)
})

/* ------------------------------------------------------------------ *
 * deadlines: entro quando
 * ------------------------------------------------------------------ */

check('findDates legge i tre modi italiani e scioglie l\'anno mancante in avanti', () => {
  const found = findDates('firmato il 12/01/2026, scade il 1º marzo 2027, revisione 2026-06-30, entro il 10 gennaio', '2026-12-05T00:00:00Z')
  assert.deepEqual(found.map((f) => f.iso), ['2026-01-12', '2027-03-01', '2026-06-30', '2027-01-10'])
  assert.deepEqual(findDates('il 31/02/2026 non esiste', '2026-01-01T00:00:00Z'), [])
})

check('addMonths rispetta la fine del mese', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-01-15', 12), '2027-01-15')
  assert.equal(addMonths('2027-01-01', -3), '2026-10-01')
})

check('explicitDeadlines: una frase con data e parola chiave è un termine, e "entro N giorni" parte dalla mail', () => {
  const doc = {
    id: 'm1',
    title: 'Diffida',
    text: 'Buongiorno. Vi invitiamo a provvedere entro il 30 ottobre 2026. In mancanza, agiremo. Resto in attesa entro 15 giorni di un riscontro.',
    occurredAt: '2026-10-01T09:00:00Z',
  }
  const out = explicitDeadlines(doc)
  assert.equal(out.length, 2)
  assert.equal(out[0].kind, 'termine')
  assert.equal(out[0].date, '2026-10-30')
  assert.equal(out[0].how, 'esplicita')
  assert.ok(out[0].quote.includes('30 ottobre 2026'))
  assert.equal(out[1].date, '2026-10-16')
  assert.equal(out[1].how, 'calcolata')
})

check('contractDeadlines: durata + decorrenza + preavviso → scadenza e ultima disdetta', () => {
  const doc = {
    id: 'c1',
    title: 'Contratto di licenza',
    text:
      'Art. 3 Durata. Il presente contratto ha una durata di dodici (12) mesi con decorrenza dal 1 febbraio 2026 e si intenderà tacitamente rinnovato per uguale periodo salvo disdetta da comunicarsi con preavviso di tre (3) mesi.',
    occurredAt: '2026-01-20T00:00:00Z',
  }
  const out = contractDeadlines(doc)
  assert.equal(out.length, 2)
  assert.equal(out[0].kind, 'scadenza')
  assert.equal(out[0].date, '2027-02-01')
  assert.ok(out[0].label.includes('rinnovo tacito'))
  assert.equal(out[1].kind, 'disdetta')
  assert.equal(out[1].date, '2026-11-01')
  // Senza decorrenza nel testo, nessuna data inventata.
  assert.deepEqual(contractDeadlines({ ...doc, text: 'Durata di 12 mesi, rinnovo tacito, preavviso di 3 mesi.' }), [])
})

check('selectDeadlines tiene la finestra, scarta i doppioni e tiene le scadute da poco', () => {
  const mk = (date: string, kind: 'termine' | 'scadenza' = 'termine') => ({
    documentId: 'd', kind, date, label: '', quote: '', how: 'esplicita' as const,
  })
  const out = selectDeadlines([mk('2026-10-20'), mk('2026-10-20'), mk('2026-09-20'), mk('2026-10-02'), mk('2027-06-01')], '2026-10-04')
  assert.deepEqual(out.map((d) => d.date), ['2026-10-02', '2026-10-20'])
  assert.equal(urgency('2026-10-02', '2026-10-04'), 'scaduta')
  assert.equal(urgency('2026-10-04', '2026-10-04'), 'oggi')
  assert.equal(urgency('2026-10-09', '2026-10-04'), 'settimana')
  assert.equal(urgency('2026-10-30', '2026-10-04'), 'mese')
  assert.equal(urgency('2027-01-30', '2026-10-04'), 'oltre')
})

/* ------------------------------------------------------------------ *
 * inbox: chi aspetta te
 * ------------------------------------------------------------------ */

const mailOf = (over: Partial<MailLike>): MailLike => ({
  id: 'x', threadId: 't', title: 'Oggetto', occurredAt: '2026-10-01T10:00:00Z',
  from: 'anna@studio.it', to: ['me@esempio.it'], labels: [], url: null, body: 'Ciao', ...over,
})

check('senderOf e recipientsOf leggono le righe Da: e A: in testa al corpo', () => {
  const body = 'Da: Anna Verdi <Anna@Studio.it>\nA: me@esempio.it, altro@x.it\n\nCiao'
  assert.equal(senderOf(body), 'anna@studio.it')
  assert.deepEqual(recipientsOf(body), ['me@esempio.it', 'altro@x.it'])
  assert.equal(senderOf('niente intestazione'), null)
})

check('isNoise scarta notifiche e promozioni; asksSomething riconosce una richiesta', () => {
  assert.equal(isNoise('noreply@vercel.com', []), true)
  assert.equal(isNoise('anna@studio.it', ['CATEGORY_PROMOTIONS']), true)
  assert.equal(isNoise('anna@studio.it', ['INBOX']), false)
  assert.equal(asksSomething('Puoi mandarmi la bozza?'), true)
  assert.equal(asksSomething('Grazie, ricevuto.'), false)
})

check('waitingOnMe: resta solo il thread in cui l\'ultima parola non è mia, ordinato per peso ed età', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  const mails = [
    mailOf({ id: 'a1', threadId: 'A', occurredAt: '2026-09-25T10:00:00Z', body: 'Puoi confermare?' }),
    mailOf({ id: 'b1', threadId: 'B', occurredAt: '2026-09-28T10:00:00Z' }),
    mailOf({ id: 'b2', threadId: 'B', from: 'me@esempio.it', to: ['anna@studio.it'], occurredAt: '2026-09-29T10:00:00Z' }),
    mailOf({ id: 'c1', threadId: 'C', occurredAt: '2026-10-01T10:00:00Z', to: ['altro@x.it'], body: 'FYI' }),
    mailOf({ id: 'd1', threadId: 'D', from: 'noreply@banca.it', occurredAt: '2026-09-20T10:00:00Z' }),
    mailOf({ id: 'e1', threadId: 'E', occurredAt: '2026-10-04T09:00:00Z' }),
  ]
  const out = waitingOnMe(mails, 'ME@esempio.it', now, 1)
  assert.deepEqual(out.map((t) => t.threadId), ['A', 'C'])
  assert.equal(out[0].ageDays, 9)
  assert.equal(out[0].direct, true)
  assert.equal(out[0].asks, true)
  assert.equal(out[1].direct, false)
})

/* ------------------------------------------------------------------ *
 * slots: le finestre libere
 * ------------------------------------------------------------------ */

check('parseWhen legge un impegno con orario e una giornata intera', () => {
  const a = parseWhen('2026-10-06T10:00:00+02:00 → 2026-10-06T11:00:00+02:00')
  assert.equal(a?.start, '2026-10-06T08:00:00.000Z')
  assert.equal(a?.end, '2026-10-06T09:00:00.000Z')
  const b = parseWhen('2026-10-07 → 2026-10-08')
  assert.equal(b?.start, '2026-10-06T22:00:00.000Z')
  assert.equal(b?.end, '2026-10-07T22:00:00.000Z')
  assert.equal(parseWhen('boh'), null)
})

check('freeSlots evita gli impegni col margine, salta il weekend e preferisce le ore buone', () => {
  // Domenica 4 ottobre 2026, ore 12 italiane.
  const from = new Date('2026-10-04T10:00:00Z')
  const busy = [
    { start: '2026-10-05T08:00:00Z', end: '2026-10-05T10:00:00Z' }, // lunedì 10–12 occupato
    { start: '2026-10-06T06:00:00Z', end: '2026-10-06T16:00:00Z' }, // martedì tutto il giorno
  ]
  const slots = freeSlots(busy, { from, days: 5, count: 3 })
  assert.equal(slots.length, 3)
  const days = slots.map((s) => romeParts(new Date(s.start)))
  assert.deepEqual(days.map((d) => d.dow), [1, 3, 4])
  // Lunedì: le 10–12 sono prese, la prima scelta è il pomeriggio alle 15.
  assert.equal(days[0].h, 15)
  assert.equal(days[1].h, 10)
  assert.ok(slots[0].label.startsWith('lunedì 5 ottobre, 15:00–16:00'))
  assert.deepEqual(freeSlots([], { from, days: 0 }), [])
})

check('proposalText è formattata, non generata, e sparisce senza finestre', () => {
  const from = new Date('2026-10-04T10:00:00Z')
  const text = proposalText(freeSlots([], { from, days: 3, count: 2 }), 'la call sul contratto')
  assert.ok(text?.includes('per la call sul contratto ti propongo 2 alternative'))
  assert.ok(text?.includes('- lunedì 5 ottobre, 10:00–11:00'))
  assert.equal(proposalText([], 'x'), null)
})

/* ------------------------------------------------------------------ *
 * recurring: gli abbonamenti
 * ------------------------------------------------------------------ */

check('chargeKey riconduce le varianti della stessa controparte', () => {
  assert.equal(chargeKey('AMZN Mktp IT*2K3J4 Amazon.it'), chargeKey('Amazon.it *1Z9 AMZN Mktp'))
  assert.equal(chargeKey('Pagamento carta GOOGLE *Workspace'), 'google workspace')
  assert.equal(cadenceOf(30), 'mensile')
  assert.equal(cadenceOf(365), 'annuale')
  assert.equal(cadenceOf(17), null)
})

check('findSubscriptions trova la cadenza mensile, segna aumenti e ritardi, calcola il costo annuo', () => {
  const monthly = ['2026-05-03', '2026-06-03', '2026-07-03', '2026-08-03', '2026-09-03'].map((d, i) => ({
    id: `g${i}`, label: 'Google Workspace', amountCents: i === 4 ? 1500 : 1200, occurredAt: `${d}T08:00:00Z`,
  }))
  const sparse = ['2026-02-01', '2026-05-20', '2026-09-02'].map((d, i) => ({
    id: `s${i}`, label: 'Ferramenta Rossi', amountCents: 4000, occurredAt: `${d}T08:00:00Z`,
  }))
  const dead = ['2026-01-10', '2026-02-10', '2026-03-10'].map((d, i) => ({
    id: `d${i}`, label: 'Vecchio SaaS', amountCents: 900, occurredAt: `${d}T08:00:00Z`,
  }))
  const subs = findSubscriptions([...monthly, ...sparse, ...dead], new Date('2026-10-04T00:00:00Z'))
  assert.deepEqual(subs.map((s) => s.key), ['google workspace', 'saas vecchio'])
  const g = subs[0]
  assert.equal(g.cadence, 'mensile')
  assert.equal(g.typicalCents, 1200)
  assert.equal(g.increased, true)
  assert.equal(g.nextAt, '2026-10-03')
  assert.equal(g.yearlyCents, 14600)
  assert.equal(g.overdue, false)
  assert.equal(subs[1].overdue, true)
  assert.equal(yearlyTotal(subs), 14600)
})

/* ------------------------------------------------------------------ *
 * relations: chi si sta raffreddando
 * ------------------------------------------------------------------ */

check('relationKey raggruppa per organizzazione, ma per persona sui domini generici', () => {
  assert.equal(relationKey('Anna@StudioVerdi.it'), 'studioverdi.it')
  assert.equal(relationKey('mario.rossi@gmail.com'), 'mario.rossi@gmail.com')
  assert.equal(isNoiseAddress('calendar-notification@google.com'), true)
  assert.equal(isNoiseAddress('anna@studioverdi.it'), false)
})

check('buildRelations misura ritmo e silenzio, e segna chi si sta raffreddando', () => {
  const touch = (id: string, day: string, who: string, kind = 'email') => ({
    id, kind, title: 'x', occurredAt: `${day}T10:00:00Z`, participants: ['me@mio.it', who],
  })
  const docs = [
    // Verdi: ogni ~7 giorni fino ad agosto, poi silenzio.
    touch('v1', '2026-07-01', 'anna@studioverdi.it'), touch('v2', '2026-07-08', 'anna@studioverdi.it'),
    touch('v3', '2026-07-15', 'anna@studioverdi.it'), touch('v4', '2026-07-22', 'luca@studioverdi.it'),
    // Bianchi: sempre attivo.
    touch('b1', '2026-09-20', 'bianchi@gmail.com'), touch('b2', '2026-09-27', 'bianchi@gmail.com', 'event'),
    touch('b3', '2026-10-01', 'bianchi@gmail.com'),
    // Un collega dello stesso dominio e una notifica: non sono relazioni.
    touch('c1', '2026-10-02', 'collega@mio.it'), touch('n1', '2026-10-02', 'noreply@banca.it'),
  ]
  const rel = buildRelations(docs, 'ME@mio.it', new Date('2026-10-04T00:00:00Z'))
  assert.deepEqual(rel.map((r) => r.key), ['bianchi@gmail.com', 'studioverdi.it'])
  const verdi = rel[1]
  assert.equal(verdi.touches, 4)
  assert.deepEqual(verdi.emails, ['anna@studioverdi.it', 'luca@studioverdi.it'])
  assert.equal(verdi.rhythmDays, 7)
  assert.equal(verdi.silenceDays, 73)
  assert.equal(verdi.cooling, true)
  assert.equal(rel[0].cooling, false)
  assert.deepEqual(cooling(rel).map((r) => r.key), ['studioverdi.it'])
  assert.equal(mostActive(rel, 1)[0].key, 'studioverdi.it')
  assert.ok(verdi.label.startsWith('Studioverdi (2 persone)'))
})

/* ------------------------------------------------------------------ *
 * feeds: RSS e Atom senza parser
 * ------------------------------------------------------------------ */

check('parseFeed legge un RSS 2.0 con CDATA, entità e HTML nella descrizione', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title><![CDATA[OpenAI lancia &quot;Agents&quot;]]></title><link>https://x.it/a</link><guid>a-1</guid>
<pubDate>Sat, 03 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Un &amp;amp; due&lt;/p&gt;</description></item>
<item><title>Senza data</title><link>https://x.it/b</link></item></channel></rss>`
  const items = parseFeed(xml)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'OpenAI lancia "Agents"')
  assert.equal(items[0].id, 'a-1')
  assert.equal(items[0].published, '2026-10-03T10:00:00.000Z')
  assert.equal(items[0].summary, 'Un & due')
  assert.equal(items[1].published, null)
  assert.equal(items[1].id, 'https://x.it/b')
})

check('parseFeed legge un Atom con link alternate e content', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>F</title>
<entry><title>Nuovo modello</title><id>tag:1</id><updated>2026-10-02T08:00:00Z</updated>
<link rel="self" href="https://f.it/self"/><link rel="alternate" href="https://f.it/post?a=1&amp;b=2"/>
<content type="html">&lt;b&gt;Ciao&lt;/b&gt; mondo</content></entry></feed>`
  const [item] = parseFeed(xml)
  assert.equal(item.link, 'https://f.it/post?a=1&b=2')
  assert.equal(item.summary, 'Ciao mondo')
  assert.equal(item.published, '2026-10-02T08:00:00.000Z')
  assert.equal(stripHtml('<p>a</p><script>x</script>b &#8217;c&#x27;'), 'a\nb ’c\'')
  assert.equal(decodeEntities('&amp;&lt;&gt;'), '&<>')
})

/* ------------------------------------------------------------------ *
 * radar: quali dieci
 * ------------------------------------------------------------------ */

check('scoreItem pesa il titolo doppio e le sigle solo come parola intera', () => {
  const a = scoreItem({ id: '1', title: 'AI Act: la Commissione pubblica le linee guida', summary: 'privacy e compliance', occurredAt: '2026-10-01T00:00:00Z' }, DEFAULT_TOPICS)
  assert.ok(a.score >= 6, String(a.score))
  assert.ok(a.hits.includes('AI Act'))
  const b = scoreItem({ id: '2', title: 'Raising kids in Paris', summary: 'daily life', occurredAt: '2026-10-01T00:00:00Z' }, DEFAULT_TOPICS)
  assert.equal(b.score, 0)
  assert.equal(sameStory('OpenAI launches Agents SDK for enterprises', 'OpenAI launches new Agents SDK'), true)
  assert.equal(sameStory('OpenAI launches Agents SDK', 'Apple event in October'), false)
})

check('selectSignals toglie i doppioni e ordina per punteggio, poi per data', () => {
  const items = [
    { id: '1', title: 'OpenAI launches Agents SDK for enterprises', summary: '', occurredAt: '2026-10-01T00:00:00Z' },
    { id: '2', title: 'OpenAI launches new Agents SDK', summary: '', occurredAt: '2026-10-02T00:00:00Z' },
    { id: '3', title: 'EU AI Act guidelines on GDPR compliance', summary: 'privacy', occurredAt: '2026-09-30T00:00:00Z' },
    { id: '4', title: 'Weekend recipes', summary: 'pasta', occurredAt: '2026-10-03T00:00:00Z' },
  ]
  const out = selectSignals(items, DEFAULT_TOPICS, 10)
  assert.deepEqual(out.map((s) => s.id), ['3', '2'])
})

/* ------------------------------------------------------------------ *
 * training: sto facendo sport bene?
 * ------------------------------------------------------------------ */

function tday(day: string, over: Partial<TrainingDay> = {}): TrainingDay {
  return { day, workouts: [], steps: 8000, highMin: 0, mediumMin: 0, readiness: 80, sleep: 78, hrv: 40, restingHr: 52, ...over }
}
const run = (day: string, intensity: 'easy' | 'moderate' | 'hard', minutes = 45) => ({ day, activity: 'corsa', intensity, minutes, calories: 400 })

check('weekOf e weeklyLoad: il lunedì della settimana, sedute e minuti', () => {
  assert.equal(weekOf('2026-10-04'), '2026-09-28')
  assert.equal(weekOf('2026-09-28'), '2026-09-28')
  const days = [tday('2026-09-28', { workouts: [run('2026-09-28', 'easy')] }), tday('2026-09-30', { workouts: [run('2026-09-30', 'hard', 50)] }), tday('2026-10-06', { workouts: [run('2026-10-06', 'easy')] })]
  const weeks = weeklyLoad(days)
  assert.equal(weeks.length, 2)
  assert.deepEqual([weeks[0].sessions, weeks[0].minutes, weeks[0].hard], [2, 95, 1])
  assert.equal(longestStreak(days), 1)
  assert.deepEqual(intensityMix(days), { easy: 2, moderate: 0, hard: 1, total: 3 })
})

check('summarize: quattro settimane ben fatte danno un verdetto buono', () => {
  const days: TrainingDay[] = []
  // Dal 7 settembre al 4 ottobre: lun facile, mer dura, ven facile, ogni settimana.
  for (let i = 0; i < 28; i += 1) {
    const d = new Date(Date.UTC(2026, 8, 7 + i)).toISOString().slice(0, 10)
    const dow = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
    const w = dow === 0 ? [run(d, 'easy')] : dow === 2 ? [run(d, 'hard')] : dow === 4 ? [run(d, 'easy')] : []
    days.push(tday(d, { workouts: w, readiness: dow === 3 ? 78 : 81, hrv: 40 + Math.floor(i / 7) * 2 }))
  }
  const s = summarizeTraining(days, '2026-10-05')
  assert.equal(s.sessions, 12)
  assert.equal(s.perWeek, 3)
  assert.equal(s.longestStreak, 1)
  assert.equal(s.mix.hard, 4)
  assert.equal(s.verdict.ok, true, s.verdict.warnings.join('; '))
  assert.equal(s.hrvTrend, 'in miglioramento')
  assert.ok(s.verdict.good.some((g) => g.includes('3 sedute a settimana')))
})

check('summarize: sei giorni di fila, tutto duro e prontezza che crolla danno gli avvisi giusti', () => {
  const days: TrainingDay[] = []
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10)
    const trained = i < 6 || (i >= 8 && i < 12)
    days.push(tday(d, { workouts: trained ? [run(d, 'hard', 60)] : [], readiness: i > 0 && (i <= 6 || (i >= 9 && i <= 12)) ? 62 : 82, hrv: 50 - i * 2, restingHr: 48 + i }))
  }
  const s = summarizeTraining(days, '2026-10-05')
  assert.equal(s.verdict.ok, false)
  assert.ok(s.verdict.warnings.some((w) => w.includes('di fila')), s.verdict.warnings.join('; '))
  assert.ok(s.verdict.warnings.some((w) => w.includes('sedute dure: troppe')))
  assert.ok(s.verdict.warnings.some((w) => w.includes('recupero non basta')))
  assert.ok(s.verdict.warnings.some((w) => w.includes('carico accumulato')))
  assert.equal(s.restingHrTrend, 'in peggioramento')
})

/* ------------------------------------------------------------------ *
 * board: cinque dirigenti che si parlano
 * ------------------------------------------------------------------ */

const NAMES: Record<string, string> = { grace: 'Grace', sterling: 'Sterling', archer: 'Archer' }
const SRC = { handle: 'F1', source: 'calc', title: 'x', occurredAt: '2026-10-04T05:00:00Z', url: null }
const BOARD: Board = {
  generatedAt: '2026-10-04T05:00:00Z',
  memos: [
    { executive: 'sterling', punti: [{ text: 'Tre pagamenti senza fattura per € 1.250,00.', sources: [SRC] }], richieste: [{ a: 'grace', text: 'bloccare un\'ora per i giustificativi', sources: [SRC] }], model: 'm', dropped: 0 },
    { executive: 'archer', punti: [], richieste: [], model: 'm', dropped: 0 },
  ],
  replies: [
    { from: 'grace', to: 'sterling', stance: 'accordo', text: 'Giovedì 15–16.', sources: [SRC] },
    { from: 'archer', to: 'sterling', stance: 'obiezione', text: 'Prima la call con Verdi.', sources: [SRC] },
  ],
  synthesis: null,
}

check('memoExcerpt numera i punti e accoda le richieste con il nome del destinatario', () => {
  const text = memoExcerpt(BOARD.memos[0], (k) => NAMES[k])
  assert.ok(text.startsWith('1. Tre pagamenti'))
  assert.ok(text.includes('Richiesta a Grace: bloccare'))
  assert.equal(memoExcerpt(BOARD.memos[1], (k) => NAMES[k]), '(nessun punto)')
})

check('objections e repliesTo mettono le obiezioni davanti; threads conta le coppie', () => {
  assert.equal(objections(BOARD.replies).length, 1)
  assert.deepEqual(repliesTo(BOARD.replies, 'sterling').map((r) => r.stance), ['obiezione', 'accordo'])
  assert.deepEqual(threads(BOARD.replies), [{ from: 'grace', to: 'sterling', count: 1 }, { from: 'archer', to: 'sterling', count: 1 }])
})

check('il board vale una mail solo con una sintesi che dice qualcosa; il testo tiene le obiezioni', () => {
  assert.equal(isBoardWorthSending(BOARD), false)
  const withSynthesis: Board = { ...BOARD, synthesis: { decisioni: [], aperti: [{ text: 'Archer e Sterling non concordano sull\'ordine.', sources: [SRC] }], perTe: [], model: 'm', dropped: 0 } }
  assert.equal(isBoardWorthSending(withSynthesis), true)
  const text = renderBoardText(withSynthesis, (k) => NAMES[k])
  assert.ok(text.startsWith('RESTA APERTO'))
  assert.ok(text.includes('STERLING\n- Tre pagamenti'))
  assert.ok(text.includes('→ Grace: bloccare'))
  assert.ok(text.includes('OBIEZIONI\n- Archer a Sterling: Prima la call'))
  assert.ok(!text.includes('ARCHER\n'))
})

/* ------------------------------------------------------------------ *
 * whatsapp: la porta più stretta
 * ------------------------------------------------------------------ */

check('verifySignature accetta solo la firma HMAC giusta, e niente senza segreto', () => {
  const body = '{"entry":[]}'
  const good = `sha256=${createHmac('sha256', 'segreto').update(body).digest('hex')}`
  assert.equal(verifySignature(body, good, 'segreto'), true)
  assert.equal(verifySignature(body, good, 'altro'), false)
  assert.equal(verifySignature(body, 'sha256=00', 'segreto'), false)
  assert.equal(verifySignature(body, null, 'segreto'), false)
  assert.equal(verifySignature(body, good, undefined), false)
})

check('parseInbound prende solo i messaggi di testo; sameNumber confronta le cifre', () => {
  const payload = {
    entry: [{ changes: [{ value: { messages: [
      { id: 'm1', from: '393331234567', type: 'text', timestamp: '1759560000', text: { body: ' Sterling, quanto ho speso? ' } },
      { id: 'm2', from: '393331234567', type: 'image' },
      { id: 'm3', from: '41791112233', type: 'text', text: { body: 'ciao' } },
    ] } }] }],
  }
  const msgs = parseInbound(payload)
  assert.equal(msgs.length, 2)
  assert.deepEqual(msgs[0], { id: 'm1', from: '393331234567', text: 'Sterling, quanto ho speso?', at: '2025-10-04T06:40:00.000Z' })
  assert.equal(sameNumber('+39 333 1234567', msgs[0].from), true)
  assert.equal(sameNumber('393331234567', msgs[1].from), false)
  assert.equal(sameNumber('', ''), false)
  assert.deepEqual(parseInbound({ boh: 1 }), [])
})

check('routeMessage: comandi, dirigente per nome, altrimenti Grace', () => {
  assert.deepEqual(routeMessage('brief'), { kind: 'brief' })
  assert.deepEqual(routeMessage('Board'), { kind: 'board' })
  assert.deepEqual(routeMessage('riunisci il board'), { kind: 'convene' })
  assert.deepEqual(routeMessage('?'), { kind: 'help' })
  assert.deepEqual(routeMessage('Sterling, quanto ho speso in abbonamenti?'), { kind: 'ask', executive: 'sterling', question: 'quanto ho speso in abbonamenti?' })
  assert.deepEqual(routeMessage('@archer chi devo richiamare'), { kind: 'ask', executive: 'archer', question: 'chi devo richiamare' })
  assert.deepEqual(routeMessage('Mario, dimmi tutto'), { kind: 'ask', executive: 'grace', question: 'Mario, dimmi tutto' })
})

check('chunkText spezza sulle righe entro il limite; answerToText mette le fonti in piccolo', () => {
  const long = Array.from({ length: 30 }, (_, i) => `riga ${i} ${'x'.repeat(200)}`).join('\n')
  const parts = chunkForPhone(long, 1000)
  assert.ok(parts.length >= 6)
  assert.ok(parts.every((p) => p.length <= 1000))
  assert.equal(parts.join('\n'), long)
  const text = answerToText('Sterling', [{ text: 'Tre pagamenti senza fattura.', sources: [{ source: 'qonto', title: 'Pagamento', occurredAt: '2026-10-01T00:00:00Z' }] }], ['Manca il mese.'])
  assert.ok(text.startsWith('*Sterling*\n• Tre pagamenti'))
  assert.ok(text.includes('_Conto 01/10 · Pagamento_'))
  assert.ok(text.includes('↳ Manca il mese.'))
  assert.equal(compactLine('a\n\n  b   c', 5), 'a b c')
  assert.equal(compactLine('abcdefgh', 5), 'abcd…')
})

/* ------------------------------------------------------------------ *
 * initiatives: farsi vivi, una volta, con misura
 * ------------------------------------------------------------------ */

const ini = (key: string, executive: string, weight: number, urgent = false): Initiative => ({
  key, executive, kind: 'waiting', text: key, urgent, weight,
})

check('isQuietHour: di notte in ora italiana, con il cambio d\'ora grossolano', () => {
  assert.equal(isQuietHour(new Date('2026-10-04T20:30:00Z')), true) // 22:30 a Roma
  assert.equal(isQuietHour(new Date('2026-10-04T07:00:00Z')), false) // 09:00
  assert.equal(isQuietHour(new Date('2026-12-04T06:30:00Z')), true) // 07:30 d'inverno
  assert.equal(isQuietHour(new Date('2026-12-04T07:30:00Z')), false) // 08:30
})

check('pickInitiatives: niente ripetizioni, budget per dirigente e totale, ordine per peso', () => {
  const now = new Date('2026-10-04T10:00:00Z')
  const cands = [
    ini('a', 'grace', 90), ini('b', 'grace', 80), ini('c', 'grace', 70),
    ini('d', 'sterling', 60), ini('e', 'sterling', 50), ini('f', 'sterling', 40),
    ini('g', 'archer', 30), ini('h', 'nova', 20), ini('i', 'harper', 10),
  ]
  const picked = pickInitiatives(cands, { now, sent: new Set(['a']) })
  assert.deepEqual(picked.map((p) => p.key), ['b', 'c', 'd', 'e', 'g', 'h'])
  const small = pickInitiatives(cands, { now, sent: new Set(), perExecutive: 1, total: 2 })
  assert.deepEqual(small.map((p) => p.key), ['a', 'd'])
})

check('di notte passano solo le urgenze', () => {
  const night = new Date('2026-10-04T21:00:00Z') // 23:00 a Roma
  const picked = pickInitiatives([ini('x', 'grace', 10), ini('y', 'grace', 100, true)], { now: night, sent: new Set() })
  assert.deepEqual(picked.map((p) => p.key), ['y'])
})

check('weekKey e inHowLong', () => {
  assert.equal(weekKey(new Date('2026-10-04T10:00:00Z')), '2026-W40')
  assert.equal(weekKey(new Date('2026-10-05T10:00:00Z')), '2026-W41')
  const now = new Date('2026-10-04T10:00:00Z')
  assert.equal(inHowLong('2026-10-04T11:40:00Z', now), 'fra 1 h 40')
  assert.equal(inHowLong('2026-10-04T10:25:00Z', now), 'fra 25 min')
  assert.equal(inHowLong('2026-10-04T12:00:00Z', now), 'fra 2 h')
})

/* ------------------------------------------------------------------ *
 * docx: un contratto com'è davvero
 * ------------------------------------------------------------------ */

/** Uno zip minimo, costruito a mano: basta a provare il lettore. */
function zipOf(entries: { name: string; data: Buffer; deflate?: boolean }[]): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const payload = e.deflate ? deflateRawSync(e.data) : e.data
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(e.deflate ? 8 : 0, 8)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(e.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    parts.push(local, name, payload)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(e.deflate ? 8 : 0, 10)
    c.writeUInt32LE(payload.length, 20)
    c.writeUInt32LE(e.data.length, 24)
    c.writeUInt16LE(name.length, 28)
    c.writeUInt32LE(offset, 42)
    central.push(c, name)
    offset += local.length + name.length + payload.length
  }
  const cd = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cd, eocd])
}

check('readZip legge voci memorizzate e compresse; docxToText tira fuori i paragrafi', () => {
  const xml = `<w:document><w:body><w:p><w:r><w:t>Art. 1 &#8211; Durata</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Il contratto ha durata di </w:t></w:r><w:r><w:t>dodici (12) mesi</w:t></w:r><w:r><w:tab/><w:t>&amp; preavviso</w:t></w:r></w:p><w:p/></w:body></w:document>`
  const zip = zipOf([
    { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
    { name: 'word/document.xml', data: Buffer.from(xml), deflate: true },
  ])
  const names = readZip(zip).map((e) => e.name)
  assert.deepEqual(names, ['[Content_Types].xml', 'word/document.xml'])
  assert.equal(docxToText(zip), 'Art. 1 – Durata\nIl contratto ha durata di dodici (12) mesi\t& preavviso')
  assert.equal(docxToText(Buffer.from('non uno zip')), '')
  assert.equal(textFromDocumentXml('<w:p><w:r><w:t>a</w:t><w:br/><w:t>b</w:t></w:r></w:p>'), 'a\nb')
})

/* ------------------------------------------------------------------ *
 * practice: lo studio
 * ------------------------------------------------------------------ */

const touch = (id: string, day: string, who: string, over: Partial<TouchLike> = {}): TouchLike => ({
  id, kind: 'email', title: 'x', occurredAt: `${day}T10:00:00Z`, participants: ['me@mio.it', who], minutes: null, fromOwner: false, ...over,
})

check('matterKey, matterTokens ed estimateMinutes', () => {
  assert.equal(matterKey('Anna@StudioVerdi.it'), 'studioverdi.it')
  assert.deepEqual(matterTokens('studioverdi.it', ['anna.rossi@studioverdi.it']), ['studioverdi', 'anna', 'rossi'])
  assert.equal(estimateMinutes(touch('e', '2026-10-01', 'a@b.it', { kind: 'event', minutes: 45 })), 45)
  assert.equal(estimateMinutes(touch('e', '2026-10-01', 'a@b.it', { kind: 'event', minutes: null })), 60)
  assert.equal(estimateMinutes(touch('m', '2026-10-01', 'a@b.it', { fromOwner: true })), 10)
})

check('buildMatters stima le ore, trova le fatture del cliente, segna chi è nuovo e chi è senza incarico', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  const touches = [
    touch('v1', '2026-08-20', 'anna@studioverdi.it', { kind: 'event', minutes: 90 }),
    touch('v2', '2026-09-10', 'anna@studioverdi.it', { fromOwner: true }),
    touch('v3', '2026-09-20', 'anna@studioverdi.it', { kind: 'event', minutes: 120 }),
    touch('v4', '2026-09-28', 'luca@studioverdi.it', { fromOwner: true }),
    touch('n1', '2026-10-02', 'nuovo@acme.com'),
    touch('n2', '2026-10-03', 'nuovo@acme.com'),
  ]
  const invoices = [{ id: 'i1', counterparty: 'STUDIOVERDI SRL', amountCents: 250000, occurredAt: '2026-09-01T00:00:00Z' }]
  const docs = [{ id: 'd1', title: 'Lettera di incarico Acme 2026', occurredAt: '2026-10-01T00:00:00Z' }]
  const matters = buildMatters(touches, invoices, docs, 'me@mio.it', now)
  assert.deepEqual(matters.map((m) => m.key), ['acme.com', 'studioverdi.it'])
  const verdi = matters[1]
  assert.equal(verdi.hours, 3.8) // 90 + 10 + 120 + 10 minuti
  assert.equal(verdi.unbilledHours, 2.3) // dopo la fattura del 1/9: 10 + 120 + 10
  assert.equal(verdi.lastInvoiceCents, 250000)
  assert.equal(verdi.engagement, null)
  assert.equal(verdi.isNew, false)
  const acme = matters[0]
  assert.equal(acme.isNew, true)
  assert.equal(acme.engagement?.id, 'd1')
  assert.deepEqual(newContacts(matters).map((m) => m.key), ['acme.com'])
  assert.deepEqual(withoutEngagement(matters, 3).map((m) => m.key), ['studioverdi.it'])
  assert.deepEqual(unbilled(matters, now, 2, 30).map((m) => m.key), ['studioverdi.it'])
  assert.deepEqual(unbilled(matters, now, 2, 60), [])
})

/* ------------------------------------------------------------------ *
 * policy: le regole che l'esecutore applica prima di ogni gesto
 * ------------------------------------------------------------------ */

check('requiresApproval: il pagamento e la mail sempre; il check-in no, salvo opt-out', () => {
  assert.equal(requiresApproval('payment'), true)
  assert.equal(requiresApproval('send_email'), true)
  assert.equal(requiresApproval('browse'), false)
  assert.equal(requiresApproval('form', { isCheckin: true }), false)
  assert.equal(requiresApproval('form', { isCheckin: true, autoCheckin: false }), true)
  assert.equal(requiresApproval('form'), true)
  assert.equal(requiresApproval('signup'), false)
  assert.equal(requiresApproval('signup', { allowNewsletter: false }), true)
  assert.equal(payCapCents({}), 30000)
  assert.equal(payCapCents({ BRAIN_PAY_CAP_EUR: '150' }), 15000)
  assert.equal(withinCap(12000, 30000), true)
  assert.equal(withinCap(45000, 30000), false)
})

check('parseDecision e matchPending: un "ok" senza codice vale solo se la richiesta è una', () => {
  assert.deepEqual(parseDecision('ok'), { decision: 'yes', code: null })
  assert.deepEqual(parseDecision('Sì, vai!'), { decision: 'yes', code: null })
  assert.equal(parseDecision('no grazie')?.decision, 'no')
  assert.equal(parseDecision('che tempo fa?'), null)
  const now = new Date('2026-10-06T10:00:00Z')
  const a = { taskId: 't1', approval: newApproval('t1', 'payment', 'paga', now, { amountCents: 100 }) }
  const b = { taskId: 't2', approval: newApproval('t2', 'send_email', 'manda', now) }
  assert.equal(matchPending({ decision: 'yes', code: null }, [a], now).match?.taskId, 't1')
  const two = matchPending({ decision: 'yes', code: null }, [a, b], now)
  assert.equal(two.match, null)
  assert.equal(two.ambiguous, true)
  const withCode = parseDecision(`ok ${b.approval.code}`)!
  assert.equal(withCode.code, b.approval.code)
  assert.equal(matchPending(withCode, [a, b], now).match?.taskId, 't2')
  // Il pagamento scade in un'ora.
  const later = new Date('2026-10-06T11:30:00Z')
  assert.equal(matchPending({ decision: 'yes', code: null }, [a], later).match, null)
  assert.equal(approvalCode('t1'), approvalCode('t1'))
  assert.match(approvalCode('t1'), /^[A-HJ-NP-Z2-9]{2}\d[A-HJ-NP-Z2-9]$/)
  assert.equal(parseDecision('va bene')?.code, null)
})

check('le guardie del browser: bottoni che pagano, campi della carta, importo visibile, domini', () => {
  assert.equal(isPaymentAction('Paga ora'), true)
  assert.equal(isPaymentAction('Conferma e paga'), true)
  assert.equal(isPaymentAction('Place order'), true)
  assert.equal(isPaymentAction('Aggiungi al carrello'), false)
  assert.equal(isPaymentAction('Check-in'), false)
  assert.equal(isSensitiveField('input name=cardnumber autocomplete=cc-number'), true)
  assert.equal(isSensitiveField('CVV'), true)
  assert.equal(isSensitiveField('email'), false)
  assert.equal(amountVisible('Totale: 1.112,45 €', 111245), true)
  assert.equal(amountVisible('Total €112.45', 11245), true)
  assert.equal(amountVisible('Totale 112,46', 11245), false)
  assert.equal(amountVisible('Totale € 140', 14000), true)
  assert.equal(registrableDomain('https://www.ryanair.com/it/it/check-in'), 'ryanair.com')
  assert.equal(registrableDomain('https://shop.example.co.uk/x'), 'example.co.uk')
  assert.equal(canActOn('https://www.ryanair.com/it', ['ryanair.com']), true)
  assert.equal(canActOn('https://checkout.stripe.com/pay', ['on.com']), true)
  assert.equal(canActOn('https://ryanair-checkin.example.com', ['ryanair.com']), false)
})

/* ------------------------------------------------------------------ *
 * travel: i voli nelle mail
 * ------------------------------------------------------------------ */

const RYANAIR = `Grazie per aver prenotato con Ryanair.
Codice di prenotazione: K7QX2B
Volo FR 1234  BGY - STN
Ven, 17 ott 2026  partenza 06:30  arrivo 07:40
Passeggero: MARIO ROSSI`

check('parseFlight legge una conferma Ryanair: PNR, volo, aeroporti, partenza in UTC', () => {
  const f = parseFlight(RYANAIR, 'noreply@ryanair.com', '2026-10-06T08:00:00Z')
  assert.ok(f)
  assert.equal(f.airline.key, 'ryanair')
  assert.equal(f.pnr, 'K7QX2B')
  assert.equal(f.flightNumber, 'FR1234')
  assert.equal(f.from, 'BGY')
  assert.equal(f.to, 'STN')
  assert.equal(f.departureLocal, '2026-10-17 06:30')
  assert.equal(f.departureIso, '2026-10-17T04:30:00.000Z')
  assert.equal(findPnr('Booking reference: 123456'), null)
  assert.equal(parseFlight('Nessun volo qui', 'a@b.it', '2026-10-06T08:00:00Z'), null)
  // Un volo già passato non diventa un mandato.
  assert.equal(parseFlight(RYANAIR, 'noreply@ryanair.com', '2026-11-01T08:00:00Z'), null)
})

check('checkinPlan: primo tentativo all\'apertura, poi ogni tre ore fino a poco prima della chiusura', () => {
  const f = parseFlight(RYANAIR, 'noreply@ryanair.com', '2026-10-06T08:00:00Z')!
  const plan = checkinPlan(f)
  assert.equal(plan.firstAttemptIso, '2026-10-15T04:35:00.000Z')
  assert.equal(plan.lastAttemptIso, '2026-10-17T01:30:00.000Z')
  assert.equal(nextAttempt(plan, new Date('2026-10-15T05:00:00Z')), '2026-10-15T08:00:00.000Z')
  assert.equal(nextAttempt(plan, new Date('2026-10-17T00:00:00Z')), null)
})

/* ------------------------------------------------------------------ *
 * payments: IBAN, pagoPA, bollo
 * ------------------------------------------------------------------ */

check('validIban usa il mod-97; findIban trova solo IBAN validi', () => {
  assert.equal(validIban('IT60 X054 2811 1010 0000 0123 456'), true)
  assert.equal(validIban('IT60X0542811101000000123457'), false)
  assert.equal(findIban('Bonifico su IT60 X054 2811 1010 0000 0123 456 intestato a Studio'), 'IT60X0542811101000000123456')
  assert.equal(formatIban('IT60X0542811101000000123456'), 'IT60 X054 2811 1010 0000 0123 456')
})

check('parsePaymentNotice: un avviso pagoPA del bollo auto e una fattura con IBAN', () => {
  const bollo = parsePaymentNotice(`Regione del Veneto - Tassa automobilistica
Targa: AB123CD
Codice avviso: 3012 3456 7890 1234 56
Codice fiscale ente: 80007580279
Importo: 187,64 euro
Scadenza: 31/10/2026`)
  assert.ok(bollo)
  assert.equal(bollo.kind, 'pagopa')
  assert.equal(bollo.noticeCode, '301234567890123456')
  assert.equal(bollo.creditorCode, '80007580279')
  assert.equal(bollo.plate, 'AB123CD')
  assert.equal(bollo.amountCents, 18764)
  assert.equal(bollo.dueDate, '2026-10-31')
  const pack = paymentPack(bollo)
  assert.ok(pack.includes('Codice avviso: 301234567890123456'))
  assert.ok(pack.includes('Importo: € 187,64'))
  assert.ok(pack.includes('Scadenza: 31/10/2026'))

  const fattura = parsePaymentNotice(`Fattura n. 42/2026
Beneficiario: Studio Bianchi Commercialisti
IBAN IT60 X054 2811 1010 0000 0123 456
Causale: saldo fattura 42/2026
Totale da pagare € 1.220,00 entro il 15 novembre 2026`)
  assert.ok(fattura)
  assert.equal(fattura.kind, 'bonifico')
  assert.equal(fattura.amountCents, 122000)
  assert.equal(fattura.beneficiary, 'Studio Bianchi Commercialisti')
  assert.equal(fattura.causale, 'saldo fattura 42/2026')
  assert.equal(fattura.dueDate, '2026-11-15')
  assert.ok(paymentPack(fattura).includes('IBAN: IT60 X054 2811 1010 0000 0123 456'))
  assert.equal(parsePaymentNotice('Ciao, ci vediamo giovedì'), null)
})

/* ------------------------------------------------------------------ *
 * invites: il "no, grazie" quando l'agenda è piena
 * ------------------------------------------------------------------ */

check('isInvitation, parseInvitation, conflicts e declineText', () => {
  const subject = 'Invito: AI & Law Night'
  const body = 'Caro Marco, siamo lieti di invitarti alla AI & Law Night il 22 ottobre 2026 alle 18:30 presso Talent Garden. Conferma la tua partecipazione.'
  assert.equal(isInvitation(subject, body), true)
  assert.equal(isInvitation('Newsletter di ottobre', 'Join us il 22 ottobre. Unsubscribe'), false)
  const inv = parseInvitation(subject, body, '2026-10-06T08:00:00Z')
  assert.ok(inv)
  assert.equal(inv.day, '2026-10-22')
  assert.equal(inv.timeLocal, '18:30')
  assert.equal(inv.startIso, '2026-10-22T16:30:00.000Z')
  assert.equal(inv.title, 'AI & Law Night')
  const busy = [{ start: '2026-10-22T16:00:00Z', end: '2026-10-22T18:00:00Z', title: 'Cena cliente' }, { start: '2026-10-23T16:00:00Z', end: '2026-10-23T18:00:00Z' }]
  assert.deepEqual(conflicts(inv, busy).map((b) => b.title), ['Cena cliente'])
  const text = declineText(inv, 'Giulia')
  assert.ok(text.startsWith('Gentile Giulia,'))
  assert.ok(text.includes('"AI & Law Night" del 22/10/2026 alle 18:30'))
})

/* ------------------------------------------------------------------ *
 * mime: la mail che Gmail spedisce
 * ------------------------------------------------------------------ */

check('buildMime: intestazioni di risposta, oggetto con accenti, allegato in base64', () => {
  assert.equal(encodeHeader('Re: fattura'), 'Re: fattura')
  assert.equal(encodeHeader('Ricevuta già pagata'), `=?UTF-8?B?${Buffer.from('Ricevuta già pagata').toString('base64')}?=`)
  const raw = buildMime({
    to: ['anna@studio.it'],
    subject: 'Re: Fattura n. 42',
    text: 'Pagata, grazie.',
    inReplyTo: '<abc@mail.gmail.com>',
    attachments: [{ filename: 'ricevuta.pdf', mimeType: 'application/pdf', data: new Uint8Array([37, 80, 68, 70]) }],
    boundary: 'XYZ',
  })
  assert.ok(raw.includes('To: anna@studio.it\r\n'))
  assert.ok(raw.includes('In-Reply-To: <abc@mail.gmail.com>\r\nReferences: <abc@mail.gmail.com>'))
  assert.ok(raw.includes('Content-Type: multipart/mixed; boundary="XYZ"'))
  assert.ok(raw.includes(Buffer.from('Pagata, grazie.').toString('base64')))
  assert.ok(raw.includes('filename="ricevuta.pdf"'))
  assert.ok(raw.includes('JVBERg=='))
  assert.ok(raw.endsWith('--XYZ--'))
  assert.equal(toBase64Url('??>'), 'Pz8-')
})

/* ------------------------------------------------------------------ *
 * mandates: i comandi del titolare
 * ------------------------------------------------------------------ */

check('parseWhen: relativo, domani, giorno della settimana, data e ora', () => {
  const now = new Date('2026-10-06T08:00:00Z') // martedì 10:00 a Roma
  assert.equal(parseWhenCmd('fra 2 ore chiama Verdi', now)?.atIso, '2026-10-06T10:00:00.000Z')
  assert.equal(parseWhenCmd('tra mezz\'ora', now)?.atIso, '2026-10-06T08:30:00.000Z')
  assert.equal(parseWhenCmd('domani alle 9 di chiamare Verdi', now)?.atIso, '2026-10-07T07:00:00.000Z')
  assert.equal(parseWhenCmd('domani alle 9 di chiamare Verdi', now)?.rest, 'di chiamare Verdi')
  assert.equal(parseWhenCmd('venerdì alle 15:30', now)?.atIso, '2026-10-09T13:30:00.000Z')
  assert.equal(parseWhenCmd('il 12/11 alle 18', now)?.atIso, '2026-11-12T17:00:00.000Z')
  assert.equal(parseWhenCmd('alle 9', now)?.atIso, '2026-10-07T07:00:00.000Z')
  assert.equal(parseWhenCmd('chiama Verdi', now), null)
})

check('parseCommand riconosce gli incarichi e lascia le domande al board', () => {
  const now = new Date('2026-10-06T08:00:00Z')
  assert.equal(parseCommand('Comprami le On Cloud 6 taglia 43 dal sito ufficiale', now)?.kind, 'buy')
  assert.equal(parseCommand('paga il bollo auto', now)?.kind, 'pay')
  assert.equal(parseCommand('fai il check-in del volo di venerdì', now)?.kind, 'checkin')
  assert.equal(parseCommand('disdici l\'abbonamento a Netflix', now)?.kind, 'errand')
  const r = parseCommand('ricordami domani alle 9 di chiamare Verdi', now)
  assert.deepEqual(r, { kind: 'remind', what: 'chiamare Verdi', atIso: '2026-10-07T07:00:00.000Z' })
  assert.deepEqual(parseCommand('mandati', now), { kind: 'tasks' })
  assert.equal(parseCommand('quanto ho speso in abbonamenti?', now), null)
})

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed > 0) process.exit(1)
