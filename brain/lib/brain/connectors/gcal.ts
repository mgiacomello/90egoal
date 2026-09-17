import type { BrainDocument } from '../types'
import { googleConfigured, googleConnection, googleJson } from './google'
import { clip, htmlToText, type Connector, type SyncWindow } from './types'

/**
 * Calendario.
 *
 * Unico connettore che guarda anche avanti: per un capo di gabinetto
 * la riunione di dopodomani conta più di quella del mese scorso, e
 * "cosa ho in settimana" è la domanda che si fa più spesso.
 */

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** Quanto avanti si guarda, in giorni. */
const LOOKAHEAD_DAYS = 60

type GoogleEvent = {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string }
  organizer?: { email?: string; displayName?: string }
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
}

function startIso(event: GoogleEvent): string | null {
  const raw = event.start?.dateTime ?? event.start?.date
  if (!raw) return null
  const d = new Date(event.start?.dateTime ? raw : `${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function when(event: GoogleEvent): string {
  const from = event.start?.dateTime ?? event.start?.date ?? ''
  const to = event.end?.dateTime ?? event.end?.date ?? ''
  return to ? `${from} → ${to}` : from
}

function people(event: GoogleEvent): string[] {
  const out = new Set<string>()
  if (event.organizer?.email) out.add(event.organizer.email.toLowerCase())
  for (const a of event.attendees ?? []) if (a.email) out.add(a.email.toLowerCase())
  return [...out]
}

function toDocument(event: GoogleEvent): BrainDocument | null {
  if (event.status === 'cancelled') return null
  const occurredAt = startIso(event)
  if (!occurredAt) return null

  const title = event.summary?.trim() || '(evento senza titolo)'
  const attendees = (event.attendees ?? [])
    .map((a) => `${a.displayName ?? a.email ?? '?'}${a.responseStatus ? ` (${a.responseStatus})` : ''}`)
    .join(', ')

  const lines = [
    `Quando: ${when(event)}`,
    event.location ? `Dove: ${event.location}` : '',
    event.hangoutLink ? `Call: ${event.hangoutLink}` : '',
    event.organizer?.email ? `Organizza: ${event.organizer.displayName ?? event.organizer.email}` : '',
    attendees ? `Partecipanti: ${attendees}` : '',
    event.description ? `\n${htmlToText(event.description)}` : '',
  ].filter(Boolean)

  return {
    source: 'gcal',
    kind: 'event',
    externalId: event.id,
    title,
    body: clip(lines.join('\n')),
    occurredAt,
    url: event.htmlLink ?? null,
    participants: people(event),
    metadata: { location: event.location, hangoutLink: event.hangoutLink },
  }
}

export const calendarConnector: Connector = {
  key: 'gcal',
  label: 'Google Calendar',
  hint: 'OAuth Google in sola lettura. Legge il calendario principale, passato e prossimi 60 giorni.',
  configured: googleConfigured,
  connected: async () => (await googleConnection()).connected,

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    const timeMax = new Date(Date.now() + LOOKAHEAD_DAYS * 86_400_000)
    const params = new URLSearchParams({
      timeMin: since.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true', // le ricorrenze vanno espanse: un evento, una data
      orderBy: 'startTime',
      maxResults: String(Math.min(limit, 250)),
    })

    const data = await googleJson<{ items?: GoogleEvent[] }>(`${API}?${params}`)
    return (data.items ?? []).map(toDocument).filter((d): d is BrainDocument => d !== null)
  },
}
