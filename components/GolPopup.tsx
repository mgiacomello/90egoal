'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { esultanzaPer } from '@/components/GolStatuina'
import { parseMarcatore } from '@/lib/kits'
import Flag from '@/components/Flag'
import { fotoGiocatore, type FotoLibera } from '@/lib/fotoGiocatore'

// three.js si scarica solo quando c'è un gol da festeggiare.
const GolStatuina = dynamic(() => import('@/components/GolStatuina'), { ssr: false })

// Il popup del gol: si apre toccando la notifica (o un gol nella diretta),
// legge tutto dall'indirizzo: ?gol=1&t=Napoli&h=Venezia&a=Napoli&m=23'&sc=0-1&mk=Lukaku 11&tuo=1
export default function GolPopup() {
  const q = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const aperto = q.get('gol') === '1' && !!q.get('t')
  const mkParam = q.get('mk') ?? ''
  const teamParam = q.get('t') ?? ''
  // La foto vera, se esiste a licenza libera; intanto (e altrimenti) la statuina.
  const [foto, setFoto] = useState<{ chiave: string; foto: FotoLibera | null } | null>(null)
  const chiaveFoto = `${mkParam}|${teamParam}`
  useEffect(() => {
    if (!aperto || !mkParam) return
    let vivo = true
    fotoGiocatore(parseMarcatore(mkParam).nome, teamParam).then(f => { if (vivo) setFoto({ chiave: chiaveFoto, foto: f }) })
    return () => { vivo = false }
  }, [aperto, mkParam, teamParam, chiaveFoto])
  const fotoOra = foto?.chiave === chiaveFoto ? foto.foto : null
  // La statuina resta finché la foto non è davvero arrivata: niente riquadro vuoto.
  const [caricata, setCaricata] = useState<string | null>(null)
  const fotoPronta = !!fotoOra && caricata === fotoOra.url

  const chiudi = () => {
    const resto = new URLSearchParams(q.toString())
    for (const k of ['gol', 's', 'h', 'a', 't', 'm', 'sc', 'mk', 'tuo']) resto.delete(k)
    const s = resto.toString()
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }

  useEffect(() => {
    if (!aperto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudi() }
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  })

  if (!aperto) return null

  const team = q.get('t')!
  const home = q.get('h') ?? ''
  const away = q.get('a') ?? ''
  const min = q.get('m') ?? ''
  const score = q.get('sc') ?? ''
  const mk = q.get('mk') ?? ''
  const tuo = q.get('tuo')
  const { nome } = parseMarcatore(mk)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[rgba(20,48,31,0.55)] backdrop-blur-sm animate-fade-up"
      onClick={chiudi} role="dialog" aria-modal="true" aria-label={`Gol al ${min} di ${nome || team}`}>
      <div className="w-full max-w-md bg-[var(--bg)] rounded-t-3xl sm:rounded-3xl overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 px-5 pt-5 flex items-start justify-between z-10 pointer-events-none">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Gol</div>
              <div className="font-num font-semibold text-5xl leading-none text-[var(--ink)] mt-1">{min}</div>
            </div>
            {tuo && (
              <div className="rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-2 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider">È tuo</div>
                <div className="font-num font-semibold text-xl leading-none">+1</div>
              </div>
            )}
          </div>
          <GolStatuina team={team} marcatore={mk} esultanza={esultanzaPer(`${home}-${away}-${min}-${team}`)} className="h-[380px] w-full bg-[radial-gradient(120%_90%_at_50%_10%,var(--surface)_0%,var(--bg)_60%,var(--bg-deep)_100%)]" />
          {!fotoPronta && <p className="absolute bottom-2 inset-x-0 text-center text-[11px] text-[var(--muted)] pointer-events-none">Trascina per girarla</p>}
          {fotoOra && (
            <div className={`absolute inset-0 bg-[var(--bg-deep)] transition-opacity duration-500 ${fotoPronta ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoOra.url} alt={nome} onLoad={() => setCaricata(fotoOra.url)} className="absolute inset-0 w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(243,239,228,0.85)_0%,rgba(243,239,228,0)_30%,rgba(243,239,228,0)_70%,rgba(243,239,228,0.95)_100%)]" />
              <a href={fotoOra.fonte} target="_blank" rel="noopener noreferrer" className="absolute bottom-1.5 right-2 text-[10px] text-[var(--muted)] max-w-[85%] truncate">
                Foto: {fotoOra.autore} · {fotoOra.licenza} · Wikimedia Commons
              </a>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-5 space-y-4">
          <div>
            <h2 className="font-display font-semibold text-2xl leading-tight">{nome || team}</h2>
            {nome && <p className="text-sm text-[var(--muted)]">{team}</p>}
          </div>
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
            <Flag team={home} w={40} className="w-5 h-5 shrink-0" />
            <span className={`flex-1 truncate ${team === home ? 'font-semibold' : ''}`}>{home}</span>
            <span className="font-num font-semibold text-lg tabular-nums px-2">{score || '–'}</span>
            <span className={`flex-1 truncate text-right ${team === away ? 'font-semibold' : ''}`}>{away}</span>
            <Flag team={away} w={40} className="w-5 h-5 shrink-0" />
          </div>
          {tuo === 'rec' && <p className="text-sm text-[var(--accent-soft)] font-semibold">Gol nel recupero che avevi scelto: bonus.</p>}
          <button type="button" onClick={chiudi} className="btn-primary w-full py-3.5">Torna alla partita</button>
        </div>
      </div>
    </div>
  )
}
