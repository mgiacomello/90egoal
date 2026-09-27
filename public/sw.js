// Service worker di 90 & Goal: serve solo alle notifiche push.
// Non intercetta la rete (nessun gestore "fetch"): il sito si comporta esattamente come senza.
// ONE TAP ha il suo service worker su /onetap/, che ha la precedenza sulle sue pagine.
// Le finestre di ONE TAP e del laboratorio (/lab) non vengono mai portate via da un tocco su una notifica.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '90 & Goal'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      vibrate: [80, 40, 80],
      data: { url: data.url || '/schedine' },
    }),
  )
})

// Tocco sulla notifica: riporta in primo piano l'app se è aperta, altrimenti la apre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/schedine', self.location.origin).href
  event.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of finestre) {
      const u = new URL(c.url)
      if (u.origin === self.location.origin && !u.pathname.startsWith('/onetap') && !u.pathname.startsWith('/lab')) {
        await c.focus()
        if ('navigate' in c) { try { await c.navigate(url) } catch { /* pagina di un'altra origine o chiusa */ } }
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
