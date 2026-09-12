// Test del motore ONE TAP. Zero dipendenze: `npm run test:onetap`.
import assert from 'node:assert/strict'
import { analyze, isValidIban } from '../lib/onetap/detect.ts'
import { actionHref, buildIcs, buildVcf, googleCalendarHref } from '../lib/onetap/actions.ts'
import { expandQrPayload } from '../lib/onetap/image.ts'

// Riferimento fisso: martedì 15 settembre 2026, 10:00.
const NOW = new Date(2026, 8, 15, 10, 0, 0)

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

function run(text: string, opts: Record<string, unknown> = {}) {
  return analyze(text, { now: NOW, ...opts })
}

/* --- scenari del brief --- */

check('numero di telefono → CALL', () => {
  const a = run('Call me: +39 333 1234567')
  assert.equal(a.primary?.kind, 'CALL')
  assert.equal(a.primary?.value, '+393331234567')
  assert.equal(a.confidence, 'high')
})

check('indirizzo → NAVIGATE', () => {
  const a = run('Via Dante 15, Milano')
  assert.equal(a.primary?.kind, 'NAVIGATE')
  assert.equal(a.primary?.value, 'Via Dante 15, Milano')
})

check('IBAN → COPY', () => {
  const a = run('IBAN: IT60X0542811101000000123456')
  assert.equal(a.primary?.kind, 'COPY')
  assert.equal(a.primary?.value, 'IT60X0542811101000000123456')
})

check('email → EMAIL', () => {
  const a = run('hello@example.com')
  assert.equal(a.primary?.kind, 'EMAIL')
  assert.equal(a.primary?.value, 'hello@example.com')
})

check('evento → ADD TO CALENDAR', () => {
  const a = run('Dinner at Nobu, Tuesday at 19:30')
  assert.equal(a.primary?.kind, 'CALENDAR')
  assert.equal(a.primary?.event?.start, '2026-09-22T19:30:00')
  assert.match(a.primary?.event?.title ?? '', /Nobu/)
})

check('messaggio → REPLY con 3 proposte', () => {
  const a = run('Hey Marco, can we move the meeting to Thursday afternoon?')
  assert.equal(a.primary?.kind, 'REPLY')
  assert.equal(a.primary?.replies?.length, 3)
  assert.match(a.primary!.replies![0], /Thursday/)
})

/* --- momento magico dell'onboarding --- */

check('magic moment: indirizzo primario, calendario secondario', () => {
  const a = run('Meet me at Via Dante 15 at 18:30')
  assert.equal(a.primary?.kind, 'NAVIGATE')
  assert.equal(a.primary?.value, 'Via Dante 15')
  assert.ok(a.secondary.some((s) => s.kind === 'CALENDAR'), 'manca ADD TO CALENDAR')
  const cal = a.secondary.find((s) => s.kind === 'CALENDAR')!
  assert.equal(cal.event?.start, '2026-09-15T18:30:00')
  assert.equal(cal.event?.location, 'Via Dante 15')
})

/* --- ranking con più entità --- */

check('ristorante completo: NAVIGATE vince, CALL e CALENDAR restano sotto', () => {
  const a = run('Trattoria Bianca\nVia Dante 15, Milano\nTel. 02 8901234\nPrenotato venerdì alle 20:30\nwww.trattoriabianca.it')
  assert.equal(a.primary?.kind, 'NAVIGATE')
  const kinds = a.secondary.map((s) => s.kind)
  assert.ok(kinds.includes('CALL'), `manca CALL: ${kinds}`)
  assert.ok(kinds.includes('CALENDAR') || kinds.includes('OPEN'), `manca CALENDAR/OPEN: ${kinds}`)
})

check('intenzione esplicita batte il ranking di default', () => {
  const a = run('Chiamalo: Trattoria Bianca, Via Dante 15, tel 02 8901234')
  assert.equal(a.primary?.kind, 'CALL')
})

check('"portami lì" forza NAVIGATE', () => {
  const a = run('Portami in Piazza Duomo 1, Milano — tel +39 02 1234567')
  assert.equal(a.primary?.kind, 'NAVIGATE')
})

/* --- entità singole --- */

check('url → OPEN', () => {
  const a = run('https://onetap.app/demo')
  assert.equal(a.primary?.kind, 'OPEN')
  assert.equal(a.primary?.value, 'https://onetap.app/demo')
})

check('dominio nudo normalizzato in https', () => {
  const a = run('vai su onetap.app')
  assert.equal(a.primary?.kind, 'OPEN')
  assert.equal(a.primary?.value, 'https://onetap.app')
})

