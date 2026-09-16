import { BrainError } from '../errors'
import { readCredentials, writeCredentials } from '../memory'

/**
 * OAuth Google, una volta sola.
 *
 * Il prodotto è a utente singolo: non serve un flusso di autorizzazione
 * per ogni visitatore, serve che il proprietario dia il consenso una
 * volta e che il refresh token resti al sicuro lato server. Sta in
 * `brain_credentials`, tabella che dal browser non è raggiungibile.
 *
 * Niente SDK: tre endpoint REST e `fetch`. Una dipendenza in meno da
 * aggiornare, e il flusso resta leggibile per intero in questo file.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** Sola lettura, sempre. Nessuno di questi agenti deve poter scrivere. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

type GoogleCredentials = {
  refreshToken: string
  accessToken?: string
  /** Epoch ms di scadenza dell'access token. */
  expiresAt?: number
  email?: string
  scope?: string
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** Il cookie che lega la richiesta di andata alla risposta di ritorno. */
export const OAUTH_STATE_COOKIE = 'brain_oauth_state'

/**
 * L'origine con cui costruire la redirect_uri.
 *
 * Deve essere *identica* all'andata e al ritorno, altrimenti Google
 * rifiuta lo scambio. Dietro a un proxy l'origine della richiesta può
 * non essere quella pubblica: `BRAIN_APP_URL` è la via d'uscita.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.BRAIN_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return new URL(request.url).origin
}

export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/brain/connect/google/callback`
}

/** L'URL a cui mandare il proprietario per dare il consenso. */
export function authorizeUrl(origin: string, state: string): string {
  if (!googleConfigured()) {
    throw new BrainError('Google non configurato: servono GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.', 503)
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // `offline` + `consent` è l'unico modo per avere davvero un refresh token:
    // senza `consent` Google lo restituisce solo alla primissima autorizzazione,
    // e una riconnessione successiva resterebbe senza.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${params}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || data.error) {
    throw new BrainError(
      `Google ha rifiutato la richiesta di token: ${data.error_description ?? data.error ?? res.status}`,
      502
    )
  }
  return data
}

/** Scambia il codice del consenso con un refresh token e lo salva. */
export async function exchangeCode(origin: string, code: string): Promise<{ email: string | null }> {
  const tokens = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(origin),
    grant_type: 'authorization_code',
  })

  if (!tokens.refresh_token) {
    throw new BrainError(
      'Google non ha restituito un refresh token. Revoca l\'accesso da myaccount.google.com/permissions e riprova.',
      502
    )
  }

  let email: string | null = null
  if (tokens.access_token) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (res.ok) {
      const info = (await res.json()) as { email?: string }
      email = info.email ?? null
    }
  }

  await writeCredentials('google', {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
    scope: tokens.scope,
    email: email ?? undefined,
  } satisfies GoogleCredentials)

  return { email }
}

export async function googleConnection(): Promise<{ connected: boolean; email: string | null }> {
  if (!googleConfigured()) return { connected: false, email: null }
  try {
    const creds = await readCredentials<GoogleCredentials>('google')
    return { connected: Boolean(creds?.refreshToken), email: creds?.email ?? null }
  } catch {
    return { connected: false, email: null }
  }
}

/** Un access token valido, rinnovato se scaduto (con un minuto di margine). */
async function accessToken(): Promise<string> {
  const creds = await readCredentials<GoogleCredentials>('google')
  if (!creds?.refreshToken) {
    throw new BrainError('Google non collegato: apri /brain e premi "Collega Google".', 412)
  }
  if (creds.accessToken && creds.expiresAt && creds.expiresAt - 60_000 > Date.now()) {
    return creds.accessToken
  }

  const tokens = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  })
  if (!tokens.access_token) throw new BrainError('Google non ha restituito un access token.', 502)

  await writeCredentials('google', {
    ...creds,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  } satisfies GoogleCredentials)

  return tokens.access_token
}

/** Chiamata autenticata. Un 401 vale un solo secondo tentativo, con token nuovo. */
export async function googleFetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await accessToken()
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 && retry) {
    const creds = await readCredentials<GoogleCredentials>('google')
    if (creds) await writeCredentials('google', { ...creds, accessToken: undefined, expiresAt: undefined })
    return googleFetch(url, init, false)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new BrainError(`Google ha risposto ${res.status}: ${detail.slice(0, 300)}`, 502)
  }
  return res
}

export async function googleJson<T>(url: string): Promise<T> {
  const res = await googleFetch(url)
  return (await res.json()) as T
}

/** base64url → testo, con i caratteri che Gmail usa al posto di + e /. */
export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}
