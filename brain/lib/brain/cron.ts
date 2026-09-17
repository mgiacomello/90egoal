import { timingSafeEqual } from 'node:crypto'

/**
 * Chi può far partire un'esecuzione automatica.
 *
 * Questo endpoint sincronizza la memoria personale di qualcuno: non
 * può stare aperto. La regola è **chiuso per difetto** — senza
 * `CRON_SECRET` configurato nessuno entra, nemmeno Vercel. Un segreto
 * mancante non è un caso da trattare con indulgenza: è una porta
 * spalancata, e va trattata come tale.
 *
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` a ogni cron job;
 * lo stesso header vale per farlo partire a mano durante le prove.
 */

/** Confronto a tempo costante: un segreto non si confronta con `===`. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  // Lunghezze diverse: timingSafeEqual solleverebbe, e comunque non è lui.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isAuthorizedCron(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false
  if (!authHeader) return false

  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
  if (!match) return false

  return sameSecret(match[1], secret)
}

/**
 * Quanto tira dentro un'esecuzione automatica.
 *
 * Più basso del limite manuale, e per una ragione precisa: gira ogni
 * giorno, quindi la finestra da coprire è piccola, e una funzione
 * serverless ha un tetto di tempo che non conviene sfiorare. Se un
 * giorno arriva più roba del limite, il giro dopo la prende: la
 * finestra di sincronizzazione parte sempre dall'ultima riuscita, con
 * sei ore di sovrapposizione.
 */
export const CRON_LIMIT = 60

/** Nome con cui l'esecuzione automatica finisce nel registro. */
export const CRON_AGENT = 'cron:sync'
