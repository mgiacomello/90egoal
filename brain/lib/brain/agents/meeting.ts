import { verifyClaims } from '../cite'
import {
  documentById,
  documentsWithParticipants,
  listOpenPoints,
  logRun,
  searchMemory,
  type OpenPoint,
} from '../memory'
import { runStructured } from '../model'
import { extractPeople, matchesParticipant, addressesOf, displayPerson, type Person } from '../people'
import { rankHits, selectSources, sourcesFromDocuments, toFtsQuery } from '../rank'
import { CHANNEL_LABEL, type RawClaim, type SourceRef, type StoredDocument, type VerifiedClaim } from '../types'

/**
 * L'agente Incontro.
 *
 * È il "One to One" del post che ha ispirato questo prodotto,
 * generalizzato: non solo i 1:1 col team, ma **qualunque incontro con
 * qualcuno**. Per un professionista è la cosa di più valore in
 * assoluto — cinque minuti prima di entrare, tutto quello che la
 * memoria sa di quella persona, e soprattutto cosa era rimasto in
 * sospeso con lei.
 *
 * La parte interessante è il recupero, ed è l'opposto di quello che
 * fanno gli altri agenti.
 *
 *   **Prima chi, poi cosa.**
 *
 * Gli altri cercano per parole. Qui si parte da un elenco esatto di
 * indirizzi e si interroga la colonna `participants`, che ha il suo
 * indice: chi era nella stanza è un fatto, non una somiglianza.
 * Cercare "Bianchi" prenderebbe anche il fornitore Bianchi Srl;
 * cercare `giulia.bianchi@studiobianchi.it` prende Giulia e basta.
 * Solo dopo si aggiunge una ricerca per parole sul titolo
 * dell'incontro, per pescare i documenti in cui la persona non è
 * formalmente fra i partecipanti ma l'argomento sì.
 *
 * I punti aperti vengono filtrati sulla persona con lo stesso
 * criterio, e sono la metà che conta: un'agenda che elenca quello che
 * vi siete detti è un riassunto, una che dice cosa avete lasciato
 * aperto è una preparazione.
 */

const AGENT_KEY = 'meeting'
const MAX_SOURCES = 14

const TOOL = {
  name: 'prepara_incontro',
  description: 'Costruisce l\'agenda di un incontro a partire da quello che è già stato detto.',
  input_schema: {
    type: 'object' as const,
    properties: {
      punti: {
        type: 'array',
        description:
          'I punti da toccare, dal più importante. Solo cose su cui c\'è qualcosa da dire o da decidere, non un riassunto della corrispondenza.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Una frase, con la data quando serve a collocarla.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      sospesi: {
        type: 'array',
        description:
          'Cosa è rimasto in sospeso fra voi: domande senza risposta, impegni presi e non chiusi, decisioni rimandate. È la parte che conta di più.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Cosa è in sospeso, e da parte di chi.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
      daSapere: {
        type: 'array',
        description:
          'Fatti da avere in testa entrando: importi, date, nomi, condizioni già concordate. Vuoto se non ce ne sono.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Il fatto, copiato esattamente dalla fonte.' },
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'sources'],
        },
      },
    },
    required: ['punti', 'sospesi', 'daSapere'],
  },
}

const SYSTEM = `Stai preparando qualcuno che fra poco entra in una riunione. Ha cinque minuti per leggere.

Scrivi in italiano, per punti, frasi brevi. Niente preamboli, niente "in sintesi", niente riassunti di cortesia.

REGOLE NON NEGOZIABILI
1. Ogni riga deve venire dalle FONTI qui sotto e dichiarare da quali, con il loro handle (F1, F2…). Una riga senza handle valido viene scartata automaticamente: scriverla è lavoro buttato.
2. Non usare conoscenze tue sulle persone o sulle aziende. Se le fonti non dicono niente di utile, lascia le sezioni vuote: un'agenda corta e vera batte un'agenda lunga e inventata.
3. Numeri, importi, date, condizioni e nomi vanno copiati esattamente come compaiono nella fonte.
4. In "sospesi" metti solo cose davvero non chiuse, e dì **da parte di chi**: "aspetta una risposta da te" e "deve mandarti il documento" sono due situazioni diverse e chi legge deve saperlo in un colpo d'occhio.
5. Non ripetere la stessa cosa in due sezioni. Se una cosa è in sospeso, sta in "sospesi" e non in "punti".
6. Se fra le fonti c'è una CORREZIONE del titolare della memoria, vale su qualunque altra fonte sullo stesso punto, anche se più recente.`

export type MeetingBrief = {
  /** L'incontro, come lo si riconosce. */
  title: string
  when: string | null
  /** Con chi, in chiaro. */
  people: string[]
  punti: VerifiedClaim[]
  sospesi: VerifiedClaim[]
  daSapere: VerifiedClaim[]
  /** I punti aperti che riguardano queste persone, con la loro età. */
  openPoints: OpenPoint[]
  /** Quanti documenti la memoria ha su queste persone. */
  found: number
  dropped: number
  model: string
  offered: SourceRef[]
}

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => {
      const d = new Date(ref.occurredAt)
      const when = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
      return `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${when}\nTitolo: ${ref.title}\n${ref.excerpt}`
    })
    .join('\n\n---\n\n')
}

