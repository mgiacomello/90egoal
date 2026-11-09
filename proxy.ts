import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// La pagina per gli investitori sta dietro una password unica (INVESTITORI_PASSWORD su
// Vercel). Chi la inserisce riceve un cookie con l'impronta della password: niente
// account, niente database. Senza variabile impostata la pagina resta chiusa.
export async function impronta(password: string): Promise<string> {
  const dati = new TextEncoder().encode(`${password}|90egoal-investitori`)
  const hash = await crypto.subtle.digest('SHA-256', dati)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
export const COOKIE_INVESTITORI = 'investitori'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/investitori') && !pathname.startsWith('/investitori/accesso')) {
    const password = process.env.INVESTITORI_PASSWORD
    const cookie = request.cookies.get(COOKIE_INVESTITORI)?.value
    const ok = !!password && !!cookie && cookie === await impronta(password)
    if (!ok) return NextResponse.redirect(new URL('/investitori/accesso', request.url))
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /auth/reset va raggiunta anche da loggati: il link di recupero crea una sessione
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
    && !request.nextUrl.pathname.startsWith('/auth/reset')
  const isProtected = ['/schedine', '/classifica', '/admin', '/profilo'].some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
