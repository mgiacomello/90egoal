import type { MetadataRoute } from 'next'

// 90 & Goal si installa dal link: "Aggiungi a schermata Home" e parte come un'app.
// ONE TAP ha il suo manifest (/onetap/manifest.webmanifest), dichiarato nel suo layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '90 & Goal',
    short_name: '90 & Goal',
    description: 'Indovina il minuto del gol. Dieci partite, tredici minuti, la classifica in diretta.',
    lang: 'it',
    start_url: '/schedine',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#07090d',
    theme_color: '#07090d',
    categories: ['sports', 'games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Schedine', url: '/schedine' },
      { name: 'Classifica', url: '/classifica' },
    ],
  }
}
