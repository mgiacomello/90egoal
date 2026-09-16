// Test del nucleo deterministico di BRAIN. Zero dipendenze: `npm run test:brain`.
import assert from 'node:assert/strict'
import { chunkDocument, chunkText, normalizeText } from '../lib/brain/chunk.ts'
import { fold, queryTerms, rankHits, recencyWeight, selectSources, toFtsQuery } from '../lib/brain/rank.ts'
import { extractFacts, parseHandles, verifyClaims } from '../lib/brain/cite.ts'
import { pickModel } from '../lib/brain/orchestrator.ts'
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

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed > 0) process.exit(1)
