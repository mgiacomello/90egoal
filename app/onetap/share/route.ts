// Bersaglio dello share sheet di sistema.
//
// Quando il service worker è attivo intercetta lui questa POST e l'immagine non
// tocca mai la rete. Questo handler è la rete di sicurezza per il primo utilizzo
// (service worker non ancora installato) e per il testo condiviso.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function target(params: URLSearchParams): string {
  const query = params.toString()
  return query ? `/onetap?${query}` : '/onetap'
}

export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams
  const params = new URLSearchParams()
  for (const key of ['title', 'text', 'url']) {
    const value = incoming.get(key)
    if (value?.trim()) params.set(key, value)
  }
  return NextResponse.redirect(new URL(target(params), request.url), 303)
}

export async function POST(request: Request) {
  const params = new URLSearchParams()
  try {
    const form = await request.formData()
    for (const key of ['title', 'text', 'url']) {
      const value = form.get(key)
      if (typeof value === 'string' && value.trim()) params.set(key, value)
    }
    const file = form.get('image')
    // Un'immagine senza service worker non può essere consegnata al client senza
    // salvarla sul server: si preferisce non salvarla e chiedere di riprovare.
    if (!params.size && file) params.set('shared', 'retry')
  } catch {
    params.set('shared', 'failed')
  }
  return NextResponse.redirect(new URL(target(params), request.url), 303)
}
