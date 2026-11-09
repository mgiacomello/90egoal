import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_INVESTITORI, impronta } from '@/proxy'

// Riceve la password dal modulo di /investitori/accesso. Se è quella giusta, mette il
// cookie (30 giorni) e manda alla pagina; altrimenti torna al modulo con l'errore.
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const tentativo = String(form.get('password') ?? '').trim()
  const password = process.env.INVESTITORI_PASSWORD
  if (!password || !tentativo || tentativo !== password) {
    return NextResponse.redirect(new URL('/investitori/accesso?errore=1', request.url), 303)
  }
  const risposta = NextResponse.redirect(new URL('/investitori', request.url), 303)
  risposta.cookies.set(COOKIE_INVESTITORI, await impronta(password), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
  return risposta
}
