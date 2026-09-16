// ONE TAP — dall'azione suggerita al gesto reale del telefono.
//
// Principio: quando esiste un href, il bottone ONE TAP È un <a>. Niente JS in
// mezzo significa niente popup bloccati e nessun ritardo fra il dito e l'app
// che si apre. Il codice qui sotto serve solo a costruire quell'href.

import type { ActionKind, CalendarEvent, ContactCard, Note, SuggestedAction } from './types'

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/* ------------------------------------------------------------------ *
 * Costruzione degli href
 * ------------------------------------------------------------------ */

export function mapsHref(destination: string, platform: Platform): string {
  const q = encodeURIComponent(destination)
  // Apple Maps su iOS, Google Maps altrove: in entrambi i casi è l'app nativa.
  if (platform === 'ios') return `https://maps.apple.com/?daddr=${q}`
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`
}

export function searchHref(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function translateHref(text: string, to: string): string {
  return `https://translate.google.com/?sl=auto&tl=${to}&text=${encodeURIComponent(text.slice(0, 1500))}&op=translate`
}

/** Il testo della nota come arriva in Note, Keep o in un file: titolo, riga vuota, corpo. */
export function noteText(note: Note): string {
  return `${note.title}\n\n${note.body}`.trim()
}

/** La nota nella propria casella di posta: un'altra strada per tenerla, su ogni telefono. */
export function noteMailHref(note: Note): string {
  const query = new URLSearchParams({ subject: note.title, body: note.body }).toString().replace(/\+/g, '%20')
  return `mailto:?${query}`
}

export function googleCalendarHref(event: CalendarEvent): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(event.start)}/${fmt(event.end)}`,
  })
  if (event.location) params.set('location', event.location)
  if (event.notes) params.set('details', event.notes)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Href principale dell'azione. `null` = l'azione non apre nulla (es. COPY):
 * in quel caso la UI usa un <button> e `runAction`.
 */
export function actionHref(action: SuggestedAction, platform: Platform, lang: string): string | null {
  const body = action.draft?.body
  switch (action.kind) {
    case 'CALL':
      return `tel:${action.value}`
    case 'TEXT':
      // iOS vuole "&body", Android "?body": stesso testo, due grammatiche.
      if (!body) return `sms:${action.value}`
      return `sms:${action.value}${platform === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`
    case 'WHATSAPP':
      return `https://wa.me/${action.value.replace(/\D/g, '')}${body ? `?text=${encodeURIComponent(body)}` : ''}`
    case 'EMAIL': {
      const params = new URLSearchParams()
      if (action.draft?.subject) params.set('subject', action.draft.subject)
      if (body) params.set('body', body)
      // URLSearchParams codifica gli spazi come "+", che i client di posta
      // mostrano letteralmente: qui servono i %20.
      const query = params.toString().replace(/\+/g, '%20')
      return `mailto:${action.value}${query ? `?${query}` : ''}`
    }
    case 'OPEN':
      return action.value
    case 'NAVIGATE':
      return mapsHref(action.value, platform)
    case 'SEARCH':
      return searchHref(action.value)
    case 'TRANSLATE':
      return translateHref(action.value, lang === 'it' ? 'it' : 'en')
    case 'CALENDAR':
      // Su iPhone il file .ics apre il foglio nativo "Aggiungi al calendario";
      // ovunque altro un .ics finisce nei download, mentre il link di Google
      // Calendar apre l'app con l'evento già compilato. Un tap in entrambi i casi.
      return platform === 'ios' || !action.event ? null : googleCalendarHref(action.event)
    case 'CONTACT':
    case 'COPY':
    case 'REPLY':
    case 'SHARE':
    case 'NOTE':
      return null
  }
}

/** Gli href verso app native non devono aprire una scheda vuota. */
export function opensInNewTab(kind: ActionKind): boolean {
  return kind === 'OPEN' || kind === 'NAVIGATE' || kind === 'SEARCH' || kind === 'TRANSLATE' || kind === 'WHATSAPP' || kind === 'CALENDAR'
}

