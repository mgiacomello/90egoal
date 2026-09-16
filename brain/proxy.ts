import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * La porta esterna.
 *
 * Qui dentro non c'è niente di pubblico: è la memoria di lavoro di una
 * persona sola. Quindi il criterio è rovesciato rispetto a un sito
 * normale — **tutto è protetto tranne quello che serve per entrare**,
 * invece di proteggere un elenco di rotte e lasciare aperto il resto.
 * Una rotta nuova nasce chiusa, e non c'è modo di dimenticarsi di
 * aggiungerla a una lista.
 *
 * Il cron è l'unica eccezione, e si difende da sé con il suo segreto:
 * quando passa non c'è nessuno loggato, c'è uno scheduler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lo scheduler non ha una sessione: il suo controllo è il segreto condiviso.
  if (pathname.startsWith('/api/brain/cron')) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (pathname.startsWith('/login')) {
    return user ? NextResponse.redirect(new URL('/', request.url)) : response
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
