'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { esultanzaPer } from '@/components/GolStatuina'
import { magliaDi, parseMarcatore } from '@/lib/kits'
import Flag from '@/components/Flag'
import { fotoGiocatore, type FotoLibera } from '@/lib/fotoGiocatore'
import { sagomaDa, type Sagoma } from '@/lib/ritaglio'

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
  // Le foto candidate si provano in ordine: la prima che si ritaglia come figura sola vince.
  // Se nessuna ci riesce (gruppi, avversari attaccati, dettagli) resta la statuina d'argilla:
  // meglio quella che un ritaglio confuso. Finché non è pronta, esulta la statuina.
  const chiaveFoto = `${mkParam}|${teamParam}`
  const [scelta, setScelta] = useState<{ chiave: string; foto: FotoLibera; sagoma: Sagoma } | null>(null)
  useEffect(() => {
    if (!aperto || !mkParam) return
    let vivo = true
    ;(async () => {
      const candidate = await fotoGiocatore(parseMarcatore(mkParam).nome, teamParam)
      const divisa = magliaDi(teamParam)
      for (const foto of candidate) {
        const sagoma = await sagomaDa(foto.url, [divisa.maglia, divisa.secondo])
        if (!vivo) return
        if (sagoma?.ritagliata && sagoma.singola) { setScelta({ chiave: chiaveFoto, foto, sagoma }); return }
      }
    })()
    return () => { vivo = false }
  }, [aperto, mkParam, teamParam, chiaveFoto])
  const fotoOra = scelta?.chiave === chiaveFoto ? scelta.foto : null
  const sagomaOra = scelta?.chiave === chiaveFoto ? scelta.sagoma : null

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-[rgba(11,31,77,0.55)] backdrop-blur-sm gol-velo"
      onClick={chiudi} role="dialog" aria-modal="true" aria-label={`Gol al ${min} di ${nome || team}`}>
      <div className="w-full max-w-[340px] bg-[var(--surface)] rounded-[28px] overflow-hidden shadow-[0_30px_80px_-20px_rgba(11,31,77,0.6)] gol-foglio"
        onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 px-4 pt-4 flex items-start justify-between z-10 pointer-events-none">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Gol</div>
              <div className="font-num font-semibold text-4xl leading-none text-[var(--ink)] mt-1 gol-pop" style={{ animationDelay: '0.45s' }}>{min}</div>
            </div>
            {tuo && (
              <div className="rounded-2xl bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-2 text-right gol-pop" style={{ animationDelay: '0.75s' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider">È tuo</div>
                <div className="font-num font-semibold text-xl leading-none">+1</div>
              </div>
            )}
          </div>
          <GolStatuina team={team} marcatore={mk} esultanza={esultanzaPer(`${home}-${away}-${min}-${team}`)} foto={sagomaOra?.canvas ?? null}
            className="h-[300px] w-full bg-[radial-gradient(120%_90%_at_50%_10%,#ffffff_0%,#eef3fb_55%,#dbe7ff_100%)]" />
          {sagomaOra && fotoOra ? (
            <a href={fotoOra.fonte} target="_blank" rel="noopener noreferrer" className="absolute bottom-1.5 inset-x-3 text-center text-[10px] text-[var(--muted)] truncate">
              Foto: {fotoOra.autore} · {fotoOra.licenza} · Wikimedia Commons
            </a>
          ) : (
            <p className="absolute bottom-2 inset-x-0 text-center text-[11px] text-[var(--muted)] pointer-events-none">Trascina per girarla</p>
          )}
        </div>

        <div className="px-4 pt-2 pb-4 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-2xl leading-tight">{nome || team}</h2>
            {nome && <p className="text-sm text-[var(--muted)]">{team}</p>}
          </div>
          <div className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm">
            <Flag team={home} w={40} className="w-5 h-5 shrink-0" />
            <span className={`flex-1 truncate ${team === home ? 'font-semibold' : ''}`}>{home}</span>
            <span className="font-num font-semibold text-lg tabular-nums px-2">{score || '–'}</span>
            <span className={`flex-1 truncate text-right ${team === away ? 'font-semibold' : ''}`}>{away}</span>
            <Flag team={away} w={40} className="w-5 h-5 shrink-0" />
          </div>
          {tuo === 'rec' && <p className="text-sm text-[var(--accent-soft)] font-semibold">Gol nel recupero che avevi scelto: bonus.</p>}
          <button type="button" onClick={chiudi} className="btn-primary w-full py-3">Torna alla partita</button>
        </div>
      </div>
    </div>
  )
}
