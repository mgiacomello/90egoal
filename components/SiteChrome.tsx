'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ActivityTracker from '@/components/ActivityTracker'
import GolPopup from '@/components/GolPopup'
import PrivacyAvviso from '@/components/PrivacyAvviso'
import RisultatiAuto from '@/components/RisultatiAuto'

/**
 * ONE TAP è un'app a sé dentro allo stesso deploy: lì la navigazione del sito
 * non deve comparire (e il tracker non deve girare). Ogni altra rotta resta
 * esattamente com'era.
 */
const STANDALONE = ['/onetap', '/investitori']

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
      {/* I gol arrivano da soli: l'app aperta fa partire l'aggiornamento. Non sul pannello admin (lì si corregge a mano) né su accesso e informativa. */}
      {!wide && pathname !== '/privacy' && !pathname?.startsWith('/auth') && <RisultatiAuto />}
      {/* Chi ha un account da prima dell'informativa la accetta al primo accesso. Non sulla pagina dell'informativa né su accesso e recupero password. */}
      {pathname !== '/privacy' && !pathname?.startsWith('/auth') && <PrivacyAvviso />}
      {/* Il popup del gol legge l'indirizzo: Suspense perché useSearchParams non blocchi la pagina. */}
      <Suspense fallback={null}><GolPopup /></Suspense>
      {/* La navigazione sta in basso: lo spazio sotto evita che copra il contenuto. */}
      <main className={`${wide ? 'max-w-5xl px-4 sm:px-6 py-6' : 'max-w-md px-4 py-5'} mx-auto w-full flex-1`}>{children}</main>
      <footer className={`mt-12 ${wide ? 'sm:pb-0' : ''} pb-[calc(4.5rem+env(safe-area-inset-bottom))]`}>
        <div className={`${wide ? 'max-w-5xl' : 'max-w-md'} mx-auto px-4 py-4 flex items-center justify-between text-xs text-[var(--muted)]`}>
          <span className="font-display font-semibold text-sm">90 <span className="text-[var(--muted)]">&amp;</span> Goal</span>
          <span className="flex items-center gap-3"><a href="/privacy" className="underline">Privacy</a><span>versione di test</span></span>
        </div>
      </footer>
    </>
  )
}
