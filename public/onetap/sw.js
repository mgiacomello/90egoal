/*
 * ONE TAP — service worker.
 *
 * Fa una cosa sola: raccogliere lo screenshot che il sistema operativo invia
 * allo share sheet e consegnarlo all'app. L'immagine resta nella Cache Storage
 * del dispositivo: non viene caricata da nessuna parte finché l'utente non
 * chiede l'analisi, e viene cancellata appena l'app l'ha letta.
 *
 * Niente precaching: nessuna pagina viene intercettata o servita da qui.
 */

const SHARE_CACHE = 'onetap-share'
const SHARE_KEY = '/onetap/__shared__'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isShare =
    event.request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === '/onetap/share'

  if (!isShare) return // tutto il resto passa dritto alla rete

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData()
        const file = form.get('image')

        if (file && typeof file !== 'string' && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE)
          await cache.put(
            SHARE_KEY,
            new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }),
          )
          return Response.redirect('/onetap?shared=1', 303)
        }

        const params = new URLSearchParams()
        for (const key of ['title', 'text', 'url']) {
          const value = form.get(key)
          if (typeof value === 'string' && value.trim()) params.set(key, value)
        }
        return Response.redirect(`/onetap?${params.toString()}`, 303)
      } catch {
        return Response.redirect('/onetap?shared=failed', 303)
      }
    })(),
  )
})
