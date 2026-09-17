import Anthropic from '@anthropic-ai/sdk'
import { BrainError } from './errors'
import { availableProviders, pickModel, type BrainTask } from './orchestrator'

/**
 * L'unico posto da cui si parla con un modello.
 *
 * Due scelte che contano:
 *
 * 1. La risposta non è testo libero da riparsare, è la chiamata di uno
 *    strumento con uno schema. Il modello non può restituire JSON rotto
 *    né aggiungere un preambolo: o compila i campi, o fallisce.
 *
 * 2. Il modello lo sceglie l'orchestrator, non chi chiama. Chi chiama
 *    dichiara *che tipo di lavoro* è ('answer', 'extract', 'draft') e
 *    la tabella fa il resto.
 */

export type StructuredRequest = {
  task: BrainTask
  system: string
  user: string
  tool: {
    name: string
    description: string
    input_schema: Anthropic.Tool.InputSchema
  }
  signal?: AbortSignal
}

export type StructuredResult<T> = {
  data: T
  model: string
  why: string
}

export async function runStructured<T>(req: StructuredRequest): Promise<StructuredResult<T>> {
  const choice = pickModel(req.task, availableProviders())
  if (!choice) {
    throw new BrainError(
      'Nessun modello configurato: serve ANTHROPIC_API_KEY (oppure OPENAI_API_KEY / GOOGLE_AI_API_KEY).',
      503
    )
  }
  if (choice.provider !== 'anthropic') {
    // Onestà sullo stato: la tabella di routing prevede altri provider,
    // l'esecutore no. Meglio dirlo che fingere un fallback silenzioso.
    throw new BrainError(
      `Provider "${choice.provider}" previsto dal routing ma non ancora eseguibile in questa versione.`,
      501
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let response: Anthropic.Message
  try {
    response = await client.messages.create(
      {
        model: choice.model,
        max_tokens: choice.maxTokens,
        system: req.system,
        tools: [req.tool],
        tool_choice: { type: 'tool', name: req.tool.name },
        messages: [{ role: 'user', content: req.user }],
      },
      { signal: req.signal }
    )
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new BrainError('Chiave Anthropic non valida.', 401)
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new BrainError('Modello sovraccarico, riprova fra poco.', 429)
    }
    throw new BrainError(`Il modello non ha risposto: ${(err as Error).message}`, 502)
  }

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === req.tool.name
  )
  if (!block) {
    throw new BrainError('Il modello non ha compilato la risposta strutturata.', 502)
  }

  return { data: block.input as T, model: choice.model, why: choice.why }
}
