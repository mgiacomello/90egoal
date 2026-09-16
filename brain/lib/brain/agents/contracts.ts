import { logRun } from '../memory'
import { runStructured } from '../model'
import { matchQuote, type QuoteMatch } from '../quote'

/**
 * L'agente Contratti.
 *
 * Non è un riassuntore: è la griglia con cui un contratto si legge
 * quando bisogna deciderlo. Per ogni clausola critica dice **se è
 * accettabile o rischiosa**, **cos'è standard di mercato** e **quale
 * controproposta fare** — le tre cose che servono a rispondere a un
 * cliente, nell'ordine in cui servono.
 *
 * La regola deterministica qui è più stretta di quella del capo di
 * gabinetto, e per un motivo che si capisce subito: un'analisi
 * costruita su una clausola che nel contratto non c'è non è
 * "imprecisa", è pericolosa.
 *
 *   **La clausola citata deve esistere nel testo. Se non c'è, la sua
 *   analisi non viene mostrata** (`lib/brain/quote.ts`).
 *
 * Attenzione a cosa *non* è verificato, perché confondere le due cose
 * sarebbe peggio che non verificare niente: la citazione è un fatto e
 * viene controllata; il rischio, lo standard di mercato e la
 * controproposta sono giudizi, e restano giudizi di un modello.
 */

const AGENT_KEY = 'contracts'

/** Oltre questa soglia il contratto viene tagliato, e l'analisi lo dichiara. */
const MAX_CHARS = 120_000

export type RiskLevel = 'alto' | 'medio' | 'basso'
export type Verdict = 'accettabile' | 'accettabile con modifiche' | 'rischioso'

export type RawClause = {
  titolo?: unknown
  citazione?: unknown
  rischio?: unknown
  perche?: unknown
  standard?: unknown
  controproposta?: unknown
}

export type VerifiedClause = {
  titolo: string
  /** Il testo del contratto, verificato: o c'è, o questa clausola non esiste. */
  citazione: string
  quote: QuoteMatch
  rischio: RiskLevel
  /** Perché è un problema. Giudizio, non fatto. */
  perche: string
  /** Cosa si vede di solito sul mercato. Giudizio, non fatto. */
  standard: string
  /** Testo pronto da mettere in controproposta. Proposta, non citazione. */
  controproposta: string
}

export type ContractAnalysis = {
  verdetto: Verdict
  sintesi: string
  clausole: VerifiedClause[]
  /** Clausole che il modello ha citato ma che nel contratto non ci sono. */
  scartate: { titolo: string; citazione: string }[]
  /** Clausole assenti che in un contratto così ci si aspetterebbe. */
  mancanti: string[]
  /** Il testo era più lungo del limite ed è stato tagliato. */
  troncato: boolean
  model: string
  parte: string
}

const RISKS: RiskLevel[] = ['alto', 'medio', 'basso']
const VERDICTS: Verdict[] = ['accettabile', 'accettabile con modifiche', 'rischioso']

const TOOL = {
  name: 'analizza_contratto',
  description: 'Restituisce l\'analisi del contratto clausola per clausola.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdetto: {
        type: 'string',
        enum: VERDICTS,
        description: 'Il giudizio complessivo sul contratto così com\'è.',
      },
      sintesi: {
        type: 'string',
        description: 'Due o tre frasi: che contratto è, e qual è il problema principale. Niente preamboli.',
      },
      clausole: {
        type: 'array',
        description:
          'Le clausole critiche, dalla più rischiosa alla meno rischiosa. Solo quelle che meritano una decisione: un elenco di venti voci non si legge.',
        items: {
          type: 'object',
          properties: {
            titolo: { type: 'string', description: 'Di cosa tratta, in poche parole. Es. "Recesso", "Limitazione di responsabilità".' },
            citazione: {
              type: 'string',
              description:
                'Il testo ESATTO della clausola, copiato dal contratto parola per parola. Non riformulare, non abbreviare, non aggiungere puntini. Una citazione che non coincide col testo viene scartata da un controllo automatico e la tua analisi di quella clausola sparisce.',
            },
            rischio: { type: 'string', enum: RISKS },
            perche: { type: 'string', description: 'Perché è un problema per la parte che rappresenti, in concreto.' },
            standard: { type: 'string', description: 'Cosa si vede di solito sul mercato per questo tipo di clausola.' },
            controproposta: { type: 'string', description: 'Il testo da proporre al posto di quello attuale, pronto da incollare.' },
          },
          required: ['titolo', 'citazione', 'rischio', 'perche', 'standard', 'controproposta'],
        },
      },
      mancanti: {
        type: 'array',
        description: 'Clausole che in un contratto di questo tipo ci si aspetterebbe e qui non ci sono.',
        items: { type: 'string' },
      },
    },
    required: ['verdetto', 'sintesi', 'clausole', 'mancanti'],
  },
}

