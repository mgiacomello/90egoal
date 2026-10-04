/**
 * Le relazioni. Funzione pura: niente rete, niente DOM, nessun import
 * di valori.
 *
 * Un CRM chiede di essere compilato, e per questo nessun professionista
 * lo compila. Qui il CRM si deduce: chi compare nelle mail e negli
 * incontri, quante volte, quando l'ultima — e soprattutto **chi si sta
 * raffreddando**: una relazione che aveva un ritmo e da un po' tace.
 * È aritmetica sulle date, e si fa senza modello.
 */

export type TouchLike = {
  id: string
  /** 'email' | 'event' */
  kind: string
  title: string
  occurredAt: string
  participants: string[]
}

export type Relation = {
  /** L'indirizzo, o il dominio per le organizzazioni. */
  key: string
  label: string
  /** Gli indirizzi raccolti sotto questa chiave. */
  emails: string[]
  touches: number
  firstAt: string
  lastAt: string
  /** Giorni dall'ultimo contatto. */
  silenceDays: number
  /** Intervallo medio fra due contatti, in giorni. */
  rhythmDays: number | null
  /** Il silenzio supera di molto il ritmo abituale. */
  cooling: boolean
  /** Gli ultimi documenti in cui compare. */
  recentIds: string[]
}

const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.it', 'hotmail.com', 'hotmail.it', 'live.com', 'live.it',
  'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'tin.it',
  'pec.it', 'legalmail.it', 'proton.me', 'protonmail.com', 'fastwebnet.it', 'email.it', 'aruba.it', 'pec.giuffre.it',
])

const NOISE = /^(no-?reply|noreply|notifications?|notifiche|newsletter|news|mailer|bounce|do-?not-?reply|alert|updates?|calendar-notification|drive-shares-noreply|hello|support|marketing|digest|info|billing|invoice|fatture|amministrazione|segreteria)[@.+-]/i

export function isNoiseAddress(email: string): boolean {
  return NOISE.test(email) || /@(?:.*\.)?(?:google\.com|calendar\.google\.com|group\.calendar\.google\.com|docs\.google\.com|vercel\.com|github\.com|linkedin\.com|slack\.com|notion\.so|stripe\.com|qonto\.com|apple\.com|amazon\.\w+)$/i.test(email)
}

/** La chiave: la persona se il dominio è generico, l'organizzazione altrimenti. */
export function relationKey(email: string): string {
  const [, domain = ''] = email.toLowerCase().split('@')
  return FREEMAIL.has(domain) ? email.toLowerCase() : domain
}

function labelOf(key: string, emails: string[]): string {
  if (key.includes('@')) return key
  const org = key.split('.')[0]
  const name = org.charAt(0).toUpperCase() + org.slice(1)
  return emails.length === 1 ? `${name} (${emails[0]})` : `${name} (${emails.length} persone)`
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, (Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/**
 * Le relazioni, dal contatto più recente. Il titolare non è una
 * relazione; gli indirizzi di servizio nemmeno.
 */
export function buildRelations(touches: TouchLike[], owner: string, now = new Date()): Relation[] {
  const me = owner.toLowerCase()
  const myDomain = relationKey(me)
  const groups = new Map<string, { emails: Set<string>; docs: TouchLike[] }>()

  for (const t of touches) {
    for (const raw of t.participants) {
      const email = raw.toLowerCase()
      if (email === me || isNoiseAddress(email)) continue
      const key = relationKey(email)
      // I colleghi dello stesso dominio non sono una relazione esterna.
      if (!key.includes('@') && key === myDomain) continue
      const g = groups.get(key) ?? { emails: new Set<string>(), docs: [] }
      g.emails.add(email)
      if (!g.docs.some((d) => d.id === t.id)) g.docs.push(t)
      groups.set(key, g)
    }
  }

  const nowIso = now.toISOString()
  const out: Relation[] = []
  for (const [key, g] of groups) {
    const docs = [...g.docs].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const first = docs[0].occurredAt
    const last = docs[docs.length - 1].occurredAt
    const gaps = docs.slice(1).map((d, i) => daysBetween(docs[i].occurredAt, d.occurredAt))
    const rhythm = gaps.length >= 2 ? Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length) : null
    const silence = Math.floor(daysBetween(last, nowIso))
    const emails = [...g.emails].sort()
    out.push({
      key,
      label: labelOf(key, emails),
      emails,
      touches: docs.length,
      firstAt: first,
      lastAt: last,
      silenceDays: silence,
      rhythmDays: rhythm,
      cooling: rhythm !== null && docs.length >= 4 && silence >= 21 && silence > rhythm * 2,
      recentIds: docs.slice(-3).reverse().map((d) => d.id),
    })
  }

  return out.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))
}

/** Chi si sta raffreddando, dal silenzio più lungo in rapporto al ritmo. */
export function cooling(relations: Relation[]): Relation[] {
  return relations
    .filter((r) => r.cooling)
    .sort((a, b) => b.silenceDays / (b.rhythmDays ?? 1) - a.silenceDays / (a.rhythmDays ?? 1))
}

/** Le relazioni più frequenti negli ultimi `days` giorni. */
export function mostActive(relations: Relation[], limit = 8): Relation[] {
  return [...relations].sort((a, b) => b.touches - a.touches).slice(0, limit)
}
