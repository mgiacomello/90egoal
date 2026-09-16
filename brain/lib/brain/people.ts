/**
 * Le persone. Funzione pura: niente rete, niente DOM.
 *
 * Serve a una cosa sola, e non è banale: capire che **"Giulia Bianchi"
 * e `giulia.bianchi@studiobianchi.it` sono la stessa persona.**
 *
 * Perché conta più di quanto sembri. Tutto il resto della memoria
 * cerca per parole, e cercare per parole una persona è il modo più
 * sicuro di sbagliare: "Bianchi" prende anche il fornitore Bianchi
 * Srl, e "Giulia" prende tre Giulie. Ma **chi era nella stanza è un
 * fatto strutturato** — sta nella colonna `participants`, con il suo
 * indice — e su un fatto si fa una query, non una ricerca.
 *
 * Da qui il recupero dell'agente Incontro: prima chi, per elenco
 * esatto di indirizzi; poi cosa, per parole. Non il contrario.
 */

export type Person = {
  /** L'indirizzo, minuscolo, quando c'è. */
  email: string
  /** Le parole che identificano la persona: nome, cognome, parte locale. */
  tokens: string[]
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]*\w/g

/** Domini che non dicono niente su chi è la persona. */
const GENERIC_LOCAL = new Set([
  'info', 'noreply', 'no-reply', 'amministrazione', 'segreteria', 'contatti',
  'hello', 'support', 'team', 'mail', 'posta', 'ufficio', 'admin', 'billing',
  'fatturazione', 'notifiche', 'notifications',
])

/**
 * Da un indirizzo alle parole che lo identificano.
 * `giulia.bianchi@studiobianchi.it` → ["giulia", "bianchi"], non il dominio:
 * il dominio è l'azienda, e confonderlo con la persona fa sì che una
 * mail dell'amministrazione risulti "di Giulia".
 */
export function tokensFromEmail(email: string): string[] {
  const local = fold(email).split('@')[0] ?? ''
  if (GENERIC_LOCAL.has(local)) return []
  return local
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t))
}

/** Le parole di un nome scritto per esteso. */
export function tokensFromName(name: string): string[] {
  return fold(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
}

/**
 * Le persone nominate in un testo: indirizzi espliciti, più i nomi
 * propri riconosciuti dalle maiuscole.
 *
 * Il riconoscimento dei nomi è volutamente prudente — due parole
 * maiuscole di fila, non una sola — perché una parola maiuscola in
 * mezzo a una frase italiana è più spesso l'inizio di una frase che
 * un cognome.
 */
export function extractPeople(text: string): Person[] {
  const out = new Map<string, Person>()

  for (const m of text.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase()
    out.set(email, { email, tokens: tokensFromEmail(email) })
  }

  for (const m of text.matchAll(/\b([A-ZÀ-Þ][a-zà-ÿ']{2,})\s+([A-ZÀ-Þ][a-zà-ÿ']{2,})\b/g)) {
    const tokens = tokensFromName(`${m[1]} ${m[2]}`)
    const key = tokens.join('-')
    if (key && !out.has(key)) out.set(key, { email: '', tokens })
  }

  return [...out.values()].filter((p) => p.email || p.tokens.length)
}

/**
 * Questa persona compare fra i partecipanti?
 *
 * Un indirizzo uguale è certezza. Un nome vale solo se **tutte** le sue
 * parole significative si ritrovano nello stesso partecipante: "Giulia
 * Bianchi" non deve agganciare `marco.bianchi@` né `giulia.verdi@`, e
 * pretendere l'intersezione piena è l'unico modo per escluderli
 * entrambi senza una rubrica.
 */
export function matchesParticipant(person: Person, participant: string): boolean {
  const p = fold(participant)
  if (person.email && p.includes(person.email)) return true
  if (!person.tokens.length) return false

  const theirs = new Set([...tokensFromEmail(participant), ...tokensFromName(participant)])
  return person.tokens.every((t) => theirs.has(t))
}

/** Gli indirizzi da cui partire per una query strutturata. */
export function addressesOf(people: Person[]): string[] {
  return [...new Set(people.map((p) => p.email).filter(Boolean))]
}

/** Come si scrive una persona in un'intestazione: "Giulia Bianchi" o l'indirizzo. */
export function displayPerson(person: Person): string {
  if (person.tokens.length) {
    return person.tokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ')
  }
  return person.email
}