/* ------------------------------------------------------------------ *
 * File generati al volo (calendario e rubrica)
 * ------------------------------------------------------------------ */

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcs(event: CalendarEvent): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const local = (iso: string) => iso.replace(/[-:]/g, '')
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@onetap`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ONE TAP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(event.start)}`,
    `DTEND:${local(event.end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.location ? `LOCATION:${icsEscape(event.location)}` : '',
    event.notes ? `DESCRIPTION:${icsEscape(event.notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export function buildVcf(contact: ContactCard): string {
  const name = contact.name?.trim() || contact.phone || contact.email || 'ONE TAP'
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${icsEscape(name)}`,
    contact.company ? `ORG:${icsEscape(contact.company)}` : '',
    contact.role ? `TITLE:${icsEscape(contact.role)}` : '',
    contact.phone ? `TEL;TYPE=CELL:${contact.phone}` : '',
    contact.email ? `EMAIL:${contact.email}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n')
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/* ------------------------------------------------------------------ *
 * Esecuzione
 * ------------------------------------------------------------------ */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Safari nega la clipboard fuori da un gesto utente: si ripiega su execCommand.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export interface ActionResult {
  ok: boolean
  /** Messaggio breve di conferma, già nella lingua giusta. */
  message: string
}

const DONE = {
  it: {
    copied: 'Copiato.',
    calendar: 'Evento pronto: apri il file per salvarlo.',
    contact: 'Contatto pronto: apri il file per salvarlo.',
    shared: 'Condiviso.',
    noted: 'Nota salvata.',
    notedFile: 'Nota scaricata come file di testo e copiata.',
    notedFileOnly: 'Nota scaricata come file di testo.',
    failed: 'Non è riuscito. Riprova.',
  },
  en: {
    copied: 'Copied.',
    calendar: 'Event ready — open the file to save it.',
    contact: 'Contact ready — open the file to save it.',
    shared: 'Shared.',
    noted: 'Note saved.',
    notedFile: 'Note downloaded as a text file and copied.',
    notedFileOnly: 'Note downloaded as a text file.',
    failed: "That didn't work. Try again.",
  },
} as const

/** Esegue le azioni che non sono un semplice link. */
export async function runAction(action: SuggestedAction, lang: 'it' | 'en'): Promise<ActionResult> {
  const t = DONE[lang]
  switch (action.kind) {
    case 'COPY': {
      const ok = await copyText(action.value)
      return { ok, message: ok ? t.copied : t.failed }
    }
    case 'REPLY': {
      const ok = await copyText(action.value)
      return { ok, message: ok ? t.copied : t.failed }
    }
    case 'CALENDAR': {
      if (!action.event) return { ok: false, message: t.failed }
      downloadFile(buildIcs(action.event), `${slug(action.event.title)}.ics`, 'text/calendar')
      return { ok: true, message: t.calendar }
    }
    case 'CONTACT': {
      if (!action.contact) return { ok: false, message: t.failed }
      downloadFile(buildVcf(action.contact), `${slug(action.contact.name ?? 'contact')}.vcf`, 'text/vcard')
      return { ok: true, message: t.contact }
    }
    case 'NOTE': {
      // Su un telefono la strada vera per "salvare una nota" è il menu di
      // sistema: da lì titolo e testo entrano in Note, Keep, Promemoria, dove
      // vuole l'utente. Su un computer la nota diventa un file di testo, e in
      // ogni caso resta negli appunti.
      const note = action.note ?? { title: action.subject, body: action.value }
      const text = noteText(note)
      if (navigator.share) {
        try {
          await navigator.share({ title: note.title, text })
          return { ok: true, message: t.noted }
        } catch {
          // annullato: la copia sotto è comunque un salvataggio utile
        }
        const ok = await copyText(text)
        return { ok, message: ok ? t.copied : t.failed }
      }
      const ok = await copyText(text)
      downloadFile(text, `${slug(note.title)}.txt`, 'text/plain')
      return { ok: true, message: ok ? t.notedFile : t.notedFileOnly }
    }
    case 'SHARE': {
      if (navigator.share) {
        try {
          await navigator.share({ text: action.value })
          return { ok: true, message: t.shared }
        } catch {
          return { ok: false, message: t.failed }
        }
      }
      const ok = await copyText(action.value)
      return { ok, message: ok ? t.copied : t.failed }
    }
    default:
      return { ok: false, message: t.failed }
  }
}

/**
 * Una risposta scelta: si tenta la condivisione nativa (che porta dritti dentro
 * WhatsApp o Messaggi) e in subordine si copia. L'utente non digita mai nulla.
 */
export async function sendReply(reply: string, lang: 'it' | 'en', phone?: string): Promise<ActionResult> {
  const t = DONE[lang]
  if (phone && phone.startsWith('+')) {
    window.location.href = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(reply)}`
    return { ok: true, message: lang === 'it' ? 'Aperto in WhatsApp.' : 'Opened in WhatsApp.' }
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: reply })
      return { ok: true, message: t.shared }
    } catch {
      // L'utente ha annullato: la copia resta comunque utile.
    }
  }
  const ok = await copyText(reply)
  return { ok, message: ok ? t.copied : t.failed }
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'onetap'
  )
}
