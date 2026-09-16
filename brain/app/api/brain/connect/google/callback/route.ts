import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/brain/auth'
import { toBrainError } from '@/lib/brain/errors'
import { OAUTH_STATE_COOKIE, appOrigin, exchangeCode } from '@/lib/brain/connectors/google'

export const runtime = 'nodejs'

/** Il ritorno da Google: si scambia il codice e si torna alla console. */
export async function GET(request: Request) {
  const origin = appOrigin(request)
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(`${origin}/?${new URLSearchParams(params)}`, 302)

  try {
    await requireOwner()

    const url = new URL(request.url)
    const denied = url.searchParams.get('error')
    if (denied) return back({ google: 'ko', motivo: denied })

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const expected = request.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
      ?.slice(OAUTH_STATE_COOKIE.length + 1)

    if (!code) return back({ google: 'ko', motivo: 'codice mancante' })
    if (!state || !expected || state !== expected) {
      return back({ google: 'ko', motivo: 'stato non corrispondente' })
    }

    const { email } = await exchangeCode(origin, code)

    const response = back({ google: 'ok', ...(email ? { account: email } : {}) })
    response.cookies.delete(OAUTH_STATE_COOKIE)
    return response
  } catch (err) {
    const e = toBrainError(err, 'Collegamento non riuscito.')
    return back({ google: 'ko', motivo: e.message })
  }
}
