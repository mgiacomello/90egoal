// Test del gioco 90 & Goal: orari, motore live, squadre. Zero dipendenze: `npm run test:game`.
import assert from 'node:assert/strict'
import { romeToUtcIso, utcToRome, firstKickoffIso } from '../lib/time.ts'
import { parseMinute, formatMinute, buildDettaglio, deriveRisultato, type PartitaLive } from '../lib/live.ts'
import { nomeBreve, isPlaceholder, squadreDi, sigla, parseElencoPartite } from '../lib/teams.ts'

let passed = 0
let failed = 0
function check(name: string, fn: () => void) {
  try { fn(); passed++ } catch (err) { failed++; console.error(`✗ ${name}\n  ${(err as Error).message.split('\n')[0]}`) }
}

/* --- orari: ora di Roma in, UTC fuori --- */

check('17 ottobre 14:30 a Roma è ora legale: 12:30 UTC', () => {
  assert.equal(romeToUtcIso('2026-10-17', '14:30'), '2026-10-17T12:30:00.000Z')
})
check('7 novembre 15:00 a Roma è ora solare: 14:00 UTC', () => {
  assert.equal(romeToUtcIso('2026-11-07', '15:00'), '2026-11-07T14:00:00.000Z')
})
check('il giorno del cambio d\'ora (25 ottobre) il pomeriggio è già ora solare', () => {
  assert.equal(romeToUtcIso('2026-10-25', '15:00'), '2026-10-25T14:00:00.000Z')
})
check('andata e ritorno Roma → UTC → Roma', () => {
  assert.deepEqual(utcToRome(romeToUtcIso('2026-11-01', '12:30')), { date: '2026-11-01', time: '12:30' })
  assert.deepEqual(utcToRome('2026-06-10T22:00:00.000Z'), { date: '2026-06-11', time: '00:00' })
})
check('la scadenza naturale è il primo calcio d\'inizio', () => {
  const iso = firstKickoffIso([
    { date: '2026-10-17', ora: '15:00' },
    { date: '2026-10-17', ora: '14:30' },
    { date: '2026-10-17', ora: null },
  ])
  assert.equal(iso, '2026-10-17T12:30:00.000Z')
})
check('senza orari non c\'è una scadenza da proporre', () => {
  assert.equal(firstKickoffIso([{ date: '2026-11-01', ora: null }]), null)
})

/* --- minuti --- */

check('minuti normali, con o senza apice', () => {
  assert.deepEqual(parseMinute("23'"), { base: 23, extra: 0 })
  assert.deepEqual(parseMinute('90'), { base: 90, extra: 0 })
  assert.deepEqual(parseMinute('45 + 2’'), { base: 45, extra: 2 })
})
check('il recupero esiste solo a fine tempo', () => {
  assert.equal(parseMinute('60+2'), null)
  assert.equal(parseMinute('0'), null)
  assert.equal(parseMinute('abc'), null)
  assert.equal(parseMinute('45+0'), null)
})
check('formato di ritorno', () => {
  assert.equal(formatMinute({ base: 90, extra: 3 }), "90+3'")
  assert.equal(formatMinute({ base: 7, extra: 0 }), "7'")
})

/* --- dettaglio partita --- */

const REG: PartitaLive = { home: 'Reggiana', away: 'Torres', date: '2026-10-17', ora: '14:30' }
const ASC: PartitaLive = { home: 'Ascoli', away: 'Empoli', date: '2026-10-17', ora: '15:00' }

check('punteggio e minuti si ricavano dai gol, in ordine di gioco', () => {
  const d = buildDettaglio(REG, [
    { min: '46', team: 'Torres' },
    { min: '45+2', team: 'Reggiana' },
    { min: '12', team: 'Reggiana' },
  ], 'in_corso')
  assert.equal(d.score, '2-1')
  assert.deepEqual(d.minuti, ["12'", "45+2'", "46'"])
})
check('un gol attribuito a una squadra che non gioca non entra', () => {
  const d = buildDettaglio(REG, [{ min: '10', team: 'Empoli' }], 'in_corso')
  assert.equal(d.score, '0-0')
  assert.equal(d.gol.length, 0)
})

/* --- risultato della schedina --- */

