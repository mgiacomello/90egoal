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

  // Il gioco è pensato per il telefono: anche su un computer resta una colonna
  // larga come un telefono, con la navigazione in basso. Solo il pannello admin
  // usa tutto lo schermo, perché lì si lavora da scrivania.
  const wide = !!pathname?.startsWith('/admin')

  return (
    <>
      <Navbar wide={wide} />
      <ActivityTracker />
      {/* La navigazione sta in basso: lo spazio sotto evita che copra il contenuto. */}
      <main className={`${wide ? 'max-w-5xl px-4 sm:px-6 py-6' : 'max-w-md px-4 py-5'} mx-auto w-full flex-1`}>{children}</main>
      <footer className={`mt-12 ${wide ? 'sm:pb-0' : ''} pb-[calc(4.5rem+env(safe-area-inset-bottom))]`}>
        <div className={`${wide ? 'max-w-5xl' : 'max-w-md'} mx-auto px-4 py-4 flex items-center justify-between text-xs text-[var(--muted)]`}>
          <span className="font-display font-bold text-sm tracking-wide">
            <span className="text-[var(--accent)]">90</span>
            <span className="opacity-50"> &amp; </span>
            <span>GOAL</span>
          </span>
          <span>versione di test</span>
        </div>
      </footer>
    </>
  )
}