check('codice OTP → COPY', () => {
  const a = run('Il tuo codice di verifica è 384920. Non condividerlo.')
  assert.equal(a.primary?.kind, 'COPY')
  assert.equal(a.primary?.value, '384920')
})

check('QR Wi-Fi → COPY password', () => {
  const a = run('WIFI:S:CasaMarco;T:WPA;P:superSegreta1;;')
  assert.equal(a.primary?.kind, 'COPY')
  assert.equal(a.primary?.value, 'superSegreta1')
})

check('telefono nazionale: nessun prefisso inventato', () => {
  const a = run('Ristorante Da Gino — tel 02 8901234')
  assert.equal(a.primary?.kind, 'CALL')
  assert.equal(a.primary?.value, '028901234')
})

check('indirizzo in stile anglosassone', () => {
  const a = run('See you at 221 Baker Street, London')
  assert.equal(a.primary?.kind, 'NAVIGATE')
  assert.match(a.primary?.value ?? '', /221 Baker Street/)
})

/* --- date --- */

check('data numerica europea', () => {
  const a = run('Riunione 20/10/2026 alle 09:00')
  assert.equal(a.primary?.kind, 'CALENDAR')
  assert.equal(a.primary?.event?.start, '2026-10-20T09:00:00')
})

check('domani + parte del giorno', () => {
  const a = run('Cena domani sera')
  assert.equal(a.primary?.kind, 'CALENDAR')
  assert.equal(a.primary?.event?.start, '2026-09-16T20:00:00')
})

check('mese scritto', () => {
  const a = run('Volo il 3 dicembre alle 06:40')
  assert.equal(a.primary?.kind, 'CALENDAR')
  assert.equal(a.primary?.event?.start, '2026-12-03T06:40:00')
})

check('data passata senza anno slitta all’anno prossimo', () => {
  const a = run('Appuntamento 3 marzo alle 11:00')
  assert.equal(a.primary?.event?.start, '2027-03-03T11:00:00')
})

/* --- falsi positivi --- */

check('una data non viene scambiata per un telefono', () => {
  const a = run('Scadenza 12.09.2026')
  assert.ok(!a.entities.some((e) => e.kind === 'phone'), 'ha trovato un telefono inesistente')
})

check('un importo non diventa un telefono', () => {
  const a = run('Totale scontrino: € 1.234,50')
  assert.ok(!a.entities.some((e) => e.kind === 'phone'))
})

check('IBAN con checksum errato viene scartato', () => {
  assert.equal(isValidIban('IT60X0542811101000000123457'), false)
  assert.equal(isValidIban('IT60X0542811101000000123456'), true)
  assert.equal(isValidIban('DE89370400440532013000'), true)
})

check('testo generico → confidenza bassa, niente invenzioni', () => {
  const a = run('Qualcosa di completamente generico senza dati utili')
  assert.equal(a.confidence, 'low')
  assert.equal(a.primary?.kind, 'COPY')
})

check('l’email dentro a un testo non diventa un url', () => {
  const a = run('Scrivimi a marco@studio.it per il contratto')
  assert.equal(a.primary?.kind, 'EMAIL')
  assert.ok(!a.entities.some((e) => e.kind === 'url'))
})

/* --- risposte --- */

check('le risposte del modello hanno la precedenza sui template', () => {
  const a = run('Ciao Marco, ci vediamo giovedì?', { replies: ['Sì!', 'Forse', 'No'] })
  assert.equal(a.primary?.kind, 'REPLY')
  assert.deepEqual(a.primary?.replies, ['Sì!', 'Forse', 'No'])
})

check('messaggio in italiano → risposte in italiano', () => {
  const a = run('Ciao Marco, possiamo spostare la riunione a giovedì pomeriggio?')
  assert.equal(a.lang, 'it')
  assert.equal(a.primary?.kind, 'REPLY')
  assert.match(a.primary!.replies![0], /giovedì/i)
})

check('input vuoto non esplode', () => {
  const a = run('   ')
  assert.equal(a.primary, null)
  assert.equal(a.confidence, 'low')
})

/* --- costruzione di link e file --- */

