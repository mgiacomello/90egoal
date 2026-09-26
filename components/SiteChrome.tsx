'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ActivityTracker from '@/components/ActivityTracker'

/**
 * ONE TAP è un'app a sé dentro allo stesso deploy: lì la navigazione del sito
 * non deve comparire (e il tracker non deve girare). Ogni altra rotta resta
 * esattamente com'era.
 */
const STANDALONE = ['/onetap']

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (STANDALONE.some((prefix) => pathname?.startsWith(prefix))) return <>{children}</>

  return (
    <>
      <Navbar />
      <ActivityTracker />
      {/* Su telefono la navigazione sta in basso: lo spazio sotto evita che copra il contenuto. */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">{children}</main>
      <footer className="border-t border-white/5 mt-12 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-[var(--muted)]">
          <span className="font-display font-semibold">
            <span className="text-gradient">90</span>
            <span className="text-white/40"> &amp; </span>
            <span>Goal</span>
          </span>
          <span>Gioco di pronostici · versione di test</span>
        </div>
      </footer>
    </>
  )
}
