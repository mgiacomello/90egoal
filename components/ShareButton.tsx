'use client'

import { useState } from 'react'

export default function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`

  async function nativeOrCopy() {
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }).share) {
      try { await (navigator as Navigator & { share: (d: { text: string }) => Promise<void> }).share({ text }); return } catch {}
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
        <span>💬</span> Condividi su WhatsApp
      </a>
      <button onClick={nativeOrCopy} className="btn-ghost px-4 py-2.5 text-sm">
        {copied ? '✓ Copiato!' : '🔗 Copia link'}
      </button>
    </div>
  )
}
