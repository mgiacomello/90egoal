import type { MetadataRoute } from 'next'
import { linguaServer } from '@/lib/lingua.server'

// 90 & Goal si installa dal link: "Aggiungi a schermata Home" e parte come un'app.
// ONE TAP ha il suo manifest (/onetap/manifest.webmanifest), dichiarato nel suo layout.
// La lingua segue il cookie di chi installa: leggerlo rende il manifest dinamico (non in cache).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const en = (await linguaServer()) === 'en'
  return {
    id: '/',
    name: '90 & Goal',
    short_name: '90 & Goal',
    description: en
      ? 'Guess the minute of the goal. Ten matches, thirteen minutes, live standings.'
      : 'Indovina il minuto del gol. Dieci partite, tredici minuti, la classifica in diretta.',
    lang: en ? 'en' : 'it',
    start_url: '/schedine',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3efe4',
    theme_color: '#f3efe4',
    categories: ['sports', 'games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: en ? 'Tickets' : 'Schedine', url: '/schedine' },
      { name: en ? 'Standings' : 'Classifica', url: '/classifica' },
    ],
  }
}
