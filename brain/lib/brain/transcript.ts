/**
 * Le trascrizioni delle call. Funzione pura: niente rete, niente DOM,
 * nessun import di valori.
 *
 * Google Meet, quando la trascrizione o gli appunti di Gemini sono
 * attivi, lascia in Drive due Google Docs per ogni riunione: uno che
 * finisce in "Transcript" / "Trascrizione" e uno in "Notes by Gemini"
 * / "Appunti di Gemini". Drive li leggiamo già; questo file sa
 * **riconoscerli, ricondurli alla stessa riunione e spezzarli in
 * pezzi citabili.**
 *
 * L'ultima parte è quella che conta. Una call di un'ora sono
 * cinquantamila caratteri: offerta come fonte unica, ogni riga del
 * debrief citerebbe "F1" e chi legge dovrebbe rileggersi tutto per
 * trovare il punto. Spezzata in tratti di qualche minuto, la citazione
 * porta al tratto giusto — e il verificatore, che controlla i numeri
 * contro le fonti *citate*, controlla contro quel tratto e non contro
 * l'ora intera.
 *
 * La mail di follow-up, in fondo, non è generata: è formattata a
 * partire da righe già verificate. Come la mail del brief, e per la
 * stessa ragione — non c'è niente da inventare, e un testo
 * deterministico non può sbagliare una cifra o un nome che sta
 * ripetendo.
 */

export type MeetDocKind = 'transcript' | 'notes'

export type Turn = {
  speaker: string
  text: string
}

/** Come Meet chiude i titoli, in inglese e in italiano. */
const SUFFIX =
  /\s*[-–—]\s*(transcript|trascrizione|notes by gemini|gemini notes|note di gemini|appunti di gemini|appunti gemini)\s*$/i

/** Il pezzo "(2026-09-15 at 10:02 GMT+2)" che Meet mette nel titolo, in un formato. */
const DATE_PAREN = /\s*\((\d{4}-\d{2}-\d{2})[^)]*\)\s*$/
/** E " - 2026/09/14 15:00 BST", che è quello che lascia davvero in Drive in italiano. */
const DATE_TAIL =
  /\s*[-–—]\s*\d{4}[/.-]\d{2}[/.-]\d{2}(?:\s+(?:at\s+|alle\s+)?\d{1,2}:\d{2})?(?:\s+[A-Za-z]{2,5}(?:[+-]\d{1,2}(?::\d{2})?)?)?\s*$/
/** Una riunione senza titolo: Meet la chiama con l'ora in cui è cominciata. */
const STARTED = /^(riunione iniziata|meeting started)\b/i
const ANY_DATE = /(\d{4})[/.-](\d{2})[/.-](\d{2})(?:\s+(?:at\s+|alle\s+)?(\d{1,2}:\d{2}))?/

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** È un documento lasciato da Meet? E di che tipo? */
export function classifyMeetDoc(title: string): MeetDocKind | null {
  const m = title.trim().match(SUFFIX)
  if (!m) return null
  return /transcript|trascrizione/i.test(m[1]) ? 'transcript' : 'notes'
}

/** Il titolo della riunione, senza il suffisso di Meet e senza la data. */
export function meetingTitle(title: string): string {
  const bare = title.trim().replace(SUFFIX, '')
  if (STARTED.test(bare)) {
    const m = bare.match(ANY_DATE)
    return m ? `Riunione del ${m[3]}/${m[2]}/${m[1]}${m[4] ? ` alle ${m[4]}` : ''}` : 'Riunione senza titolo'
  }
  const t = bare.replace(DATE_PAREN, '').replace(DATE_TAIL, '').trim()
  return t || '(riunione senza titolo)'
}

/** Il giorno della riunione: dal titolo se c'è, altrimenti dal documento. */
export function meetingDay(title: string, fallbackIso: string): string {
  const m = title.replace(SUFFIX, '').match(ANY_DATE)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : fallbackIso.slice(0, 10)
}

/** L'ora d'inizio, se il titolo la porta: due call lo stesso giorno non sono la stessa call. */
export function meetingTime(title: string): string | null {
  const m = title.replace(SUFFIX, '').match(ANY_DATE)
  return m?.[4] ? m[4].padStart(5, '0') : null
}

/**
 * La chiave che tiene insieme trascrizione e appunti della stessa
 * riunione: stesso giorno, stessa ora d'inizio, stesso titolo a meno
 * di maiuscole e accenti.
 */
export function callKey(title: string, fallbackIso: string): string {
  return `${meetingDay(title, fallbackIso)}|${meetingTime(title) ?? ''}|${fold(meetingTitle(title))}`
}

/** Gli indirizzi email che compaiono in un testo, senza doppioni. */
export function emailsIn(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) out.add(m[0].toLowerCase())
  return [...out]
}

/**
 * "Marco Giacomello" e marco@giacomello.digital sono la stessa persona?
 * Basta una parola di almeno quattro lettere in comune fra il nome e
 * l'indirizzo (parte locale e primo pezzo del dominio). Serve a
 * riconoscere il titolare fra chi si è preso un impegno: abbastanza
 * per quello, non per una rubrica.
 */
