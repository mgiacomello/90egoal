import type { Metadata, Viewport } from 'next'
import './brain.css'

export const metadata: Metadata = {
  title: 'BRAIN — il tuo capo di gabinetto',
  description:
    'La memoria di lavoro di una persona sola: email, calendario, documenti, conto, salute. Risponde solo con quello che ci trova dentro, e dice sempre da dove.',
  // Memoria personale: non deve finire in nessun indice, mai.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#080a10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function BrainLayout({ children }: { children: React.ReactNode }) {
  return children
}
