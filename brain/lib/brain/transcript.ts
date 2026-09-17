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

/** Il pezzo "(2026-09-15 at 10:02 GMT+2)" che Meet mette nel titolo. */
const DATE_PAREN = /\s*\((\d{4}-\d{2}-\d{2})[^)]*\)\s*$/

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
  const t = title.trim().replace(SUFFIX, '').replace(DATE_PAREN, '').trim()
  return t || '(riunione senza titolo)'
}

/** Il giorno della riunione: dal titolo se c'è, altrimenti dal documento. */
export function meetingDay(title: string, fallbackIso: string): string {
  const m = title.replace(SUFFIX, '').match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : fallbackIso.slice(0, 10)
}

/**
 * La chiave che tiene insieme trascrizione e appunti della stessa
 * riunione: stesso giorno, stesso titolo a meno di maiuscole e accenti.
 */
export function callKey(title: string, fallbackIso: string): string {
  return `${meetingDay(title, fallbackIso)}|${fold(meetingTitle(title))}`
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