const SYSTEM = `Sei un avvocato senior che legge un contratto per decidere se firmarlo, non per riassumerlo.

Rispondi in italiano, in modo asciutto e pratico. Chi legge ha poco tempo e deve rispondere a un cliente.

Per ogni clausola critica servono tre cose, sempre nello stesso ordine:
1. se è accettabile o rischiosa, e perché in concreto;
2. cosa è standard di mercato per quel tipo di clausola;
3. quale controproposta fare, con il testo pronto.

REGOLE NON NEGOZIABILI
1. Il campo "citazione" deve contenere il testo del contratto COPIATO PAROLA PER PAROLA. Non riformulare, non riassumere, non correggere refusi, non aggiungere "[...]". Un controllo automatico confronta ogni citazione col testo del contratto: se non coincide, l'intera analisi di quella clausola viene scartata prima di arrivare all'utente.
2. Non inventare numeri di articolo. Se il contratto non li numera, cita il testo e basta.
3. Segnala solo le clausole su cui c'è davvero una decisione da prendere. Meglio cinque voci che contano che venti che nessuno legge.
4. Quando una clausola è ambigua, dillo: l'ambiguità è essa stessa un rischio, e la controproposta deve risolverla.
5. Non dire che una cosa è "standard di mercato" se non ne sei ragionevolmente sicuro. Scrivi invece cosa si vede più spesso, e che varia.
6. Se il contratto è governato da una legge straniera o prevede un foro estero, segnalalo come clausola a sé: cambia il costo di ogni controversia.`

export type AnalyzeOptions = {
  /** Chi rappresenti: cambia completamente quali clausole sono un problema. */
  side?: string
  title?: string
  signal?: AbortSignal
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function analyzeContract(
  text: string,
  options: AnalyzeOptions = {}
): Promise<ContractAnalysis> {
  const started = Date.now()

  const full = text.trim()
  const troncato = full.length > MAX_CHARS
  const contract = troncato ? full.slice(0, MAX_CHARS) : full

  const parte = options.side?.trim() || 'non specificata'

  const { data, model } = await runStructured<{
    verdetto?: unknown
    sintesi?: unknown
    clausole?: RawClause[]
    mancanti?: unknown[]
  }>({
    task: 'answer',
    system: SYSTEM,
    user: [
      `PARTE CHE RAPPRESENTI: ${parte}.`,
      parte === 'non specificata'
        ? 'Non è stato dichiarato da che parte si sta: analizza le clausole che sono squilibrate per chiunque le subisca, e dove il giudizio dipende dalla parte, dillo.'
        : '',
      options.title ? `TITOLO DEL DOCUMENTO: ${options.title}` : '',
      troncato
        ? 'ATTENZIONE: il testo qui sotto è stato troncato perché troppo lungo. Non trarre conclusioni sulle parti mancanti.'
        : '',
      '',
      'CONTRATTO',
      contract,
    ]
      .filter(Boolean)
      .join('\n'),
    tool: TOOL,
    signal: options.signal,
  })

  // Qui il prompt smette di contare e comincia il codice.
  const clausole: VerifiedClause[] = []
  const scartate: { titolo: string; citazione: string }[] = []

  for (const raw of Array.isArray(data.clausole) ? data.clausole : []) {
    const citazione = asString(raw.citazione)
    const titolo = asString(raw.titolo) || '(senza titolo)'
    if (!citazione) {
      scartate.push({ titolo, citazione: '' })
      continue
    }

    const quote = matchQuote(citazione, contract)
    if (quote.status === 'missing') {
      scartate.push({ titolo, citazione })
      continue
    }

    const rischio = asString(raw.rischio) as RiskLevel
    clausole.push({
      titolo,
      citazione,
      quote,
      rischio: RISKS.includes(rischio) ? rischio : 'medio',
      perche: asString(raw.perche),
      standard: asString(raw.standard),
      controproposta: asString(raw.controproposta),
    })
  }

  // L'ordine è quello del rischio: chi legge deve trovare in cima
  // la cosa su cui deve decidere per prima.
  const order: Record<RiskLevel, number> = { alto: 0, medio: 1, basso: 2 }
  clausole.sort((a, b) => order[a.rischio] - order[b.rischio])

  const verdetto = asString(data.verdetto) as Verdict

  const analysis: ContractAnalysis = {
    verdetto: VERDICTS.includes(verdetto) ? verdetto : 'accettabile con modifiche',
    sintesi: asString(data.sintesi),
    clausole,
    scartate,
    mancanti: (Array.isArray(data.mancanti) ? data.mancanti : []).map(asString).filter(Boolean),
    troncato,
    model,
    parte,
  }

  await logRun({
    agent: AGENT_KEY,
    question: options.title ?? '(testo incollato)',
    answer: {
      verdetto: analysis.verdetto,
      clausole: clausole.length,
      scartate: scartate.length,
      parte,
    },
    model,
    hits: clausole.length,
    latencyMs: Date.now() - started,
  })

  return analysis
}