export type PrepareOptions = {
  /** L'evento di calendario da cui partire. */
  eventId?: string
  /** Oppure, a mano: con chi e di cosa. */
  who?: string
  topic?: string
  signal?: AbortSignal
}

export async function prepareMeeting(options: PrepareOptions): Promise<MeetingBrief> {
  const started = Date.now()

  let title = options.topic?.trim() || 'Incontro'
  let when: string | null = null
  let people: Person[] = []
  let event: StoredDocument | null = null

  if (options.eventId) {
    event = await documentById(options.eventId)
    if (event) {
      title = event.title
      when = event.occurredAt
      // I partecipanti dell'evento sono l'elenco esatto: niente da indovinare.
      people = (event.participants ?? []).map((email) => ({
        email: email.toLowerCase(),
        tokens: [],
      }))
    }
  }

  if (options.who?.trim()) {
    people = [...people, ...extractPeople(options.who)]
  }

  // 1. Prima CHI: query strutturata sui partecipanti.
  const addresses = addressesOf(people)
  const byPerson = await documentsWithParticipants(addresses, 50)

  // 2. Poi COSA: le parole del titolo, per i documenti in cui la persona
  //    non è fra i partecipanti ma l'argomento è quello.
  const topicQuery = toFtsQuery(`${title} ${options.topic ?? ''}`)
  const byTopic = topicQuery
    ? selectSources(rankHits(await searchMemory(topicQuery, { limit: 40 }), title), { maxDocuments: 6 })
    : []

  // L'evento stesso non è una fonte utile su sé stesso, ma il suo invito sì.
  const seen = new Set(byTopic.map((s) => s.documentId))
  const personSources = sourcesFromDocuments(
    byPerson.filter((d) => !seen.has(d.id)).slice(0, MAX_SOURCES - byTopic.length)
  )

  // Riassegna gli handle in modo continuo: F1…Fn senza buchi né collisioni.
  const offered: SourceRef[] = [...personSources, ...byTopic].map((ref, i) => ({
    ...ref,
    handle: `F${i + 1}`,
  }))

  // I punti aperti che riguardano queste persone.
  const allPoints = await listOpenPoints().catch(() => [] as OpenPoint[])
  const openPoints = allPoints.filter((point) =>
    people.some(
      (person) =>
        matchesParticipant(person, point.text) ||
        point.citations.some((c) => people.some((p) => matchesParticipant(p, c.title)))
    )
  )

  const names = people.map(displayPerson).filter(Boolean)

  if (!offered.length) {
    const brief: MeetingBrief = {
      title,
      when,
      people: names,
      punti: [],
      sospesi: [],
      daSapere: [],
      openPoints,
      found: 0,
      dropped: 0,
      model: 'nessuno',
      offered: [],
    }
    await logRun({ agent: AGENT_KEY, question: title, answer: { vuoto: true }, model: null, hits: 0, latencyMs: Date.now() - started })
    return brief
  }

  const { data, model } = await runStructured<{
    punti?: RawClaim[]
    sospesi?: RawClaim[]
    daSapere?: RawClaim[]
  }>({
    task: 'answer',
    system: SYSTEM,
    user: [
      `INCONTRO: ${title}`,
      when ? `QUANDO: ${new Date(when).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}` : '',
      names.length ? `CON: ${names.join(', ')}` : '',
      openPoints.length
        ? `\nPUNTI GIÀ APERTI con queste persone (non ripeterli, sono già in agenda):\n${openPoints.map((p) => `- ${p.text}`).join('\n')}`
        : '',
      '',
      'FONTI',
      '',
      formatSources(offered),
    ]
      .filter(Boolean)
      .join('\n'),
    tool: TOOL,
    signal: options.signal,
  })

  const punti = verifyClaims(Array.isArray(data.punti) ? data.punti : [], offered)
  const sospesi = verifyClaims(Array.isArray(data.sospesi) ? data.sospesi : [], offered)
  const daSapere = verifyClaims(Array.isArray(data.daSapere) ? data.daSapere : [], offered)

  const brief: MeetingBrief = {
    title,
    when,
    people: names,
    punti: punti.claims,
    sospesi: sospesi.claims,
    daSapere: daSapere.claims,
    openPoints,
    found: byPerson.length,
    dropped: punti.dropped.length + sospesi.dropped.length + daSapere.dropped.length,
    model,
    offered,
  }

  await logRun({
    agent: AGENT_KEY,
    question: title,
    answer: {
      people: names,
      punti: brief.punti.length,
      sospesi: brief.sospesi.length,
      dropped: brief.dropped,
    },
    model,
    hits: offered.length,
    latencyMs: Date.now() - started,
  })

  return brief
}
