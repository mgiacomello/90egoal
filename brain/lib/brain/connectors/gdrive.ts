import type { BrainDocument } from '../types'
import { MAX_PDF_BYTES, extractPdfText, noteFor } from '../pdf'
import { googleConfigured, googleConnection, googleFetch, googleJson } from './google'
import { clip, mapLimit, type Connector, type SyncWindow } from './types'

/**
 * Drive: la parte pesante della memoria (contratti, delibere, note).
 *
 * Google Docs, Fogli e Presentazioni si esportano in testo con una
 * chiamata sola. I PDF si leggono con `lib/brain/pdf.ts`, ma solo
 * quelli che un livello di testo ce l'hanno davvero: un PDF
 * scansionato è un'immagine, e metterne in memoria le quattro righe di
 * intestazione sarebbe peggio che saltarlo — il documento sembrerebbe
 * letto e un agente lo citerebbe come fonte. In quel caso in memoria
 * finisce il titolo più una riga che dice perché il testo non c'è.
 *
 * Gli altri binari restano al titolo, e lo dichiarano allo stesso modo.
 */

const API = 'https://www.googleapis.com/drive/v3/files'

/** Tetto ai byte di un singolo file letto da Drive: un contratto sta comodo. */
const MAX_EXPORT_BYTES = 400_000

/**
 * Tetto al testo che entra in memoria per un file di Drive.
 *
 * Volutamente molto più alto del default di `clip()`: Drive è la fonte
 * dei documenti lunghi, e un contratto tagliato a ventimila caratteri
 * è un contratto letto per un terzo — con l'aggravante che l'agente
 * Contratti non se ne accorgerebbe, perché il testo che riceve finisce
 * lì e sembra completo.
 */
const MAX_DRIVE_CHARS = 200_000

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

  if (mime === 'application/pdf') {
    // Il controllo sulla dimensione prima di scaricare: inutile tirare
    // giù venti megabyte per poi rifiutarli.
    if (Number(file.size ?? 0) > MAX_PDF_BYTES) return noteFor('too-large')

    const res = await googleFetch(`${API}/${file.id}?alt=media`)
    const extraction = await extractPdfText(new Uint8Array(await res.arrayBuffer()))
    return extraction.quality === 'ok' ? extraction.text : extraction.note
  }

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
  hint: 'OAuth Google in sola lettura. Documenti, Fogli, Presentazioni e PDF con livello di testo; le scansioni restano al titolo.',
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
        body: clip(body, MAX_DRIVE_CHARS),
        occurredAt: file.modifiedTime ?? new Date().toISOString(),
        url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        participants: people(file),
        metadata: { mimeType: file.mimeType },
      } satisfies BrainDocument
    })
  },
}