check('minuti validi solo 1–90, doppioni una volta sola, recupero a parte', () => {
  const r = deriveRisultato([REG, ASC], [
    buildDettaglio(REG, [{ min: '23', team: 'Reggiana' }, { min: '90+3', team: 'Torres' }], 'finita'),
    buildDettaglio(ASC, [{ min: '23', team: 'Empoli' }, { min: '45+1', team: 'Ascoli' }], 'finita'),
  ])
  assert.deepEqual(r.minuti_gol, [23])
  assert.equal(r.recupero, 'entrambi')
  assert.equal(r.completa, true)
})
check('prima e ultima squadra seguono l\'orario reale, non l\'ordine di inserimento', () => {
  // Reggiana segna al 20' (14:50). Empoli segna al 10' ma la partita inizia alle 15:00 (15:10).
  const r = deriveRisultato([REG, ASC], [
    buildDettaglio(ASC, [{ min: '10', team: 'Empoli' }], 'finita'),
    buildDettaglio(REG, [{ min: '20', team: 'Reggiana' }, { min: '50', team: 'Torres' }], 'finita'),
  ])
  assert.equal(r.first_goal_team, 'Reggiana')
  // Torres al 50' della partita delle 14:30 ≈ 15:37; Empoli al 10' ≈ 15:10.
  assert.equal(r.last_goal_team, 'Torres')
})
check('il 45+3 del primo tempo viene prima del 46 di una partita iniziata insieme', () => {
  const B: PartitaLive = { home: 'Carpi', away: 'Lumezzane', date: '2026-10-17', ora: '14:30' }
  const r = deriveRisultato([REG, B], [
    buildDettaglio(REG, [{ min: '46', team: 'Torres' }], 'finita'),
    buildDettaglio(B, [{ min: '45+3', team: 'Carpi' }], 'finita'),
  ])
  assert.equal(r.first_goal_team, 'Carpi')
  assert.equal(r.last_goal_team, 'Torres')
})
check('schedina a metà: conta le partite in corso e non si dichiara completa', () => {
  const r = deriveRisultato([REG, ASC], [buildDettaglio(REG, [], 'in_corso')])
  assert.equal(r.inCorso, 1)
  assert.equal(r.completa, false)
  assert.equal(r.first_goal_team, null)
  assert.equal(r.recupero, 'nessuno')
})

/* --- squadre e nomi --- */

check('nome breve: via il suffisso dei Mondiali, i nomi nuovi restano', () => {
  assert.equal(nomeBreve('Schedina 1 — Mondiali FIFA 2026'), 'Schedina 1')
  assert.equal(nomeBreve('Giornata del 17 ottobre'), 'Giornata del 17 ottobre')
})
check('i segnaposto del tabellone non sono squadre, i club sì', () => {
  assert.equal(isPlaceholder('Vinc. USA-Belgio'), true)
  assert.equal(isPlaceholder('Da definire'), true)
  assert.equal(isPlaceholder('Vicenza'), false)
  assert.deepEqual(squadreDi([{ home: 'Reggiana', away: 'Torres' }, { home: 'Torres', away: 'Vinc. A-B' }]), ['Reggiana', 'Torres'])
})
check('sigle leggibili per i club', () => {
  assert.equal(sigla('Juve Stabia'), 'JS')
  assert.equal(sigla('Reggiana'), 'RE')
  assert.equal(sigla('Atalanta Under 23'), 'AT')
  assert.equal(sigla('LR Vicenza'), 'LV')
})

/* --- incolla elenco, con il documento di Max --- */

check('elenco come arriva da Word: ore, suffisso di serie attaccato, trattini lunghi', () => {
  const { partite, scartate } = parseElencoPartite([
    'Ore 14.30',
    'Reggiana – Torres Serie C',
    'Vado – Sanbenedettese',
    'Carpi - Lumezzane',
    'Ore 15.00',
    'Ascoli – EmpoliSerie B',
    'Venezia – NapoliSerie A',
    'Carpi Renate',
  ].join('\n'))
  assert.equal(partite.length, 5)
  assert.deepEqual(partite[0], { home: 'Reggiana', away: 'Torres', competizione: 'Serie C', ora: '14:30' })
  assert.deepEqual(partite[2], { home: 'Carpi', away: 'Lumezzane', competizione: 'Serie C', ora: '14:30' })
  assert.deepEqual(partite[3], { home: 'Ascoli', away: 'Empoli', competizione: 'Serie B', ora: '15:00' })
  assert.equal(partite[4].competizione, 'Serie A')
  assert.deepEqual(scartate, ['Carpi Renate'])
})
check('i nomi con il trattino dentro restano interi', () => {
  const { partite } = parseElencoPartite('Sant-Etienne - Paris-FC')
  assert.deepEqual([partite[0].home, partite[0].away], ['Sant-Etienne', 'Paris-FC'])
})

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed) process.exit(1)