export function isSamePerson(name: string, email: string): boolean {
  const [local = '', domain = ''] = email.toLowerCase().split('@')
  const emailTokens = new Set(
    [...local.split(/[._+-]+/), domain.split('.')[0] ?? ''].map(fold).filter((t) => t.length >= 4)
  )
  return fold(name)
    .split(/[^a-z0-9]+/)
    .some((t) => t.length >= 4 && emailTokens.has(t))
}

/* ------------------------------------------------------------------ *
 * Il testo della trascrizione
 * ------------------------------------------------------------------ */

const TIMESTAMP = /^\d{1,2}:\d{2}(:\d{2})?$/
const SPEAKER_LINE = /^([^:]{2,60}?):\s+(.*)$/
const ATTENDEES_HEAD = /^(attendees|partecipanti|invitati)$/i

/**
 * Da testo a interventi. Un intervento comincia con "Nome: " e continua
 * finché non ne comincia un altro; i timestamp su riga propria si
 * saltano; l'intestazione prima del primo intervento non è di nessuno
 * e si perde.
 */
export function parseTurns(text: string): Turn[] {
  const turns: Turn[] = []
  let current: Turn | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || TIMESTAMP.test(line)) continue

    const m = line.match(SPEAKER_LINE)
    if (m) {
      if (current) turns.push(current)
      current = { speaker: m[1].trim(), text: m[2].trim() }
      continue
    }
    if (current) current.text = `${current.text} ${line}`.trim()
  }
  if (current) turns.push(current)
  return turns
}

/** Chi era invitato, se la trascrizione lo dice in testa. */
export function attendees(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const i = lines.findIndex((l) => ATTENDEES_HEAD.test(l))
  if (i < 0) return []
  const next = lines.slice(i + 1).find((l) => l.length > 0) ?? ''
  return next
    .split(/,|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !ATTENDEES_HEAD.test(s))
}

export type SpeakerShare = {
  speaker: string
  turns: number
  /** Quota del parlato, 0–1, su due decimali. */
  share: number
}

/**
 * Quanto ha parlato ciascuno. In una call commerciale è il numero che
 * un coach guarderebbe per primo: se hai parlato tu il settanta per
 * cento del tempo, hai presentato, non ascoltato.
 */
export function speakerShares(turns: Turn[]): SpeakerShare[] {
  const total = turns.reduce((s, t) => s + t.text.length, 0)
  if (!total) return []
  const by = new Map<string, { turns: number; chars: number }>()
  for (const t of turns) {
    const e = by.get(t.speaker) ?? { turns: 0, chars: 0 }
    e.turns += 1
    e.chars += t.text.length
    by.set(t.speaker, e)
  }
  return [...by.entries()]
    .map(([speaker, e]) => ({ speaker, turns: e.turns, share: Math.round((e.chars / total) * 100) / 100 }))
    .sort((a, b) => b.share - a.share)
}

/**
 * La trascrizione in tratti citabili di qualche minuto ciascuno. Un
 * intervento non si spezza mai a metà: piuttosto un tratto viene un
 * po' più lungo.
 */
export function segment(turns: Turn[], maxChars = 3500): string[] {
  const out: string[] = []
  let buf: string[] = []
  let size = 0
  for (const t of turns) {
    const line = `${t.speaker}: ${t.text}`
    if (size && size + line.length > maxChars) {
      out.push(buf.join('\n'))
      buf = []
      size = 0
    }
    buf.push(line)
    size += line.length + 1
  }
  if (buf.length) out.push(buf.join('\n'))
  return out
}

/* ------------------------------------------------------------------ *
 * Gli appunti di Gemini
 * ------------------------------------------------------------------ */

export type NoteStep = {
  /** Chi se l'è preso, come lo scrive Gemini: "Maria Livia Rizzo", "Il gruppo". */
  chi: string
  /** L'etichetta breve fra graffe, se c'è. */
  etichetta: string | null
  testo: string
}

export type GeminiNotes = {
  /** Gli indirizzi nell'intestazione: chi era invitato. */
  attendees: string[]
  riepilogo: string[]
  decisioni: string[]
  passaggi: NoteStep[]
  dettagli: string[]
  /** Gemini non ha prodotto niente: troppo poca conversazione. */
  empty: boolean
}

type NotesSection = 'riepilogo' | 'decisioni' | 'passaggi' | 'dettagli' | 'header' | 'footer'

const NOTES_HEADING: [RegExp, NotesSection][] = [
  [/^(riepilogo|summary)$/i, 'riepilogo'],
  [/^(decisioni|decisions)$/i, 'decisioni'],
  [/^(passaggi successivi(?: suggeriti)?|suggested next steps|next steps)$/i, 'passaggi'],
  [/^(dettagli|details)$/i, 'dettagli'],
  [/^(dovresti rivedere le note|you should review)/i, 'footer'],
]

