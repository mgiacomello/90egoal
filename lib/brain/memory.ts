import { createHash } from 'node:crypto'
import { brainDb } from './db'
import { BrainError } from './errors'
import { chunkDocument } from './chunk'
import type { BrainDocument, SearchHit, SourceKey, StoredDocument } from './types'

/**
 * La memoria: scrivere, cercare, sfogliare.
 *
 * Due regole che valgono per tutto il sistema:
 *  - un documento è identificato da (fonte, id esterno), quindi
 *    risincronizzare non duplica mai niente;
 *  - se il contenuto non è cambiato non si rifà il lavoro di
 *    spezzettamento, e la sincronizzazione dice quanti ne ha saltati.
 */

/** Chiave d'identità di un documento. JSON: nessun separatore può collidere. */
function keyOf(source: string, externalId: string): string {
  return JSON.stringify([source, externalId])
}

function hashOf(doc: BrainDocument): string {
  return createHash('sha1')
    .update(JSON.stringify([doc.title, doc.body, doc.occurredAt]))
    .digest('hex')
}

export type RememberResult = {
  stored: number
  skipped: number
  documentIds: string[]
}

export async function rememberDocuments(docs: BrainDocument[]): Promise<RememberResult> {
  if (!docs.length) return { stored: 0, skipped: 0, documentIds: [] }
  const db = brainDb()

  // Un solo documento per (fonte, id esterno) anche dentro al lotto:
  // l'ultimo arrivato vince, com'è giusto per un aggiornamento.
  const unique = new Map<string, BrainDocument>()
  for (const doc of docs) unique.set(keyOf(doc.source, doc.externalId), doc)
  const batch = [...unique.values()]

  // Cosa c'è già, e con quale impronta.
  const { data: existing, error: readErr } = await db
    .from('brain_documents')
    .select('id, source, external_id, metadata')
    .in('source', [...new Set(batch.map((d) => d.source))])
    .in('external_id', batch.map((d) => d.externalId))
  if (readErr) throw new BrainError(`Lettura memoria fallita: ${readErr.message}`)

  const known = new Map<string, string | null>()
  for (const row of existing ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    known.set(
      keyOf(String(row.source), String(row.external_id)),
      typeof meta.hash === 'string' ? meta.hash : null
    )
  }

  const changed: { doc: BrainDocument; hash: string }[] = []
  let skipped = 0
  for (const doc of batch) {
    const hash = hashOf(doc)
    if (known.get(keyOf(doc.source, doc.externalId)) === hash) {
      skipped++
      continue
    }
    changed.push({ doc, hash })
  }
  if (!changed.length) return { stored: 0, skipped, documentIds: [] }

  const rows = changed.map(({ doc, hash }) => ({
    source: doc.source,
    kind: doc.kind,
    external_id: doc.externalId,
    title: doc.title.slice(0, 500),
    body: doc.body,
    occurred_at: doc.occurredAt,
    url: doc.url ?? null,
    participants: doc.participants ?? [],
    metadata: { ...(doc.metadata ?? {}), hash },
  }))

  const { data: upserted, error: upsertErr } = await db
    .from('brain_documents')
    .upsert(rows, { onConflict: 'source,external_id' })
    .select('id, source, external_id')
  if (upsertErr) throw new BrainError(`Scrittura memoria fallita: ${upsertErr.message}`)

  const idByKey = new Map(
    (upserted ?? []).map((r) => [keyOf(String(r.source), String(r.external_id)), String(r.id)])
  )
  const documentIds = [...idByKey.values()]

  // I pezzi vecchi non servono più: il documento è cambiato.
  if (documentIds.length) {
    const { error: delErr } = await db.from('brain_chunks').delete().in('document_id', documentIds)
    if (delErr) throw new BrainError(`Pulizia pezzi fallita: ${delErr.message}`)
  }

  const chunkRows = changed.flatMap(({ doc }) => {
    const id = idByKey.get(keyOf(doc.source, doc.externalId))
    if (!id) return []
    return chunkDocument(doc.title, doc.body).map((c) => ({
      document_id: id,
      idx: c.idx,
      content: c.content,
    }))
  })

  // A lotti: un contratto lungo può fare parecchie righe.
  for (let i = 0; i < chunkRows.length; i += 200) {
    const { error } = await db.from('brain_chunks').insert(chunkRows.slice(i, i + 200))
    if (error) throw new BrainError(`Scrittura pezzi fallita: ${error.message}`)
  }

  return { stored: documentIds.length, skipped, documentIds }
}

