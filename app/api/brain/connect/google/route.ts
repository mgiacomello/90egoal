import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { OAUTH_STATE_COOKIE, appOrigin, authorizeUrl } from '@/lib/brain/connectors/google'

export const runtime = 'nodejs'

/** Manda il proprietario a dare il consenso a Google. */
export async function GET(request: Request) {
  try {
    await requireOwner()

    // Lo stato lega la richiesta di andata alla risposta di ritorno:
    // senza, chiunque potrebbe far arrivare un codice a questa callback.
    const state = randomUUID()
    const response = NextResponse.redirect(authorizeUrl(appOrigin(request), state), 302)
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })
    return response
  } catch (err) {
    const e = toBrainError(err, 'Non sono riuscito ad avviare il collegamento.')
    return Response.json({ error: e.message }, { status: e.status })
  }
}
