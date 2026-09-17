import { verifyClaims } from '../cite'
import { describeSearch, expandedQuery, shouldExpand } from '../expand'
import { countDocuments, logRun, searchMemory } from '../memory'
import { runStructured } from '../model'
import { queryTerms, rankHits, selectSources, toFtsQuery } from '../rank'
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
 *
 * Il costo di quella regola è che una ricerca andata male si traveste
 * da risposta: "non risulta" sembra un fatto e invece può essere un
 * fallimento del recupero. Due contromisure, e nessuna delle due
 * tocca la garanzia:
 *
 *  1. se il primo giro trova poco, il modello propone **altre parole
 *     con cui la stessa cosa potrebbe essere scritta** e si cerca di
 *     nuovo. Proporre termini non è rispondere: al massimo si cerca
 *     una parola inutile, e il ranking la ignora;
 *  2. una risposta vuota dichiara **cosa** ha cercato e su quanti
 *     documenti, così "non risulta" si può smentire.
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
7. Se fra le fonti c'è una CORREZIONE del titolare della memoria, vale su qualunque altra fonte sullo stesso punto, anche se più recente. Usa quella, e se un'altra fonte la contraddice dillo citandole entrambe.
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
  /** Le parole effettivamente cercate, espansione compresa. */
  searched: string[]
  /** Quanti documenti c'erano da guardare. */
  scanned: number
  /** Una riga che rende verificabile una risposta vuota. */
  searchNote: string
}

const EXPAND_TOOL = {
  name: 'proponi_termini',
  description: 'Propone altre parole con cui la stessa cosa potrebbe essere scritta nei documenti.',
  input_schema: {
    type: 'object' as const,
    properties: {
      termini: {
        type: 'array',
        description:
          'Sinonimi, varianti e termini vicini, una parola ciascuno dove possibile. Italiano, più l\'inglese quando è il termine che si userebbe davvero in un documento di lavoro.',
        items: { type: 'string' },
      },
    },
    required: ['termini'],
  },
}

/**
 * Altre parole con cui cercare.
 *
 * Il modello vede **solo la domanda**, mai un documento: non è un
 * risparmio, è una garanzia strutturale — da qui non può uscire niente
 * che somigli a una risposta, perché non ha niente da cui ricavarla.
 */
async function proposeTerms(question: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const { data } = await runStructured<{ termini?: unknown[] }>({
      task: 'extract',
      system: `Proponi parole con cui cercare in un archivio di email, documenti e appunti di lavoro in italiano.

NON rispondere alla domanda. NON inventare nomi di persone, aziende o pratiche che non compaiono nella domanda.
Proponi solo sinonimi, varianti morfologiche, termini tecnici equivalenti e la parola inglese quando è quella che si userebbe davvero in un documento (es. "pricing" → listino, prezzi, tariffe, sconto, preventivo).
Da otto a dodici termini, uno per riga concettuale, senza spiegazioni.`,
      user: question,
      tool: EXPAND_TOOL,
      signal,
    })
    return (Array.isArray(data.termini) ? data.termini : []).map(String)
  } catch {
    // L'espansione è un miglioramento, non un requisito: se il modello
    // veloce non risponde, si va avanti con la ricerca diretta.
    return []
  }
}

export async function askChiefOfStaff(
  question: string,
  options: AskOptions = {}
): Promise<ChiefOfStaffAnswer> {
  const started = Date.now()
  const now = options.now ?? new Date()

  const terms = queryTerms(question)
  const ftsQuery = toFtsQuery(question)
  let hits = ftsQuery ? await searchMemory(ftsQuery, { limit: 80 }) : []
  let searched = terms

  // Secondo giro solo se il primo ha trovato poco.
  if (shouldExpand(hits.length, terms)) {
    const proposed = await proposeTerms(question, options.signal)
    if (proposed.length) {
      const wider = expandedQuery(terms, proposed)
      const more = await searchMemory(wider, { limit: 80 })

      // Unione, non sostituzione: quello che la ricerca diretta aveva
      // trovato resta, e a pesare i nuovi arrivati ci pensa il ranking.
      const byChunk = new Map(hits.map((h) => [h.chunkId, h]))
      for (const hit of more) if (!byChunk.has(hit.chunkId)) byChunk.set(hit.chunkId, hit)
      hits = [...byChunk.values()]
      searched = wider.split(' or ')
    }
  }

  const scanned = await countDocuments().catch(() => 0)
  const searchNote = describeSearch(searched, scanned)

  if (!hits.length) {
    const answer: ChiefOfStaffAnswer = {
      claims: [],
      dropped: [],
      openQuestions: [searchNote + ' Nessuno corrisponde alla domanda.'],
      model: 'nessuno',
      hits: 0,
      offered: [],
      empty: true,
      searched,
      scanned,
      searchNote,
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

  // Il ranking usa la domanda **originale**, non quella espansa:
  // l'espansione serve ad allargare cosa si trova, non a cambiare cosa
  // conta di più. Altrimenti un sinonimo proposto dal modello peserebbe
  // quanto una parola scritta dall'utente.
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

  if (!claims.length) openQuestions.push(searchNote)

  const answer: ChiefOfStaffAnswer = {
    claims,
    dropped,
    openQuestions,
    model,
    hits: hits.length,
    offered,
    empty: false,
    searched,
    scanned,
    searchNote,
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
