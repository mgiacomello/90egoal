import type { BrainDocument } from '../types'
import { googleConfigured, googleConnection, googleFetch, googleJson } from './google'
import { clip, mapLimit, type Connector, type SyncWindow } from './types'

/**
 * Drive: la parte pesante della memoria (contratti, delibere, note).
 *
 * Google Docs, Fogli e Presentazioni si esportano in testo con una
 * chiamata sola. PDF e file binari entrano in memoria **solo con il
 * titolo**: estrarne il testo è un lavoro a sé (OCR, layout, tabelle)
 * e va fatto bene o non fatto — meglio un limite dichiarato che un
 * corpo mezzo sbagliato dentro a una risposta con la fonte accanto.
 */

const API = 'https://www.googleapis.com/drive/v3/files'

/** Tetto ai byte di un singolo file esportato: un contratto sta comodo. */
const MAX_EXPORT_BYTES = 400_000

type DriveFile = {
  id: string
  name?: string
  mimeType?: string
  modifiedTime?: string
  webViewLink?: string
  size?: string
  owners?: { emailAddress?: string }[]
  lastModifyingUser?: { emailAddress?: string }
}

/** Google Workspace → formato di esportazione testuale. */
const EXPORT_AS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

/** File di testo già leggibili così come sono. */
const PLAIN_TEXT = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json'])

async function bodyOf(file: DriveFile): Promise<string> {
  const mime = file.mimeType ?? ''

  const exportAs = EXPORT_AS[mime]
  if (exportAs) {
    const res = await googleFetch(
      `${API}/${file.id}/export?mimeType=${encodeURIComponent(exportAs)}`
    )
    return (await res.text()).slice(0, MAX_EXPORT_BYTES)
  }

  if (PLAIN_TEXT.has(mime) && Number(file.size ?? 0) <= MAX_EXPORT_BYTES) {
    const res = await googleFetch(`${API}/${file.id}?alt=media`)
    return (await res.text()).slice(0, MAX_EXPORT_BYTES)
  }

  // Limite dichiarato, non silenzioso: la riga finisce dentro al documento.
  return `[Contenuto non estratto: ${mime || 'tipo sconosciuto'}. In memoria c'è solo il titolo.]`
}

function people(file: DriveFile): string[] {
  const out = new Set<string>()
  for (const o of file.owners ?? []) if (o.emailAddress) out.add(o.emailAddress.toLowerCase())
  if (file.lastModifyingUser?.emailAddress) out.add(file.lastModifyingUser.emailAddress.toLowerCase())
  return [...out]
}

export const driveConnector: Connector = {
  key: 'gdrive',
  label: 'Google Drive',
  hint: 'OAuth Google in sola lettura. Documenti, Fogli e Presentazioni in testo; PDF solo per titolo.',
  configured: googleConfigured,
  connected: async () => (await googleConnection()).connected,

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    const params = new URLSearchParams({
      q: `modifiedTime > '${since.toISOString()}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size,owners(emailAddress),lastModifyingUser(emailAddress))',
      orderBy: 'modifiedTime desc',
      pageSize: String(Math.min(limit, 100)),
    })

    const data = await googleJson<{ files?: DriveFile[] }>(`${API}?${params}`)
    const files = data.files ?? []
    if (!files.length) return []

    return mapLimit(files, 4, async (file) => {
      let body: string
      try {
        body = await bodyOf(file)
      } catch (err) {
        // Un file che non si legge non deve far saltare l'intera sincronizzazione.
        body = `[Contenuto non leggibile: ${(err as Error).message}]`
      }
      return {
        source: 'gdrive',
        kind: 'file',
        externalId: file.id,
        title: file.name ?? '(file senza nome)',
        body: clip(body),
        occurredAt: file.modifiedTime ?? new Date().toISOString(),
        url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        participants: people(file),
        metadata: { mimeType: file.mimeType },
      } satisfies BrainDocument
    })
  },
}
