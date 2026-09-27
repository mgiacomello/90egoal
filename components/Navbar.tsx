'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

// Su telefono si gioca coi pollici: le sezioni stanno in una barra in basso,
// in alto restano solo il marchio e (per chi amministra) l'accesso al pannello.
const TABS = [
  { href: '/', label: 'Home', icon: '⌂', exact: true },
  { href: '/schedine', label: 'Schedine', icon: '📝' },
  { href: '/classifica', label: 'Classifica', icon: '🏆' },
  { href: '/regole', label: 'Regole', icon: '📖' },
  { href: '/profilo', label: 'Profilo', icon: '👤' },
]

export default function Navbar() {
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
  const linkClass = (href: string) =>
    `relative text-sm font-medium transition-colors px-2.5 sm:px-3 py-2 rounded-lg ${
      active(href) ? 'text-white bg-white/5' : 'text-[var(--muted)] hover:text-white'
    }`

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 pt-[env(safe-area-inset-top)] ${
          scrolled ? 'border-b border-white/8 bg-[#07090d]/80 backdrop-blur-xl' : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-[#04130b] text-lg shadow-[0_8px_24px_-8px_rgba(0,230,118,0.7)] group-hover:scale-105 transition-transform">
              ⚽
            </span>
            <span className="font-display font-extrabold text-lg tracking-tight">
              <span className="text-gradient">90</span>
              <span className="text-white/40">&amp;</span>
              <span className="text-white">Goal</span>
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* desktop: link in alto */}
              <div className="hidden sm:flex items-center gap-1">
                <Link href="/schedine" className={linkClass('/schedine')}>Schedine</Link>
                <Link href="/classifica" className={linkClass('/classifica')}>Classifica</Link>
                <Link href="/regole" className={linkClass('/regole')}>Regole</Link>
                <Link href="/profilo" className={linkClass('/profilo')}>Profilo</Link>
              </div>
              {isAdmin && <Link href="/admin" className={linkClass('/admin')}>⚙️<span className="hidden sm:inline"> Admin</span></Link>}
              <button
                onClick={handleLogout}
                className="hidden sm:inline text-sm text-[var(--muted)] hover:text-red-400 transition-colors px-3 py-2"
              >
                Esci
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/regole" className={`${linkClass('/regole')} hidden sm:inline`}>Regole</Link>
              <Link href="/auth/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors px-3 py-2">
                Accedi
              </Link>
              <Link href="/auth/register" className="btn-primary text-sm px-5 py-2">
                Registrati
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* telefono: barra in basso, raggiungibile col pollice */}
      {user && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#07090d]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {TABS.map(t => {
              const on = active(t.href, t.exact)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                    on ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'
                  }`}
                >
                  <span className={`text-lg leading-none ${on ? '' : 'grayscale opacity-70'}`}>{t.icon}</span>
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
