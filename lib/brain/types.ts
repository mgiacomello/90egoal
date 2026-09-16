/**
 * BRAIN — tipi condivisi.
 *
 * Una sola forma per tutto quello che entra in memoria: da dove viene,
 * che cos'è, quando è successo. Tutto il resto del sistema lavora su
 * questa forma e non sa nulla di Gmail, di Drive o di Qonto.
 */

export const SOURCES = ['gmail', 'gcal', 'gdrive', 'qonto', 'oura', 'manual'] as const
export type SourceKey = (typeof SOURCES)[number]

export const KINDS = ['email', 'event', 'file', 'transaction', 'health', 'note'] as const
export type DocKind = (typeof KINDS)[number]

/** Il canale, in italiano, per come va mostrato accanto a una fonte. */
export const CHANNEL_LABEL: Record<SourceKey, string> = {
  gmail: 'Email',
  gcal: 'Calendario',
  gdrive: 'Drive',
  qonto: 'Conto',
  oura: 'Anello',
  manual: 'Nota',
}

/** Un documento normalizzato, prima di essere scritto in memoria. */
export type BrainDocument = {
  source: SourceKey
  kind: DocKind
  /** Id stabile nel sistema di origine: è la chiave dell'idempotenza. */
  externalId: string
  title: string
  body: string
  /** Quando è successo (non quando l'abbiamo letto). ISO 8601. */
  occurredAt: string
  url?: string | null
  participants?: string[]
  metadata?: Record<string, unknown>
}

export type StoredDocument = BrainDocument & {
  id: string
  ingestedAt: string
}

/** Un pezzo di documento restituito dalla ricerca full-text. */
export type SearchHit = {
  chunkId: number
  documentId: string
  idx: number
  content: string
  /** Punteggio grezzo di Postgres. Non è la parola finale. */
  rank: number
  source: SourceKey
  kind: DocKind
  title: string
  occurredAt: string
  url: string | null
  participants: string[]
}

export type RankedHit = SearchHit & { score: number }

/**
 * Una fonte offerta al modello. L'handle corto (F1, F2…) è l'unico
 * identificativo che il modello può citare: se cita altro, cade.
 */
export type SourceRef = {
  handle: string
  documentId: string
  source: SourceKey
  kind: DocKind
  title: string
  occurredAt: string
  url: string | null
  excerpt: string
}

/** Quello che il modello produce: testo + handle citati. Niente di più. */
export type RawClaim = { text: string; sources: string[] }

export type ClaimTrust = 'verified' | 'unchecked-detail'

export type VerifiedClaim = {
  text: string
  sources: SourceRef[]
  trust: ClaimTrust
  /** Dettagli (importi, IBAN, date…) che non compaiono nelle fonti citate. */
  unverified: string[]
}

export type GroundedAnswer = {
  claims: VerifiedClaim[]
  /** Affermazioni scartate perché prive di fonte valida. Restano visibili in debug. */
  dropped: RawClaim[]
  openQuestions: string[]
  model: string
  hits: number
}
