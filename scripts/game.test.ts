// Test del gioco 90 & Goal: orari, motore live, squadre. Zero dipendenze: `npm run test:game`.
import assert from 'node:assert/strict'
import { romeToUtcIso, utcToRome, firstKickoffIso } from '../lib/time.ts'
import { parseMinute, formatMinute, buildDettaglio, deriveRisultato, type PartitaLive } from '../lib/live.ts'
import { nomeBreve, isPlaceholder, squadreDi, sigla, parseElencoPartite } from '../lib/teams.ts'
import { parseMarcatore, magliaDi } from '../lib/kits.ts'
import { suPiuGiorni, quandoPartita, fineStimataIso, inCorso, delMomento } from '../lib/giornata.ts'
import { privacyDaAccettare, PRIVACY_VERSIONE } from '../lib/privacy.ts'
import { conPosizioni, ultimoTurno, classificaGenerale, daMostrare, distacco, etichettaGiornata } from '../lib/classifica.ts'
import { serieDi, stessaSquadra, abbina, statoDaFeed, eventiDaElenco, golDaIncidenti, golCoerenti, golNuovi, unisciDettagli, type EventoFeed } from '../lib/feed.ts'
import { golPreso, messaggioGol, posizioni, messaggioFinale, type GolPush } from '../lib/push.ts'

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
check('prima e ultima squadra: un gol nel recupero non conta, anche se arriva prima', () => {
  const B: PartitaLive = { home: 'Carpi', away: 'Lumezzane', date: '2026-10-17', ora: '14:30' }
  const r = deriveRisultato([REG, B], [
    buildDettaglio(REG, [{ min: '46', team: 'Torres' }, { min: '90+4', team: 'Reggiana' }], 'finita'),
    buildDettaglio(B, [{ min: '45+3', team: 'Carpi' }, { min: '60', team: 'Lumezzane' }], 'finita'),
  ])
  assert.equal(r.first_goal_team, 'Torres')      // il 45+3 del Carpi è recupero
  assert.equal(r.last_goal_team, 'Lumezzane')    // il 90+4 della Reggiana è recupero
  assert.equal(r.recupero, 'entrambi')           // ma il bonus recupero scatta lo stesso
})
check('solo gol nel recupero: nessuna prima o ultima squadra', () => {
  const r = deriveRisultato([REG], [buildDettaglio(REG, [{ min: '90+2', team: 'Torres' }], 'finita')])
  assert.equal(r.first_goal_team, null)
  assert.equal(r.last_goal_team, null)
})
check('minuto del primo gol e squadre prima/ultima: nei 90\', in ordine di orario, recupero escluso', () => {
  // Reggiana (14:30) segna al 20' → 14:50. Empoli (15:00) segna al 10' → 15:10 e al 90+3 (non conta).
  const r = deriveRisultato([REG, ASC], [
    buildDettaglio(ASC, [{ min: '10', team: 'Empoli' }, { min: '90+3', team: 'Ascoli' }], 'finita'),
    buildDettaglio(REG, [{ min: '20', team: 'Reggiana' }], 'finita'),
  ])
  assert.equal(r.minuto_primo_gol, 20)
  assert.equal(r.minuto_ultimo_gol, null)   // l'ultimo gol non vale più doppio
  assert.equal(r.first_goal_team, 'Reggiana')
  assert.equal(r.last_goal_team, 'Empoli')   // il 90+3 dell'Ascoli è recupero: non conta
})
check('solo gol nel recupero: nessun minuto doppio', () => {
  const r = deriveRisultato([REG], [buildDettaglio(REG, [{ min: '45+1', team: 'Torres' }], 'finita')])
  assert.equal(r.minuto_primo_gol, null)
  assert.equal(r.minuto_ultimo_gol, null)
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

/* --- notifiche push --- */

const G = (min: string, base: number, extra = 0): GolPush => ({ schedinaId: 9, home: 'Reggiana', away: 'Torres', score: '1-0', min, base, extra, team: 'Reggiana' })
const PRON = { minuti: [5, 23, 67], recupero: 'primo' as const }

check('un gol è "tuo" se cade nei tuoi minuti o nel recupero che hai scelto', () => {
  assert.equal(golPreso(G("23'", 23), PRON), true)
  assert.equal(golPreso(G("24'", 24), PRON), false)
  assert.equal(golPreso(G("45+2'", 45, 2), PRON), true)
  assert.equal(golPreso(G("90+1'", 90, 1), PRON), false)
})
check('gol preso: titolo che festeggia, con la partita nel testo', () => {
  const n = messaggioGol(G("23'", 23), PRON, 'tutti')!
  assert.equal(n.title, "🎯 Il tuo 23' è uscito!")
  assert.equal(n.body, 'Reggiana 1-0 Torres · segna Reggiana')
})
check('il tocco sulla notifica apre il popup del gol, con il marcatore se c\'è', () => {
  const n = messaggioGol({ ...G("23'", 23), scorer: 'Portanova 10' }, PRON, 'tutti')!
  assert.equal(n.body, 'Reggiana 1-0 Torres · segna Portanova (Reggiana)')
  const q = new URL(n.url, 'https://x').searchParams
  assert.equal(q.get('gol'), '1')
  assert.equal(q.get('t'), 'Reggiana')
  assert.equal(q.get('mk'), 'Portanova 10')
  assert.equal(q.get('tuo'), '1')
})
check('marcatore: nome e numero in qualsiasi ordine, il numero è facoltativo', () => {
  assert.deepEqual(parseMarcatore('Lukaku 11'), { nome: 'Lukaku', numero: '11' })
  assert.deepEqual(parseMarcatore('9  Di Natale'), { nome: 'Di Natale', numero: '9' })
  assert.deepEqual(parseMarcatore('Portanova'), { nome: 'Portanova', numero: '' })
})
check('maglia: i club in elenco hanno i loro colori, gli altri un colore stabile', () => {
  assert.equal(magliaDi('Napoli').maglia, '#1c8ad6')
  assert.equal(magliaDi('Squadra Sconosciuta').maglia, magliaDi('Squadra Sconosciuta').maglia)
})
check('gol non preso: arriva a chi vuole tutti i gol, non a chi vuole solo i suoi', () => {
  assert.equal(messaggioGol(G("24'", 24), PRON, 'tutti')!.title, "⚽ Gol al 24'")
  assert.equal(messaggioGol(G("24'", 24), PRON, 'miei'), null)
})
check('chi non ha giocato la schedina non riceve i gol', () => {
  assert.equal(messaggioGol(G("23'", 23), undefined, 'tutti'), null)
})
check('recupero scelto: la notifica dice che vale il bonus', () => {
  const n = messaggioGol(G("45+2'", 45, 2), PRON, 'miei')!
  assert.match(n.body, /bonus recupero/)
})
check('posizioni con i pari merito', () => {
  const p = posizioni([{ user_id: 'a', totale: 8 }, { user_id: 'b', totale: 10 }, { user_id: 'c', totale: 8 }, { user_id: 'd', totale: 5 }])
  assert.deepEqual([p.get('b'), p.get('a'), p.get('c'), p.get('d')], [1, 2, 2, 4])
})
check('fine giornata: singolare e plurale', () => {
  assert.match(messaggioFinale(9, 'Giornata del 17 ottobre', 1, 3, 40).body, /1 punto,/)
  assert.match(messaggioFinale(9, 'Giornata del 17 ottobre', 7, 3, 40).body, /7 punti, sei 3° su 40/)
})

/* --- più schedine insieme, giornate su più giorni --- */

const SERIE_A = { id: 1, deadline: '2026-11-21T14:00:00.000Z', partite: [
  { date: '2026-11-21', ora: '15:00' }, { date: '2026-11-22', ora: '20:45' }, { date: '2026-11-23', ora: '18:30' },
] }
const SERIE_B = { id: 2, deadline: '2026-11-21T14:00:00.000Z', partite: [{ date: '2026-11-21', ora: '15:00' }, { date: '2026-11-21', ora: '19:30' }] }
const SERIE_C = { id: 3, deadline: '2026-11-22T13:30:00.000Z', partite: [{ date: '2026-11-22', ora: '14:30' }] }
const SUCCESSIVA = { id: 4, deadline: '2026-11-28T14:00:00.000Z', partite: [{ date: '2026-11-28', ora: '15:00' }] }
const LONTANA = { id: 5, deadline: '2027-01-16T14:00:00.000Z', partite: [{ date: '2027-01-16', ora: '15:00' }] }
const VECCHIA = { id: 9, deadline: '2026-11-07T13:30:00.000Z', partite: [{ date: '2026-11-07', ora: null }] }

check('giornata su più giorni: l\'orario dice anche il giorno', () => {
  assert.equal(suPiuGiorni(SERIE_A.partite), true)
  assert.equal(quandoPartita(SERIE_A.partite[0], SERIE_A.partite), 'sab 15:00')
  assert.equal(quandoPartita(SERIE_A.partite[2], SERIE_A.partite), 'lun 18:30')
  assert.equal(quandoPartita({ date: '2026-11-22', ora: null }, SERIE_A.partite), 'dom')
})
check('giornata in un giorno solo: resta solo l\'ora', () => {
  assert.equal(suPiuGiorni(SERIE_B.partite), false)
  assert.equal(quandoPartita(SERIE_B.partite[1], SERIE_B.partite), '19:30')
  assert.equal(quandoPartita({ date: '2026-11-21', ora: null }, SERIE_B.partite), '')
})
check('fine stimata: ultimo calcio d\'inizio più due ore e mezza', () => {
  assert.equal(fineStimataIso(SERIE_A), '2026-11-23T20:00:00.000Z')
  assert.equal(fineStimataIso(VECCHIA), '2026-11-07T22:59:00.000Z')
})
check('una giornata vecchia senza risultati non resta "in corso" per sempre', () => {
  assert.equal(inCorso(VECCHIA, '2026-11-07T16:00:00.000Z', false), true)
  assert.equal(inCorso(VECCHIA, '2026-11-19T10:00:00.000Z', false), false)
  assert.equal(inCorso(SERIE_A, '2026-11-22T10:00:00.000Z', true), false)
  assert.equal(inCorso(SERIE_A, '2026-11-20T10:00:00.000Z', false), false)
})
check('oggi, prima del weekend: la prima a chiudere in testa, le altre della settimana sotto', () => {
  const r = delMomento([LONTANA, SUCCESSIVA, SERIE_C, SERIE_B, SERIE_A, VECCHIA], '2026-11-19T10:00:00.000Z', () => false)
  assert.equal(r.principale?.id, 1)
  assert.deepEqual(r.altre.map(s => s.id), [2, 3])
})
check('domenica: la Serie A è in corso, la B anche, la C è ancora da giocare', () => {
  const r = delMomento([SERIE_A, SERIE_B, SERIE_C, SUCCESSIVA], '2026-11-22T09:00:00.000Z', s => s.id === 2)
  assert.equal(r.principale?.id, 1)
  assert.deepEqual(r.altre.map(s => s.id), [3, 4])
})
check('niente in corso e niente aperto: resta l\'ultima giornata chiusa', () => {
  const r = delMomento([VECCHIA, SERIE_B], '2026-12-25T10:00:00.000Z', () => true)
  assert.equal(r.principale?.id, 2)
  assert.deepEqual(r.altre, [])
})

/* --- informativa privacy --- */

check('privacy: chi si è registrato prima dell\'informativa deve accettarla', () => {
  assert.equal(privacyDaAccettare({ username: 'anna', full_name: 'Anna' }), true)
  assert.equal(privacyDaAccettare(undefined), true)
  assert.equal(privacyDaAccettare(null), true)
})
check('privacy: chi ha accettato la versione in vigore non rivede l\'avviso', () => {
  assert.equal(privacyDaAccettare({ privacy_versione: PRIVACY_VERSIONE, privacy_accettata_il: '2026-11-21T10:00:00.000Z' }), false)
})
check('privacy: se la versione cambia, l\'avviso torna', () => {
  assert.equal(privacyDaAccettare({ privacy_versione: '2020-01-01' }), true)
})

/* --- risultati automatici: dalla fonte ai gol della schedina --- */

check('feed: la serie si legge dalla competizione della partita', () => {
  assert.equal(serieDi('Serie A'), 'A')
  assert.equal(serieDi('Serie C - Girone B'), 'C')
  assert.equal(serieDi('Mondiali FIFA 2026'), null)
  assert.equal(serieDi(null), null)
})
check('feed: i nomi della fonte si riconoscono nonostante sigle, anni e accenti', () => {
  for (const [mio, loro] of [
    ['Milan', 'AC Milan'], ['Roma', 'AS Roma'], ['Como', 'Como 1907'], ['Cesena', 'Cesena FC'],
    ['Arezzo', 'S.S. Arezzo'], ['Padova', 'Calcio Padova'], ['Südtirol', 'Sudtirol'], ['Forlì', 'Forli'],
    ['L.R. Vicenza', 'L.R. Vicenza'], ['Pescara', 'Pescara Calcio'], ['Picerno', 'AZ Picerno ASD'],
    ['Livorno', 'US Livorno 1915'], ['Altamura', 'Team Altamura'], ['Alcione Milano', 'Alcione'],
    ['Ospitaletto Franciacorta', 'Ospitaletto'], ['Arzignano Valchiampo', 'FC Arzignano Valchiampo'],
    ['Juventus Next Gen', 'Juventus Next Gen'], ['Inter U23', 'Inter U23'],
  ]) assert.ok(stessaSquadra(mio, loro), `${mio} = ${loro}`)
})
check('feed: prima e seconda squadra non si confondono', () => {
  assert.equal(stessaSquadra('Inter', 'Inter U23'), false)
  assert.equal(stessaSquadra('Juventus', 'Juventus Next Gen'), false)
  assert.equal(stessaSquadra('Atalanta U23', 'Atalanta'), false)
  assert.equal(stessaSquadra('Verona', 'Vicenza'), false)
})
const EVENTI: EventoFeed[] = [
  { id: '1', serie: 'A', home: 'AC Milan', away: 'Frosinone', data: '2026-11-22', stato: 'finita', golCasa: 5, golTrasferta: 1 },
  { id: '2', serie: 'A', home: 'Atalanta', away: 'Inter', data: '2026-11-22', stato: 'in_corso', golCasa: 1, golTrasferta: 2 },
  { id: '3', serie: 'C', home: 'Inter U23', away: 'Potenza', data: '2026-11-21', stato: 'finita', golCasa: 2, golTrasferta: 1 },
]
check('feed: la partita si abbina per serie, squadre e giorno', () => {
  assert.equal(abbina({ home: 'Milan', away: 'Frosinone', date: '2026-11-22', competizione: 'Serie A' }, EVENTI)?.id, '1')
  assert.equal(abbina({ home: 'Inter U23', away: 'Potenza', date: '2026-11-21', competizione: 'Serie C' }, EVENTI)?.id, '3')
})
check('feed: niente abbinamento se cambia la serie, il verso o il giorno', () => {
  assert.equal(abbina({ home: 'Milan', away: 'Frosinone', date: '2026-11-22', competizione: 'Serie B' }, EVENTI), null)
  assert.equal(abbina({ home: 'Frosinone', away: 'Milan', date: '2026-11-22', competizione: 'Serie A' }, EVENTI), null)
  assert.equal(abbina({ home: 'Milan', away: 'Frosinone', date: '2026-11-29', competizione: 'Serie A' }, EVENTI), null)
  assert.equal(abbina({ home: 'Milan', away: 'Frosinone', date: '2026-11-22', competizione: null }, EVENTI), null)
})
check('feed: lo stato della partita, e i casi da non toccare', () => {
  assert.equal(statoDaFeed('NS'), 'da_giocare')
  assert.equal(statoDaFeed('FT'), 'finita')
  assert.equal(statoDaFeed('HT'), 'in_corso')
  assert.equal(statoDaFeed("67'"), 'in_corso')
  assert.equal(statoDaFeed("90+3'"), 'in_corso')
  assert.equal(statoDaFeed('Postp.'), null)
  assert.equal(statoDaFeed('Canc.'), null)
})
check('feed: dall\'elenco del giorno escono solo Serie A, B e C maschili', () => {
  const ev = eventiDaElenco({ Stages: [
    { Cnm: 'Italy', Scd: 'serie-a', Events: [{ Eid: '10', Esd: 20261122180000, Eps: 'FT', Tr1: '5', Tr2: '1', T1: [{ Nm: 'AC Milan' }], T2: [{ Nm: 'Frosinone' }] }] },
    { Cnm: 'Italy', Scd: 'serie-a-women', Events: [{ Eid: '11', Esd: 20261122150000, Eps: 'FT', Tr1: '1', Tr2: '0', T1: [{ Nm: 'Juventus' }], T2: [{ Nm: 'Roma' }] }] },
    { Cnm: 'Italy', Scd: 'serie-c-group-b-2025', Events: [{ Eid: '12', Esd: 20261121143000, Eps: 'NS', T1: [{ Nm: 'Vado' }], T2: [{ Nm: 'Latina' }] }] },
    { Cnm: 'Italy', Scd: 'serie-d-group-a', Events: [{ Eid: '13', Esd: 20261121143000, Eps: 'FT', T1: [{ Nm: 'X' }], T2: [{ Nm: 'Y' }] }] },
    { Cnm: 'Spain', Scd: 'serie-a', Events: [{ Eid: '14', Esd: 20261121143000, Eps: 'FT', T1: [{ Nm: 'X' }], T2: [{ Nm: 'Y' }] }] },
  ] })
  assert.deepEqual(ev.map(e => e.id), ['10', '12'])
  assert.deepEqual(ev[0], { id: '10', serie: 'A', home: 'AC Milan', away: 'Frosinone', data: '2026-11-22', stato: 'finita', golCasa: 5, golTrasferta: 1 })
  assert.equal(ev[1].serie, 'C')
  assert.equal(ev[1].golCasa, null)
})
// Com'è fatta la risposta vera: gol semplici, gol raggruppati con l'assist, autogol,
// rigore nel recupero, e gli episodi che gol non sono (cartellino 43, rigore sbagliato 38).
const INCIDENTI = { Incs: {
  '1': [
    { Min: 4, Nm: 1, IT: 39, Pn: 'G. Calvani', Sc: [1, 0] },
    { Min: 19, Nm: 1, Sc: [2, 0], Incs: [
      { Min: 19, Nm: 1, IT: 36, Pn: 'Gonçalo Ramos', Pnum: 9, Sc: [2, 0] },
      { Min: 19, Nm: 1, IT: 63, Pn: 'A. Rabiot', Sc: [2, 0] },
    ] },
    { Min: 25, Nm: 2, IT: 36, Ln: 'Masini', Pn: 'P. Masini', Pnum: 8, Sc: [2, 1] },
    { Min: 40, Nm: 2, IT: 38, Pn: 'X', Sc: [2, 1] },
    { Min: 45, MinEx: 2, Nm: 2, IT: 43, Pn: 'Y' },
  ],
  '2': [
    { Min: 90, MinEx: 1, Nm: 1, IT: 37, Ln: 'Kessie', Pnum: 79, Sc: [3, 1] },
  ],
} }
check('feed: dagli episodi si prendono solo i gol, con minuto e marcatore', () => {
  assert.deepEqual(golDaIncidenti(INCIDENTI, 'Milan', 'Frosinone'), [
    { min: "4'", team: 'Milan' },
    { min: "19'", team: 'Milan', scorer: 'Gonçalo Ramos 9' },
    { min: "25'", team: 'Frosinone', scorer: 'Masini 8' },
    { min: "90+1'", team: 'Milan', scorer: 'Kessie 79' },
  ])
  assert.deepEqual(golDaIncidenti({}, 'Milan', 'Frosinone'), [])
  assert.deepEqual(golDaIncidenti(null, 'Milan', 'Frosinone'), [])
})
check('feed: gol e punteggio dichiarato devono tornare', () => {
  const gol = golDaIncidenti(INCIDENTI, 'Milan', 'Frosinone')
  const e = { ...EVENTI[0], golCasa: 3, golTrasferta: 1 }
  assert.equal(golCoerenti(gol, e, 'Milan', 'Frosinone'), true)
  assert.equal(golCoerenti(gol, { ...e, golCasa: 4 }, 'Milan', 'Frosinone'), false)
  assert.equal(golCoerenti(gol, { ...e, golCasa: null }, 'Milan', 'Frosinone'), true)
})
check('feed: i gol nuovi sono solo quelli non ancora salvati', () => {
  const a = { min: "19'", team: 'Milan' }
  const b = { min: "25'", team: 'Frosinone' }
  assert.deepEqual(golNuovi([a], [a, b]), [b])
  assert.deepEqual(golNuovi([a, b], [a, b]), [])
  // doppietta nello stesso minuto: il secondo è nuovo
  assert.deepEqual(golNuovi([a], [a, a]), [a])
})
check('feed: la partita corretta a mano non viene sovrascritta, le altre sì', () => {
  const partite = [{ home: 'A', away: 'B' }, { home: 'C', away: 'D' }, { home: 'E', away: 'F' }]
  const d = (home: string, away: string, score: string, extra = {}) => ({ home, away, score, minuti: [], gol: [], stato: 'finita' as const, ...extra })
  const salvati = [d('A', 'B', '1-0', { manuale: true }), d('C', 'D', '0-0')]
  const daFeed = new Map([['A__B', d('A', 'B', '9-9')], ['C__D', d('C', 'D', '2-1')]])
  const out = unisciDettagli(partite, salvati, daFeed)
  assert.deepEqual(out.map(x => x.score), ['1-0', '2-1'])   // E-F non è nella fonte né salvata: non compare
  assert.equal(out[0].manuale, true)
})

/* --- classifica: posizioni, movimento, distacchi --- */

const R = (schedina_id: number, user_id: string, totale: number) => ({ schedina_id, user_id, username: user_id, full_name: '', totale })
check('classifica: a pari punti stessa posizione, e la successiva salta', () => {
  const out = conPosizioni([R(1, 'd', 5), R(1, 'b', 8), R(1, 'a', 10), R(1, 'c', 8)])
  assert.deepEqual(out.map(r => [r.username, r.pos]), [['a', 1], ['b', 2], ['c', 2], ['d', 4]])
})
check('classifica: l\'ultimo turno prende le schedine dello stesso weekend', () => {
  const s = [
    { id: 1, deadline: '2026-11-14T14:00:00Z' },
    { id: 2, deadline: '2026-11-20T19:30:00Z' },
    { id: 3, deadline: '2026-11-21T14:00:00Z' },
    { id: 4, deadline: '2026-11-27T19:45:00Z' },   // non ancora giocata
  ]
  assert.deepEqual([...ultimoTurno(s, new Set([1, 2, 3]))].sort(), [2, 3])
  assert.equal(ultimoTurno(s, new Set()).size, 0)
})
const RIGHE = [
  R(1, 'anna', 6), R(1, 'bea', 4), R(1, 'carlo', 2),
  R(2, 'anna', 1), R(2, 'bea', 5), R(2, 'dino', 9),
]
check('classifica: generale con punti dell\'ultimo turno e movimento', () => {
  const g = classificaGenerale(RIGHE, new Set([2]), new Set([1]))
  assert.deepEqual(g.map(r => [r.username, r.totale, r.pos]), [['bea', 9, 1], ['dino', 9, 1], ['anna', 7, 3], ['carlo', 2, 4]])
  const di = (u: string) => g.find(r => r.user_id === u)!
  assert.equal(di('bea').movimento, 1)       // era 2ª, ora 1ª
  assert.equal(di('anna').movimento, -2)     // era 1ª, ora 3ª
  assert.equal(di('dino').movimento, null)   // prima non c'era
  assert.equal(di('carlo').movimento, -1)
  assert.equal(di('carlo').ultimo, null)     // non ha giocato l'ultimo turno
  assert.equal(di('dino').ultimo, 9)
  assert.equal(di('anna').vittorie, 1)       // ha vinto la giornata 1, conclusa
  assert.equal(di('dino').vittorie, 0)       // la 2 non è conclusa
  assert.equal(di('anna').giocate, 2)
})
check('classifica: al primo turno in assoluto nessuno si muove', () => {
  const g = classificaGenerale(RIGHE.filter(r => r.schedina_id === 1), new Set([1]))
  assert.ok(g.every(r => r.movimento === 0))
})
check('classifica: chi è fuori dai primi vede sé stesso e i vicini', () => {
  const righe = Array.from({ length: 20 }, (_, i) => ({ user_id: `u${i}` }))
  assert.equal(daMostrare(righe, 'u3', 10).vicino.length, 0)
  assert.deepEqual(daMostrare(righe, 'u14', 10).vicino.map(r => r.user_id), ['u13', 'u14', 'u15'])
  assert.deepEqual(daMostrare(righe, 'u10', 10).vicino.map(r => r.user_id), ['u10', 'u11'])   // l'11° non ripete il 10°
  assert.deepEqual(daMostrare(righe, 'u19', 10).vicino.map(r => r.user_id), ['u18', 'u19'])
  assert.equal(daMostrare(righe, undefined, 10).cima.length, 10)
})
check('classifica: la frase del distacco', () => {
  const g = conPosizioni([R(1, 'a', 10), R(1, 'b', 8), R(1, 'c', 8), R(1, 'd', 7)])
  assert.equal(distacco(g, 'a'), 'In testa con 2 punti di vantaggio')
  assert.equal(distacco(g, 'b'), 'A 2 punti dal 1° posto')
  assert.equal(distacco(g, 'd'), 'A 1 punto dal 2° posto')
  assert.equal(distacco(conPosizioni([R(1, 'a', 5), R(1, 'b', 5)]), 'a'), 'In testa a pari merito con un altro')
  assert.equal(distacco(g, 'nessuno'), null)
})
check('classifica: etichette corte delle giornate', () => {
  assert.equal(etichettaGiornata('Serie A · 12ª giornata'), 'A · 12ª')
  assert.equal(etichettaGiornata('Serie C · 15ª giornata', true), '15ª')
  assert.equal(etichettaGiornata('Fase finale'), 'Fase finale')
})

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed) process.exit(1)