export type SearchOptions = {
  limit?: number
  sources?: SourceKey[]
  since?: Date
}

export async function searchMemory(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
  const db = brainDb()
  const { data, error } = await db.rpc('brain_search', {
    q: query,
    max_hits: options.limit ?? 60,
    in_sources: options.sources?.length ? options.sources : null,
    since: options.since ? options.since.toISOString() : null,
  })
  if (error) throw new BrainError(`Ricerca fallita: ${error.message}`)

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    chunkId: Number(row.chunk_id),
    documentId: String(row.document_id),
    idx: Number(row.idx),
    content: String(row.content ?? ''),
    rank: Number(row.rank ?? 0),
    source: row.source as SourceKey,
    kind: row.kind as SearchHit['kind'],
    title: String(row.title ?? ''),
    occurredAt: String(row.occurred_at),
    url: (row.url as string | null) ?? null,
    participants: (row.participants as string[] | null) ?? [],
  }))
}

function toStored(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id),
    source: row.source as SourceKey,
    kind: row.kind as StoredDocument['kind'],
    externalId: String(row.external_id),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    occurredAt: String(row.occurred_at),
    url: (row.url as string | null) ?? null,
    participants: (row.participants as string[] | null) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ingestedAt: String(row.ingested_at),
  }
}

export async function recentDocuments(limit = 30, source?: SourceKey): Promise<StoredDocument[]> {
  const db = brainDb()
  let q = db
    .from('brain_documents')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200))
  if (source) q = q.eq('source', source)

  const { data, error } = await q
  if (error) throw new BrainError(`Lettura documenti fallita: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(toStored)
}

/** Un documento intero, corpo compreso: serve a chi deve analizzarlo. */
export async function documentById(id: string): Promise<StoredDocument | null> {
  const db = brainDb()
  const { data, error } = await db.from('brain_documents').select('*').eq('id', id).maybeSingle()
  if (error) throw new BrainError(`Lettura documento fallita: ${error.message}`)
  return data ? toStored(data as Record<string, unknown>) : null
}

export type MemoryStats = {
  total: number
  bySource: { source: SourceKey; count: number; latest: string | null }[]
}

export async function memoryStats(): Promise<MemoryStats> {
  const db = brainDb()
  const { data, error } = await db.from('brain_documents').select('source, occurred_at')
  if (error) throw new BrainError(`Conteggio memoria fallito: ${error.message}`)

  const agg = new Map<SourceKey, { count: number; latest: string | null }>()
  for (const row of data ?? []) {
    const source = row.source as SourceKey
    const entry = agg.get(source) ?? { count: 0, latest: null }
    entry.count++
    const at = String(row.occurred_at)
    if (!entry.latest || at > entry.latest) entry.latest = at
    agg.set(source, entry)
  }

  return {
    total: data?.length ?? 0,
    bySource: [...agg.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.count - a.count),
  }
}

export async function forgetDocument(id: string): Promise<void> {
  const db = brainDb()
  const { error } = await db.from('brain_documents').delete().eq('id', id)
  if (error) throw new BrainError(`Cancellazione fallita: ${error.message}`)
}

/* --- credenziali dei connettori: token OAuth e cursori di sincronizzazione --- */

export async function readCredentials<T extends Record<string, unknown>>(
  connector: string
): Promise<T | null> {
  const db = brainDb()
  const { data, error } = await db
    .from('brain_credentials')
    .select('data')
    .eq('connector', connector)
    .maybeSingle()
  if (error) throw new BrainError(`Lettura credenziali fallita: ${error.message}`)
  return (data?.data as T) ?? null
}

export async function writeCredentials(
  connector: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = brainDb()
  const { error } = await db
    .from('brain_credentials')
    .upsert({ connector, data, updated_at: new Date().toISOString() }, { onConflict: 'connector' })
  if (error) throw new BrainError(`Scrittura credenziali fallita: ${error.message}`)
}

export async function markSynced(connector: string): Promise<void> {
  const db = brainDb()
  const current = (await readCredentials(connector)) ?? {}
  await db.from('brain_credentials').upsert(
    {
      connector,
      data: current,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connector' }
  )
}

export async function lastSyncedAt(connector: string): Promise<string | null> {
  const db = brainDb()
  const { data } = await db
    .from('brain_credentials')
    .select('synced_at')
    .eq('connector', connector)
    .maybeSingle()
  return (data?.synced_at as string | null) ?? null
}

export type RunRecord = {
  agent: string
  question: string
  answer: unknown
  model: string | null
  hits: number
  latencyMs: number | null
  createdAt: string
}

/** L'ultima esecuzione di un agente. Serve alla console per dire "quando". */
export async function lastRun(agent: string): Promise<RunRecord | null> {
  const db = brainDb()
  const { data, error } = await db
    .from('brain_runs')
    .select('*')
    .eq('agent', agent)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new BrainError(`Lettura registro fallita: ${error.message}`)
  if (!data) return null

  return {
    agent: String(data.agent),
    question: String(data.question ?? ''),
    answer: data.answer,
    model: (data.model as string | null) ?? null,
    hits: Number(data.hits ?? 0),
    latencyMs: (data.latency_ms as number | null) ?? null,
    createdAt: String(data.created_at),
  }
}

/* --- punti aperti --- */

export type OpenPoint = {
  id: string
  text: string
  fingerprint: string
  citations: SourceRefLike[]
  openedAt: string
  lastSeenAt: string
  closedAt: string | null
}

/** La forma minima di una fonte che vale la pena conservare accanto a un punto. */
export type SourceRefLike = {
  source: SourceKey
  title: string
  occurredAt: string
  url: string | null
}

function toOpenPoint(row: Record<string, unknown>): OpenPoint {
  return {
    id: String(row.id),
    text: String(row.text ?? ''),
    fingerprint: String(row.fingerprint ?? ''),
    citations: (row.citations as SourceRefLike[]) ?? [],
    openedAt: String(row.opened_at),
    lastSeenAt: String(row.last_seen_at),
    closedAt: (row.closed_at as string | null) ?? null,
  }
}

export async function listOpenPoints(includeClosed = false): Promise<OpenPoint[]> {
  const db = brainDb()
  let q = db.from('brain_open_points').select('*').order('opened_at', { ascending: true })
  if (!includeClosed) q = q.is('closed_at', null)

  const { data, error } = await q
  if (error) throw new BrainError(`Lettura punti aperti fallita: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(toOpenPoint)
}