check('href per ogni tipo di azione', () => {
  const call = run('Call me: +39 333 1234567').primary!
  assert.equal(actionHref(call, 'ios', 'en'), 'tel:+393331234567')

  const nav = run('Via Dante 15, Milano').primary!
  assert.equal(actionHref(nav, 'ios', 'en'), 'https://maps.apple.com/?daddr=Via%20Dante%2015%2C%20Milano')
  assert.match(actionHref(nav, 'android', 'en')!, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/)

  const mail = run('hello@example.com').primary!
  assert.equal(actionHref(mail, 'other', 'en'), 'mailto:hello@example.com')

  // COPY non apre nulla: la UI deve usare un <button>, non un <a>.
  assert.equal(actionHref(run('IBAN: IT60X0542811101000000123456').primary!, 'ios', 'en'), null)
})

check('ICS valido e con i campi giusti', () => {
  const event = run('Dinner at Nobu, Tuesday at 19:30').primary!.event!
  const ics = buildIcs(event)
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /DTSTART:20260922T193000/)
  assert.match(ics, /DTEND:20260922T203000/)
  assert.match(ics, /SUMMARY:Dinner at Nobu/)
  assert.match(ics, /END:VCALENDAR$/)
})

check('ICS: i caratteri speciali del titolo sono protetti', () => {
  const ics = buildIcs({ title: 'Cena; Nobu, Milano', start: '2026-09-22T19:30:00', end: '2026-09-22T20:30:00' })
  assert.match(ics, /SUMMARY:Cena\\; Nobu\\, Milano/)
})

check('vCard con telefono ed email', () => {
  const vcf = buildVcf({ name: 'Giulia Neri', phone: '+390289012 34'.replace(/\s/g, ''), email: 'hello@example.com' })
  assert.match(vcf, /FN:Giulia Neri/)
  assert.match(vcf, /TEL;TYPE=CELL:\+39028901234/)
  assert.match(vcf, /EMAIL:hello@example.com/)
})

check('link Google Calendar con data e luogo', () => {
  const href = googleCalendarHref({
    title: 'Cena', start: '2026-09-22T19:30:00', end: '2026-09-22T20:30:00', location: 'Via Dante 15',
  })
  assert.match(href, /dates=20260922T193000%2F20260922T203000/)
  assert.match(href, /location=Via\+Dante\+15/)
})

/* --- payload dei QR code --- */

check('QR con schema tel: diventa una chiamata', () => {
  const a = run(expandQrPayload('tel:+393331234567'))
  assert.equal(a.primary?.kind, 'CALL')
})

check('QR vCard diventa un contatto leggibile', () => {
  const text = expandQrPayload('BEGIN:VCARD\nVERSION:3.0\nFN:Giulia Neri\nTEL:+390289012340\nEMAIL:g@example.com\nEND:VCARD')
  assert.match(text, /Giulia Neri/)
  const a = run(text)
  assert.ok(['CALL', 'EMAIL'].includes(a.primary!.kind))
})

check('QR con un url resta un url', () => {
  assert.equal(expandQrPayload('https://example.com/x'), 'https://example.com/x')
})

/* --- salvare una nota --- */

check('SAVE NOTE è sempre fra le alternative', () => {
  const a = run('Appunti della riunione di ieri: rivedere la clausola 7 e il massimale.')
  const kinds = [a.primary!.kind, ...a.secondary.map((s) => s.kind)]
  assert.ok(kinds.includes('NOTE'), `manca NOTE: ${kinds}`)
})

check('"prendi nota" la porta in primo piano', () => {
  const a = run('Prendi nota: il massimale va portato a 2 milioni entro venerdì')
  assert.equal(a.primary?.kind, 'NOTE')
})

check('una nota non ruba il posto a un\'azione vera', () => {
  const a = run('Chiamami al +39 333 1234567')
  assert.equal(a.primary?.kind, 'CALL')
})

/* --- testo poco affidabile: niente telefoni inventati --- */

check('strictNumbers: una fila nuda di cifre da OCR non diventa CALL', () => {
  const a = run('Cini as a to 5 bce 3312345678 de SEB', { strictNumbers: true })
  assert.notEqual(a.primary?.kind, 'CALL')
  assert.ok(!a.entities.some((e) => e.kind === 'phone'), 'ha inventato un telefono')
})

check('strictNumbers: un numero con prefisso resta un numero', () => {
  const a = run('sede +39 02 8901234 orari 9-18', { strictNumbers: true })
  assert.equal(a.primary?.kind, 'CALL')
})

check('strictNumbers: un numero raggruppato resta un numero', () => {
  const a = run('Luca 333 123 4567', { strictNumbers: true })
  assert.equal(a.primary?.kind, 'CALL')
})

