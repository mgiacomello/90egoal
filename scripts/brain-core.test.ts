// Test del nucleo deterministico di BRAIN. Zero dipendenze: `npm run test:brain`.
import assert from 'node:assert/strict'
import { chunkDocument, chunkText, normalizeText } from '../lib/brain/chunk.ts'
import { fold, queryTerms, rankHits, recencyWeight, selectSources, toFtsQuery } from '../lib/brain/rank.ts'
import { extractFacts, parseHandles, verifyClaims } from '../lib/brain/cite.ts'
import { pickModel } from '../lib/brain/orchestrator.ts'
import { isAuthorizedCron } from '../lib/brain/cron.ts'
import { matchQuote, normalizeForMatch, tokenize } from '../lib/brain/quote.ts'
import { assessExtraction } from '../lib/brain/pdf.ts'
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
