import type { Metadata, Viewport } from 'next'
import './onetap.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://90egoal.vercel.app'
const TITLE = 'ONE TAP — turn anything you see into an action'
const DESCRIPTION =
  'See it. ONE TAP understands it. Tap once. Done. Point your camera at a number, an address, an invoice or a message and ONE TAP does the rest.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Il link condiviso in chat o sui social mostra un'anteprima con logo e claim.
  openGraph: {
    type: 'website',
    url: '/onetap',
    siteName: 'ONE TAP',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/onetap/og.png', width: 1200, height: 630, alt: 'ONE TAP: see it, tap once, done.' }],
    locale: 'it_IT',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/onetap/og.png'] },
  manifest: '/onetap/manifest.webmanifest',
  applicationName: 'ONE TAP',
  appleWebApp: { capable: true, title: 'ONE TAP', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/onetap/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/onetap/apple-touch-icon.png', sizes: '180x180' }],
  },
  // La pagina servita è la vetrina: il contenuto dell'utente vive solo nel
  // browser e non è mai nell'HTML. Le pagine interne restano fuori dagli indici.
  robots: { index: true, follow: true },
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
