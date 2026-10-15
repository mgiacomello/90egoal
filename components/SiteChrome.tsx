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
  const admin = pathname?.startsWith('/admin')

  return (
    <>
      <Navbar wide={admin} />
      <ActivityTracker />
      {/* La navigazione sta in basso: lo spazio sotto evita che copra il contenuto. */}
      <main className={`${admin ? 'max-w-5xl px-4 sm:px-6' : 'max-w-md px-4'} mx-auto w-full py-5 flex-1`}>{children}</main>
      <footer className={`border-t border-white/5 mt-12 ${admin ? 'sm:pb-0' : ''} pb-[calc(4.5rem+env(safe-area-inset-bottom))]`}>
        <div className={`${admin ? 'max-w-5xl' : 'max-w-md'} mx-auto px-4 py-5 flex items-center justify-between text-xs text-[var(--muted)]`}>
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
