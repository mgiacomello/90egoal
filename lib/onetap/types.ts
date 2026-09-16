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
  /** Testo precompilato per EMAIL / TEXT / WHATSAPP. */
  draft?: Draft
  /** La nota pronta per NOTE: titolo e corpo riordinato. */
  note?: Note
}

export interface CalendarEvent {
  title: string
  /** ISO locale senza timezone, es. 2026-09-15T19:30:00 */
  start: string
  end: string
  location?: string
  /** Contesto da portare nell'evento: il testo da cui è nato. */
  notes?: string
  allDay?: boolean
}

export interface ContactCard {
  name?: string
  company?: string
  role?: string
  phone?: string
  email?: string
}

/** Una nota pronta da salvare: un titolo e il contenuto messo in ordine. */
export interface Note {
  title: string
  body: string
}

/** Testo già pronto per un'azione che scrive (email, SMS, WhatsApp). */
export interface Draft {
  subject?: string
  body: string
}

/**
 * Quello che il modello aggiunge oltre alla trascrizione: etichette e testi
 * pronti. Arricchisce l'azione scelta dal motore, non la sceglie: nessun
 * campo qui può introdurre un numero, un indirizzo o un'email che non siano
 * già nel testo letto.
 */
export interface Enrichment {
  /** Di cosa si tratta, in poche parole ("Fattura Studio Rossi 2026/114"). */
  title?: string
  /** date = YYYY-MM-DD, time = HH:MM. Valgono solo se giorno e ora compaiono nel testo. */
  event?: { title?: string; location?: string; notes?: string; date?: string; time?: string; durationMinutes?: number }
  contact?: { name?: string; company?: string; role?: string }
  emailDraft?: { subject?: string; body?: string }
  messageDraft?: string
  searchQuery?: string
  /** La nota riordinata: vale solo se ogni numero e quasi ogni parola stanno nel testo. */
  note?: { title?: string; body?: string }
}

export type Confidence = 'high' | 'medium' | 'low'

/** Il risultato completo di un'analisi: quello che la UI disegna. */
export interface Analysis {
  /** Testo sorgente (trascritto dall'immagine o inserito dall'utente). */
  text: string
  /** Di cosa si tratta, quando il modello l'ha capito ("Biglietto da visita di Giulia Neri"). */
  title?: string
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
  note?: Note
}
