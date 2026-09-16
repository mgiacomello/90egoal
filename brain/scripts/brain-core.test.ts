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
    ...partial,
  }
}

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

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed > 0) process.exit(1)
