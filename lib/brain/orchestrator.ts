/**
 * Orchestrator: per ogni tipo di task, il modello che rende meglio su
 * quella singola azione. Funzione pura, quindi testabile: la scelta è
 * una tabella, non un'intuizione dentro a un prompt.
 *
 * Nota onesta sullo stato: in questa versione l'unico provider con un
 * esecutore è Anthropic (`lib/brain/model.ts`). Le altre righe della
 * tabella esistono perché il routing sia vero appena arriva la chiave,
 * non per far sembrare il sistema più grande di quello che è.
 */

export type BrainTask =
  /** Ragionare sulla memoria e rispondere con le fonti. */
  | 'answer'
  /** Estrarre campi da un documento appena arrivato: veloce e a basso costo. */
  | 'extract'
  /** Scrivere una bozza destinata a un umano (mail, follow-up). */
  | 'draft'

export type Provider = 'anthropic' | 'openai' | 'google'

export type ModelChoice = {
  provider: Provider
  model: string
  maxTokens: number
  /** Perché questo modello per questo task. Finisce nel log di esecuzione. */
  why: string
}

/** Ordine di preferenza per task. Il primo disponibile vince. */
export const ROUTES: Record<BrainTask, ModelChoice[]> = {
  answer: [
    { provider: 'anthropic', model: 'claude-opus-5', maxTokens: 2000, why: 'ragionamento lungo su fonti eterogenee' },
    { provider: 'openai', model: 'gpt-5', maxTokens: 2000, why: 'alternativa di pari livello' },
    { provider: 'google', model: 'gemini-2.5-pro', maxTokens: 2000, why: 'alternativa con contesto ampio' },
  ],
  extract: [
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', maxTokens: 1200, why: 'estrazione ripetitiva: conta la velocità' },
    { provider: 'google', model: 'gemini-2.5-flash', maxTokens: 1200, why: 'alternativa veloce' },
    { provider: 'openai', model: 'gpt-5-mini', maxTokens: 1200, why: 'alternativa veloce' },
  ],
  draft: [
    { provider: 'anthropic', model: 'claude-sonnet-5', maxTokens: 1600, why: 'testo per un umano: tono ed equilibrio' },
    { provider: 'openai', model: 'gpt-5', maxTokens: 1600, why: 'alternativa di pari livello' },
    { provider: 'google', model: 'gemini-2.5-pro', maxTokens: 1600, why: 'alternativa di pari livello' },
  ],
}

export type Availability = Partial<Record<Provider, boolean>>

/** Il primo modello della riga il cui provider ha una chiave. */
export function pickModel(task: BrainTask, available: Availability): ModelChoice | null {
  for (const choice of ROUTES[task]) {
    if (available[choice.provider]) return choice
  }
  return null
}

/** Quali provider sono configurati davvero, letto dall'ambiente. */
export function availableProviders(env: NodeJS.ProcessEnv = process.env): Availability {
  return {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    google: Boolean(env.GOOGLE_AI_API_KEY),
  }
}
