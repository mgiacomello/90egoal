'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const supabase = createClient()

  useEffect(() => {
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const linkClass = (href: string) =>
    `relative text-sm font-medium transition-colors px-2.5 sm:px-3 py-2 rounded-lg ${
      pathname.startsWith(href)
        ? 'text-white bg-white/5'
        : 'text-[var(--muted)] hover:text-white'
    }`

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/8 bg-[#07090d]/80 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
            <Link href="/schedine" className={linkClass('/schedine')}>Schedine</Link>
            <Link href="/salone" className={linkClass('/salone')}>Salone</Link>
            <Link href="/classifica" className={linkClass('/classifica')}>Classifica</Link>
            <Link href="/profilo" className={linkClass('/profilo')}>Profilo</Link>
            <button
              onClick={handleLogout}
              className="text-sm text-[var(--muted)] hover:text-red-400 transition-colors px-2.5 sm:px-3 py-2"
            >
              Esci
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/salone" className={linkClass('/salone')}>Salone</Link>
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
  )
}
