'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ActivityTracker from '@/components/ActivityTracker'

/**
 * ONE TAP è un'app a schermo intero dentro allo stesso deploy: su `/onetap`
 * la navigazione del sito non deve comparire (e il tracker non deve girare).
 * Ogni altra rotta resta esattamente com'era.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname?.startsWith('/onetap')) return <>{children}</>

  return (
    <>
      <Navbar />
      <ActivityTracker />
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">{children}</main>
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-[var(--muted)]">
          <span className="font-display font-semibold">
            <span className="text-gradient">90</span>
            <span className="text-white/40"> &amp; </span>
            <span>Goal</span>
          </span>
          <span>Mondiali FIFA 2026 · Gioco di pronostici</span>
        </div>
      </footer>
    </>
  )
}
