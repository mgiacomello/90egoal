import type { Metadata, Viewport } from 'next'
import './onetap.css'

export const metadata: Metadata = {
  title: 'ONE TAP — turn anything you see into an action',
  description:
    'See it. ONE TAP understands it. Tap once. Done. Point your camera at a number, an address, an invoice or a message and ONE TAP does the rest.',
  manifest: '/onetap/manifest.webmanifest',
  applicationName: 'ONE TAP',
  appleWebApp: { capable: true, title: 'ONE TAP', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/onetap/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/onetap/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Contenuto privato dell'utente: non deve finire negli indici.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#08080a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function OneTapLayout({ children }: { children: React.ReactNode }) {
  return children
}