export async function openPoint(entry: {
  text: string
  fingerprint: string
  citations: SourceRefLike[]
}): Promise<void> {
  const db = brainDb()
  // `ignoreDuplicates`: se l'impronta c'è già, il punto è lo stesso e
  // non va né duplicato né riscritto — la sua data di apertura è la
  // cosa che vogliamo conservare.
  const { error } = await db
    .from('brain_open_points')
    .upsert(
      { text: entry.text, fingerprint: entry.fingerprint, citations: entry.citations },
      { onConflict: 'fingerprint', ignoreDuplicates: true }
    )
  if (error) throw new BrainError(`Apertura punto fallita: ${error.message}`)
}

/** Il punto è stato rinominato oggi: aggiorna quando l'abbiamo visto l'ultima volta. */
export async function touchPoint(id: string): Promise<void> {
  const db = brainDb()
  await db.from('brain_open_points').update({ last_seen_at: new Date().toISOString() }).eq('id', id)
}

export async function closePoint(id: string, note?: string): Promise<void> {
  const db = brainDb()
  const { error } = await db
    .from('brain_open_points')
    .update({ closed_at: new Date().toISOString(), closed_note: note ?? null })
    .eq('id', id)
  if (error) throw new BrainError(`Chiusura punto fallita: ${error.message}`)
}

export async function reopenPoint(id: string): Promise<void> {
  const db = brainDb()
  const { error } = await db
    .from('brain_open_points')
    .update({ closed_at: null, closed_note: null })
    .eq('id', id)
  if (error) throw new BrainError(`Riapertura punto fallita: ${error.message}`)
}

export async function logRun(entry: {
  agent: string
  question: string
  answer: unknown
  model: string | null
  hits: number
  latencyMs: number
}): Promise<void> {
  try {
    const db = brainDb()
    await db.from('brain_runs').insert({
      agent: entry.agent,
      question: entry.question,
      answer: entry.answer as Record<string, unknown>,
      model: entry.model,
      hits: entry.hits,
      latency_ms: entry.latencyMs,
    })
  } catch {
    // Il registro è utile, non essenziale: non deve far fallire una risposta.
  }
}
