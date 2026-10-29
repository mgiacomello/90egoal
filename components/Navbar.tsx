'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { IconBall, IconTicket, IconTrophy, IconUser } from '@/components/Icons'

// Si gioca coi pollici: quattro sezioni in una barra in basso, sempre, anche
// su computer. In alto solo il marchio e (per chi amministra) il pannello.
// Le regole stanno dentro Oggi e Profilo: non meritano un posto sotto al pollice.
const TABS = [
  { href: '/', label: 'Oggi', Icon: IconBall, exact: true },
  { href: '/schedine', label: 'Schedine', Icon: IconTicket },
  { href: '/classifica', label: 'Classifica', Icon: IconTrophy },
  { href: '/profilo', label: 'Profilo', Icon: IconUser },
]

export default function Navbar({ wide = false }: { wide?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    createClient().from('profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => { if (alive) setIsAdmin(!!data?.is_admin) })
    return () => { alive = false }
  }, [user])

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const linkClass = (href: string, exact?: boolean) =>
    `relative text-sm font-medium transition-colors px-3 py-2 rounded-full ${
      active(href, exact) ? 'text-[var(--ink)] bg-[var(--surface-2)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
    }`

  // Dentro al form della schedina la barra in basso è quella del form.
  const inForm = /^\/schedine\/\d+/.test(pathname) || pathname === '/prova'

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-colors duration-300 pt-[env(safe-area-inset-top)] ${
          scrolled ? 'border-b border-[var(--line)] bg-[rgba(243,239,228,0.92)] backdrop-blur-md' : 'border-b border-transparent'
        }`}
      >
        <div className={`${wide ? 'max-w-5xl px-4 sm:px-6' : 'max-w-md px-4'} mx-auto h-14 flex items-center justify-between`}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--ink)] text-[var(--bg)] font-num font-bold text-sm leading-none">90</span>
            <span className="font-display font-semibold text-xl leading-none">
              <span className="text-[var(--muted)]">&amp; </span>Goal
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-1">
              {wide && (
                <div className="hidden sm:flex items-center gap-1">
                  {TABS.map(t => <Link key={t.href} href={t.href} className={linkClass(t.href, t.exact)}>{t.label}</Link>)}
                </div>
              )}
              {isAdmin && <Link href="/admin" className={linkClass('/admin')}>⚙️<span className="hidden sm:inline"> Admin</span></Link>}
              {wide && (
                <button onClick={handleLogout} className="hidden sm:inline text-sm text-[var(--muted)] hover:text-[var(--danger)] transition-colors px-3 py-2">
                  Esci
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link href="/auth/login" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors px-3 py-2">
                Accedi
              </Link>
              <Link href="/prova" className="btn-primary text-sm px-5 py-2">
                Gioca
              </Link>
            </div>
          )}
        </div>
      </nav>

      {user && !inForm && !wide && (
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--line)] bg-[var(--bg-deep)] pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4 max-w-md mx-auto">
            {TABS.map(t => {
              const on = active(t.href, t.exact)
              return (
                <Link key={t.href} href={t.href}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider transition-colors ${on ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                  <t.Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
                  {t.label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
