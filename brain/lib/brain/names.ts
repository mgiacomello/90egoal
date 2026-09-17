/**
 * I nomi degli assistenti.
 *
 * Nel post che ha ispirato questo prodotto ogni agente ha un nome di
 * persona — DadeAI, DiegoAI, GiorgiaAI — e non è un vezzo: un nome
 * dice *a chi* stai chiedendo, e chiedere a qualcuno è più naturale
 * che aprire una scheda. Qui i nomi stanno in un posto solo, e sono
 * del titolare: si cambiano in questo file e in nessun altro.
 *
 * `name` a `null` vuol dire che l'assistente non ha ancora un nome, e
 * l'interfaccia mostra il ruolo. Il ruolo resta sempre accanto al
 * nome, perché "Giorgia" da sola non dice cosa fa.
 */

export type AgentKey = 'chief' | 'brief' | 'meeting' | 'contracts' | 'ledger' | 'coach' | 'postcall'

export type AgentIdentity = {
  /** Il nome di persona. Va scelto dal titolare. */
  name: string | null
  /** Cosa fa, in due o tre parole minuscole. */
  role: string
  /** L'etichetta della scheda quando non c'è un nome. */
  tab: string
}

export const AGENTS: Record<AgentKey, AgentIdentity> = {
  chief: { name: null, role: 'capo di gabinetto', tab: 'Chiedi' },
  brief: { name: null, role: 'brief del mattino', tab: 'Brief' },
  meeting: { name: null, role: 'preparazione incontri', tab: 'Incontri' },
  contracts: { name: null, role: 'contratti', tab: 'Contratti' },
  ledger: { name: null, role: 'amministrazione', tab: 'Conto' },
  coach: { name: null, role: 'coach', tab: 'Coach' },
  postcall: { name: null, role: 'dopo la call', tab: 'Dopo la call' },
}

/** L'etichetta della scheda: il nome se c'è, altrimenti il ruolo. */
export function agentTab(key: AgentKey): string {
  const a = AGENTS[key]
  return a.name ?? a.tab
}

/** La riga sotto le schede: "Giorgia · preparazione incontri" oppure solo il ruolo. */
export function agentHeadline(key: AgentKey): string {
  const a = AGENTS[key]
  return a.name ? `${a.name} · ${a.role}` : a.role
}
