import { verifyClaims } from '../cite'
import { logRun, searchMemory } from '../memory'
import { runStructured } from '../model'
import { rankHits, selectSources, toFtsQuery } from '../rank'
import { CHANNEL_LABEL, type GroundedAnswer, type RawClaim, type SourceRef } from '../types'

/**
 * Il capo di gabinetto.
 *
 * Non è una chat sui documenti: è l'agente che ha letto tutto e che
 * risponde come risponderebbe una persona di fiducia — per punti, con
 * accanto da dove viene ogni punto e di quando è.
 *
 * La regola che lo distingue da un assistente qualsiasi è che non gli
 * è permesso sapere niente che non sia in memoria. Se le fonti non
 * rispondono, deve dire che non rispondono. E questa regola non è
 * affidata al prompt: il prompt la chiede, `verifyClaims` la impone.
 */

const AGENT_KEY = 'chief-of-staff'

const TOOL = {
  name: 'rispondi',
  description:
    'Restituisce la risposta come elenco di affermazioni, ognuna con le fonti da cui proviene.',
  input_schema: {
    type: 'object' as const,
    properties: {
      claims: {
        type: 'array',
        description:
          'Le affermazioni che rispondono alla domanda, dalla più importante alla meno importante. Vuoto se le fonti non rispondono.',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description:
                'Una frase italiana autosufficiente, comprensibile da sola, senza riferimenti tipo "come sopra".',
            },
            sources: {
              type: 'array',
              description: 'Gli handle delle fonti da cui viene questa frase, es. ["F1","F3"].',
              items: { type: 'string' },
            },
          },
          required: ['text', 'sources'],
        },
      },
      openQuestions: {
        type: 'array',
        description:
          'Punti rimasti aperti: cosa manca per rispondere del tutto, o cosa resta da decidere.',
        items: { type: 'string' },
      },
    },
    required: ['claims', 'openQuestions'],
  },
}

const SYSTEM = `Sei il capo di gabinetto di una sola persona. Conosci la sua memoria di lavoro: email, eventi di calendario, documenti, movimenti del conto, dati dell'anello Oura.

Rispondi in italiano, come parleresti a un professionista che ha poco tempo: frasi brevi, niente preamboli, niente "certamente".

REGOLE NON NEGOZIABILI
1. Ogni affermazione deve venire dalle FONTI qui sotto e deve dichiarare da quali, con il loro handle (F1, F2…). Un'affermazione senza handle valido viene scartata automaticamente prima di arrivare all'utente: scriverla è lavoro buttato.
2. Non usare conoscenze tue sul mondo, sulle persone o sui fatti. Se le fonti non contengono la risposta, restituisci "claims" vuoto e spiega in "openQuestions" che cosa manca. Dire "non risulta" è una risposta corretta e utile.
3. Numeri, importi, IBAN, orari, indirizzi e date vanno copiati esattamente come compaiono nella fonte. Non arrotondare, non convertire, non "sistemare". Un controllo automatico confronta ogni numero con le fonti che hai citato e marca quelli che non ci sono.
4. Se due fonti si contraddicono, dillo esplicitamente citandole entrambe, e indica quale è più recente.
5. Una frase, un fatto. Non impacchettare tre cose in un periodo solo: ognuna avrebbe fonti diverse.
6. Quando la domanda riguarda il tempo ("questa settimana", "l'ultima volta"), usa le date delle fonti per rispondere, e scrivi la data nella frase.`

function formatSources(refs: SourceRef[]): string {
  return refs
    .map((ref) => {
      const date = new Date(ref.occurredAt).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Rome',
      })
      return [
        `[${ref.handle}] ${CHANNEL_LABEL[ref.source]} · ${date}`,
        `Titolo: ${ref.title}`,
        ref.excerpt,
      ].join('\n')
    })
    .join('\n\n---\n\n')
}

export type AskOptions = {
  /** Quante fonti offrire al modello. */
  maxSources?: number
  /** Iniettabile nei test e per domande su una data passata. */
  now?: Date
  signal?: AbortSignal
}

export type ChiefOfStaffAnswer = GroundedAnswer & {
  /** Tutte le fonti offerte, anche quelle che il modello non ha citato. */
  offered: SourceRef[]
  /** Nessun documento in memoria corrisponde alla domanda. */
  empty: boolean
}

export async function askChiefOfStaff(
  question: string,
  options: AskOptions = {}
): Promise<ChiefOfStaffAnswer> {
  const started = Date.now()
  const now = options.now ?? new Date()

  const ftsQuery = toFtsQuery(question)
  const hits = ftsQuery ? await searchMemory(ftsQuery, { limit: 80 }) : []

  if (!hits.length) {
    const answer: ChiefOfStaffAnswer = {
      claims: [],
      dropped: [],
      openQuestions: ['In memoria non c\'è nessun documento che corrisponda alla domanda.'],
      model: 'nessuno',
      hits: 0,
      offered: [],
      empty: true,
    }
    await logRun({
      agent: AGENT_KEY,
      question,
      answer,
      model: null,
      hits: 0,
      latencyMs: Date.now() - started,
    })
    return answer
  }

  const offered = selectSources(rankHits(hits, question, { now }), {
    maxDocuments: options.maxSources ?? 8,
  })

  const today = now.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  })

  const { data, model } = await runStructured<{ claims?: RawClaim[]; openQuestions?: string[] }>({
    task: 'answer',
    system: SYSTEM,
    user: `Oggi è ${today}.\n\nDOMANDA\n${question}\n\nFONTI\n\n${formatSources(offered)}`,
    tool: TOOL,
    signal: options.signal,
  })

  // Qui il prompt smette di contare e comincia il codice.
  const { claims, dropped } = verifyClaims(Array.isArray(data.claims) ? data.claims : [], offered)

  const openQuestions = (Array.isArray(data.openQuestions) ? data.openQuestions : [])
    .map((q) => String(q).trim())
    .filter(Boolean)

  // Un'affermazione scartata è un buco nella risposta: va detto, non nascosto.
  if (dropped.length) {
    openQuestions.push(
      `${dropped.length} affermazion${dropped.length === 1 ? 'e' : 'i'} non ${
        dropped.length === 1 ? 'è stata mostrata' : 'sono state mostrate'
      }: non ${dropped.length === 1 ? 'era riconducibile' : 'erano riconducibili'} a una fonte in memoria.`
    )
  }

  const answer: ChiefOfStaffAnswer = {
    claims,
    dropped,
    openQuestions,
    model,
    hits: hits.length,
    offered,
    empty: false,
  }

  await logRun({
    agent: AGENT_KEY,
    question,
    answer: { claims, openQuestions, dropped: dropped.length },
    model,
    hits: hits.length,
    latencyMs: Date.now() - started,
  })

  return answer
}