check('senza strictNumbers la fila di cifre è ancora un numero (screenshot puliti)', () => {
  const a = run('Luca 3331234567')
  assert.equal(a.primary?.kind, 'CALL')
})

/* --- arricchimento dal modello: decora, non decide --- */

const CARD = 'Giulia Neri\nHead of Design — Studio Bianchi\ngiulia@studiobianchi.it\n+39 02 8901234'
const CARD_ENRICH = {
  title: 'Biglietto da visita di Giulia Neri',
  contact: { name: 'Giulia Neri', company: 'Studio Bianchi', role: 'Head of Design' },
  emailDraft: { subject: 'Piacere di averla conosciuta', body: 'Buongiorno Giulia, è stato un piacere. Resto a disposizione.' },
  messageDraft: 'Buongiorno Giulia, sono Marco: piacere di averla conosciuta oggi.',
}

check('biglietto da visita: SAVE CONTACT in primo piano con nome, ruolo e azienda', () => {
  const a = run(CARD, { hintKind: 'contact', enrich: CARD_ENRICH })
  assert.equal(a.primary?.kind, 'CONTACT')
  assert.equal(a.primary?.contact?.name, 'Giulia Neri')
  assert.equal(a.primary?.contact?.company, 'Studio Bianchi')
  assert.equal(a.primary?.contact?.role, 'Head of Design')
  assert.equal(a.primary?.contact?.phone, '+39028901234')
  assert.equal(a.primary?.contact?.email, 'giulia@studiobianchi.it')
  assert.equal(a.title, 'Biglietto da visita di Giulia Neri')
})

check('la vCard porta azienda e ruolo', () => {
  const vcf = buildVcf({ name: 'Giulia Neri', company: 'Studio Bianchi', role: 'Head of Design', phone: '+39028901234' })
  assert.match(vcf, /ORG:Studio Bianchi/)
  assert.match(vcf, /TITLE:Head of Design/)
})

check('EMAIL con bozza: mailto porta oggetto e corpo', () => {
  const a = run(CARD, { enrich: CARD_ENRICH })
  const email = [a.primary!, ...a.secondary].find((x) => x.kind === 'EMAIL')!
  assert.equal(email.draft?.subject, 'Piacere di averla conosciuta')
  const href = actionHref(email, 'ios', 'it')!
  assert.match(href, /^mailto:giulia@studiobianchi\.it\?subject=Piacere%20di%20averla%20conosciuta&body=/)
  assert.ok(!href.includes('+'), 'gli spazi devono essere %20, non +')
})

check('TEXT con bozza: sms con body, grammatica iOS e Android', () => {
  const a = run(CARD, { enrich: CARD_ENRICH })
  const text = [a.primary!, ...a.secondary].find((x) => x.kind === 'TEXT')!
  assert.match(actionHref(text, 'ios', 'it')!, /^sms:\+39028901234&body=/)
  assert.match(actionHref(text, 'android', 'it')!, /^sms:\+39028901234\?body=/)
})

check('evento: titolo umano dal modello, luogo solo se nel testo', () => {
  const a = run('Anna: ci vediamo da Nobu martedì alle 19:30', {
    enrich: { event: { title: 'Cena con Anna da Nobu', location: 'Via Inventata 99, Roma' } },
  })
  const cal = [a.primary!, ...a.secondary].find((x) => x.kind === 'CALENDAR')!
  assert.equal(cal.event?.title, 'Cena con Anna da Nobu')
  assert.equal(cal.event?.location, undefined, 'un luogo non presente nel testo non deve passare')
})

check('l\'arricchimento non può inventare entità', () => {
  const a = run('Grazie mille, a presto!', { enrich: { messageDraft: 'Chiamami al 333 1234567', contact: { name: 'Nessuno' } } })
  assert.ok(!a.entities.some((e) => e.kind === 'phone'), 'un numero nella bozza non è un numero nel testo')
  assert.ok(![a.primary!, ...a.secondary].some((x) => x.kind === 'CALL' || x.kind === 'CONTACT'))
})

check('ricerca: la query del modello batte la prima riga', () => {
  const a = run('Sony WH-1000XM5 cuffie wireless nero — offerta', { hintKind: 'product', enrich: { searchQuery: 'Sony WH-1000XM5 prezzo' } })
  assert.equal(a.primary?.kind, 'SEARCH')
  assert.equal(a.primary?.value, 'Sony WH-1000XM5 prezzo')
})

console.log(`\n${passed} passati, ${failed} falliti`)
if (failed > 0) process.exit(1)