/** Sottotitoli interni che non sono contenuto. */
const NOTES_SUBHEAD = /^(concordato|agreed|non concordato|not agreed)$/i
const NOTES_EMPTY =
  /non (?:è stato|sono stati) prodott|non c'era abbastanza|no summary was|no details were|not enough conversation|nessun passaggio successivo|no suggested next steps/i

/** Via i segni di elenco e la formattazione che Docs lascia nell'esportazione. */
function cleanLine(raw: string): string {
  return raw
    .replace(/^\s*(?:[-•*▪●]|\d+[.)])\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\\([[\]{}])/g, '$1')
    .trim()
}

function headingOf(line: string): NotesSection | null {
  const bare = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
  for (const [re, section] of NOTES_HEADING) if (re.test(bare)) return section
  return null
}

const STEP = /^\[(.+?)\]\s*(?:\{(.+?)\}\s*:?\s*|([^:]{2,60}?):\s+)?(.*)$/

/**
 * Gli appunti di Gemini, sezione per sezione.
 *
 * Gemini scrive già decisioni e passaggi successivi, con il nome davanti
 * a ogni passaggio. Sono un riassunto fatto da un altro modello, e
 * nessuno qui li verifica contro la conversazione perché la
 * conversazione non c'è. Ma è la stessa cosa che farebbe una persona:
 * leggere gli appunti e copiare da lì. La garanzia che si può dare è
 * che ogni riga mostrata sta negli appunti — ed è quella che si dà.
 */
export function parseNotes(text: string): GeminiNotes {
  const notes: GeminiNotes = { attendees: [], riepilogo: [], decisioni: [], passaggi: [], dettagli: [], empty: false }
  let section: NotesSection = 'header'
  const header: string[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = headingOf(line)
    if (heading) {
      section = heading
      continue
    }
    if (section === 'footer') continue
    const clean = cleanLine(line)
    if (!clean || NOTES_SUBHEAD.test(clean)) continue

    if (section === 'header') header.push(line)
    else if (section === 'riepilogo') notes.riepilogo.push(clean)
    else if (section === 'decisioni') notes.decisioni.push(clean)
    else if (section === 'dettagli') notes.dettagli.push(clean)
    else if (section === 'passaggi') {
      const m = clean.match(STEP)
      if (m) notes.passaggi.push({ chi: m[1].trim(), etichetta: (m[2] ?? m[3] ?? '').trim() || null, testo: m[4].trim() })
      else notes.passaggi.push({ chi: '', etichetta: null, testo: clean })
    }
  }

  notes.attendees = emailsIn(header.join('\n'))
  const said = [...notes.riepilogo, ...notes.passaggi.map((p) => p.testo), ...notes.dettagli].join(' ')
  notes.empty =
    !notes.decisioni.length &&
    !notes.passaggi.some((p) => p.chi) &&
    (NOTES_EMPTY.test(said) || !notes.riepilogo.length)
  // Le righe "non è stato prodotto…" non sono contenuto.
  if (notes.empty) {
    notes.riepilogo = notes.riepilogo.filter((l) => !NOTES_EMPTY.test(l))
    notes.passaggi = notes.passaggi.filter((p) => p.chi)
    notes.dettagli = notes.dettagli.filter((l) => !NOTES_EMPTY.test(l))
  }
  return notes
}

/* ------------------------------------------------------------------ *
 * La mail di follow-up
 * ------------------------------------------------------------------ */

export type FollowUpInput = {
  title: string
  /** "2026-09-15" */
  day: string
  /** Nomi in chiaro di chi riceve. */
  to: string[]
  decisioni: string[]
  impegni: string[]
  domande: string[]
}

export type FollowUp = { subject: string; text: string }

function itDay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function firstNames(names: string[]): string {
  const firsts = names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean)
  if (!firsts.length) return ''
  if (firsts.length === 1) return firsts[0]
  return `${firsts.slice(0, -1).join(', ')} e ${firsts[firsts.length - 1]}`
}

/**
 * La mail, formattata e non generata. Le sezioni vuote spariscono; se
 * sono vuote tutte, la mail non c'è: mandare "grazie per la call" senza
 * niente dentro è la cosa che il post-call doveva evitare.
 */
export function renderFollowUp(input: FollowUpInput): FollowUp | null {
  if (!input.decisioni.length && !input.impegni.length && !input.domande.length) return null

  const who = firstNames(input.to)
  const lines: string[] = [
    who ? `Ciao ${who},` : 'Ciao,',
    '',
    `grazie per la call di ${itDay(input.day)} su "${input.title}". Ti riepilogo quello che ci siamo detti, così siamo sicuri di essere allineati.`,
  ]

  const section = (head: string, items: string[]) => {
    if (!items.length) return
    lines.push('', head)
    for (const it of items) lines.push(`- ${it}`)
  }
  section('Cosa abbiamo deciso', input.decisioni)
  section('Prossimi passi', input.impegni)
  section('Da chiarire', input.domande)

  lines.push('', 'Se ho dimenticato qualcosa o ho capito male un punto, correggimi pure.', '', 'A presto,')

  return { subject: `Riepilogo — ${input.title}`, text: lines.join('\n') }
}
