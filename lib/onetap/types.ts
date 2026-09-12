// ONE TAP — tipi condivisi fra motore di detection, API e UI.
// Nessuna dipendenza da DOM o da Node: questo file gira ovunque.

export type ActionKind =
  | 'CALL'
  | 'TEXT'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'COPY'
  | 'OPEN'
  | 'NAVIGATE'
  | 'CALENDAR'
  | 'CONTACT'
  | 'SEARCH'
  | 'REPLY'
  | 'TRANSLATE'
  | 'SHARE'
  | 'NOTE'

export type EntityKind =
  | 'phone'
  | 'email'
  | 'iban'
  | 'url'
  | 'address'
  | 'datetime'
  | 'amount'
  | 'otp'
  | 'wifi'
  | 'message'
  | 'title'
  | 'person'

export type Lang = 'it' | 'en'

/** Un pezzo di informazione riconosciuto dentro al testo. */
export interface Entity {
  kind: EntityKind
  /** Valore normalizzato e pronto all'uso (es. +393331234567). */
  value: string
  /** Testo esatto così come appare nella sorgente. */
  raw: string
  start: number
  end: number
  /** Dati extra specifici del tipo (data ISO, titolo evento, ecc.). */
  meta?: Record<string, string | number | boolean>
}

/** Un'azione proponibile all'utente, con il suo punteggio. */
export interface SuggestedAction {
  kind: ActionKind
  /** Etichetta grande sul bottone (già in maiuscolo). */
  label: string
  /** Cosa viene mostrato come "Detected:". */
  subject: string
  /** Valore operativo (numero, url, indirizzo, testo da copiare...). */
  value: string
  score: number
  entity: Entity
  /** Testi già pronti per REPLY. */
  replies?: string[]
  /** Payload per CALENDAR / CONTACT. */
  event?: CalendarEvent
  contact?: ContactCard
}

export interface CalendarEvent {
  title: string
  /** ISO locale senza timezone, es. 2026-09-15T19:30:00 */
  start: string
  end: string
  location?: string
  allDay?: boolean
}

export interface ContactCard {
  name?: string
  phone?: string
  email?: string
}

export type Confidence = 'high' | 'medium' | 'low'

/** Il risultato completo di un'analisi: quello che la UI disegna. */
export interface Analysis {
  /** Testo sorgente (trascritto dall'immagine o inserito dall'utente). */
  text: string
  lang: Lang
  entities: Entity[]
  /** L'azione: quella del bottone ONE TAP. */
  primary: SuggestedAction | null
  /** Alternative discrete, sotto al bottone. */
  secondary: SuggestedAction[]
  confidence: Confidence
  /** Da dove arriva l'analisi. */
  source: 'text' | 'image' | 'demo' | 'qr' | 'share'
  /** True se la trascrizione è passata da un modello remoto. */
  usedAI: boolean
}

export interface HistoryItem {
  id: string
  at: number
  preview: string
  action: ActionKind
  label: string
  value: string
  /** Rieseguibile: si ricostruisce l'href al tap. */
  event?: CalendarEvent
  contact?: ContactCard
}
