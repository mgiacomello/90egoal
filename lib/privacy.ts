// Informativa privacy: titolare e versione. La versione accettata viene salvata
// con l'account alla registrazione; se il testo cambia nella sostanza, si aggiorna qui.
export const TITOLARE = { nome: 'GoalGames S.r.l.', indirizzo: 'Via Seprio, 2, Milano', email: 'privacy@goalgames.it' }
export const PRIVACY_VERSIONE = '2026-11-20'

// Chi si è registrato prima dell'informativa non l'ha mai accettata: vede l'avviso al primo
// accesso. Lo stesso succede se la versione cambia nella sostanza.
export function privacyDaAccettare(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.privacy_versione !== PRIVACY_VERSIONE
}
