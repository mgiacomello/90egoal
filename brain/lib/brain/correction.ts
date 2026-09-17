/**
 * Le correzioni. Funzione pura: niente rete, niente DOM.
 *
 * È il pezzo che trasforma la memoria da archivio in *qualcosa di tuo*.
 * Fino a qui si poteva chiudere un punto o cancellare un documento:
 * due modi di togliere. Nessuno di dire **"questo è sbagliato, la cosa
 * giusta è quest'altra"** — e un secondo cervello che non accetta
 * correzioni non diventa mai tuo, perché l'unico rimedio a un errore è
 * ricordartelo da solo, che è esattamente il lavoro che doveva fare lui.
 *
 * La scelta di forma, che è dove sta il valore: **una correzione non è
 * una tabella a parte, è un documento in memoria.** Quindi viene
 * cercata, ordinata e *citata* come qualunque altra fonte. Quando una
 * risposta è corretta, la fonte che compare sotto la frase sei tu, con
 * la data in cui l'hai detto. Niente magie invisibili, niente regole
 * nascoste: la correzione si vede, e si può a sua volta correggere.
 *
 * Due proprietà che ne discendono, e sono entrambe volute:
 *
 *  1. una correzione **pesa più di ogni altra fonte** nel ranking
 *     (`KIND_WEIGHT` in `rank.ts`), anche di un documento più recente;
 *  2. la precedenza è scritta **dentro al corpo del documento**, non
 *     solo nel prompt di sistema. Così viaggia con la fonte: qualunque
 *     agente la peschi, la legge insieme al contenuto, senza che
 *     nessuno debba ricordarsi di aggiungere una regola.
 */

export type CorrectionInput = {
  /** Quello che il sistema aveva detto. Facoltativo: a volte vuoi solo aggiungere il vero. */
  wrong?: string
  /** Quello che è corretto. Obbligatorio: è l'unica cosa che serve davvero. */
  right: string
  /** Di cosa si parla, se il testo non basta a capirlo fra sei mesi. */
  about?: string
}

const MAX_FIELD = 2000
const MIN_RIGHT = 3

export type Validation = { ok: true; value: Required<CorrectionInput> } | { ok: false; reason: string }

export function validateCorrection(input: CorrectionInput): Validation {
  const right = String(input.right ?? '').trim()
  const wrong = String(input.wrong ?? '').trim()
  const about = String(input.about ?? '').trim()

  if (right.length < MIN_RIGHT) {
    return { ok: false, reason: 'Scrivi qual è la cosa giusta: è l\'unica parte davvero necessaria.' }
  }
  if (right.length > MAX_FIELD || wrong.length > MAX_FIELD || about.length > MAX_FIELD) {
    return { ok: false, reason: `Una correzione sta in ${MAX_FIELD} caratteri per campo.` }
  }
  if (wrong && wrong === right) {
    return { ok: false, reason: 'Il testo sbagliato e quello corretto sono identici.' }
  }

  return { ok: true, value: { right, wrong, about } }
}

/** Il titolo, che è quello che si legge nell'elenco della memoria. */
export function correctionTitle(value: Required<CorrectionInput>): string {
  const subject = value.about || value.right
  const short = subject.length > 90 ? subject.slice(0, 90).trimEnd() + '…' : subject
  return `Correzione — ${short}`
}

/**
 * Il corpo del documento.
 *
 * Deve essere **autosufficiente**: quando finisce fra le fonti di una
 * risposta, l'agente lo legge da solo, senza il documento che corregge
 * accanto. Per questo ripete il contesto invece di rimandarci.
 *
 * L'ultima riga non è decorazione: è la regola di precedenza che
 * viaggia insieme al dato. Un prompt si può dimenticare di dirla; un
 * documento che la contiene, no.
 */
export function correctionBody(value: Required<CorrectionInput>, at: Date): string {
  const when = `${String(at.getUTCDate()).padStart(2, '0')}/${String(at.getUTCMonth() + 1).padStart(2, '0')}/${at.getUTCFullYear()}`

  return [
    `CORREZIONE registrata dal titolare della memoria il ${when}.`,
    value.about ? `\nRiguarda: ${value.about}` : '',
    value.wrong ? `\nQuello che risultava (SBAGLIATO): ${value.wrong}` : '',
    `\nQuello che è corretto: ${value.right}`,
    '\nQuesta correzione viene dal titolare della memoria e ha la precedenza su qualunque altra fonte sullo stesso punto, anche se più recente. Se una fonte la contraddice, vale questa, e la contraddizione va segnalata.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * La chiave d'identità.
 *
 * Deterministica sul contenuto: reinviare la stessa correzione due
 * volte non ne crea due. Ma **non** normalizza il testo oltre gli
 * spazi — due correzioni che dicono quasi la stessa cosa restano due
 * documenti, ed è giusto: in una correzione una parola diversa può
 * essere tutto il punto.
 */
export function correctionKey(value: Required<CorrectionInput>): string {
  return JSON.stringify([
    value.about.replace(/\s+/g, ' '),
    value.wrong.replace(/\s+/g, ' '),
    value.right.replace(/\s+/g, ' '),
  ])
}
