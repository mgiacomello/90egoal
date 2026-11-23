import Link from 'next/link'
import type { ClassificaRow } from '@/lib/types'
import { classificaGenerale, conPosizioni, daMostrare, distacco, etichettaGiornata, ultimoTurno, type RigaGenerale } from '@/lib/classifica'
import { nomeBreve } from '@/lib/teams'
import { IconBall, IconCrown, IconTrophy } from '@/components/Icons'
import { nomeSchedina, ordinale, txDi, type Lingua, type Tx } from '@/lib/lingua'

export interface GiornataVista {
  id: number
  nome: string
  serie: string | null      // 'A' | 'B' | 'C', oppure null (Mondiali, coppe)
  deadline: string
  conclusa: boolean         // tutte le partite finite: i punti sono definitivi
  live: boolean             // si sta giocando: i punti cambiano
}

interface Props {
  righe: ClassificaRow[]            // già filtrate per torneo e lega
  giornate: GiornataVista[]         // tutte quelle del torneo
  userId?: string
  serie: string | null              // vista scelta: una serie, o null per tutte
  giornataId: number | null         // giornata scelta, o null per l'ultima giocata
  href: (o: { serie: string | null; g: number | null }) => string
  cima: number                      // quanti mostrarne prima di tagliare
  titolo: string
  lingua?: Lingua                   // lingua dei testi: italiano se manca
}

// Colori della carta: inchiostro, arancio, ocra, blu, mattone, oliva.
const TINTE = ['#14301f', '#c9530f', '#a3700f', '#1e4fa0', '#7a3b2e', '#4a6b3a']
function tinta(nome: string) {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return TINTE[h % TINTE.length]
}
const MEDAGLIA = ['var(--gold)', '#7d8791', '#a8683a']
const coloreDi = (pos: number) => (pos <= 3 ? MEDAGLIA[pos - 1] : 'var(--muted)')

function Avatar({ nome, size = 36 }: { nome: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full font-display font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.42, background: tinta(nome), color: 'var(--bg)' }}>
      {nome.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function ClassificaVista({ righe, giornate, userId, serie, giornataId, href, cima, titolo, lingua = 'it' }: Props) {
  const tx = txDi(lingua)
  const serieConPunti = [...new Set(giornate.filter(g => g.serie && righe.some(r => r.schedina_id === g.id)).map(g => g.serie!))].sort()
  const nellaVista = giornate.filter(g => !serie || g.serie === serie)
  const idsVista = new Set(nellaVista.map(g => g.id))
  const righeVista = righe.filter(r => idsVista.has(r.schedina_id))
  const conPunti = new Set(righeVista.map(r => r.schedina_id))
  const giocate = nellaVista.filter(g => conPunti.has(g.id)).sort((a, b) => b.deadline.localeCompare(a.deadline) || b.id - a.id)
  const concluse = new Set(nellaVista.filter(g => g.conclusa).map(g => g.id))
  const turno = ultimoTurno(nellaVista, conPunti)
  const generale = classificaGenerale(righeVista, turno, concluse)
  const io = userId ? generale.find(r => r.user_id === userId) : undefined
  const liveOra = giocate.some(g => g.live)

  const scelta = giocate.find(g => g.id === giornataId) ?? giocate[0]
  const righeGiornata = scelta ? conPosizioni(righeVista.filter(r => r.schedina_id === scelta.id)) : []

  // Albo d'oro: chi ha vinto ogni giornata conclusa, dalla più recente.
  const albo = giocate.filter(g => g.conclusa).map(g => {
    const rr = conPosizioni(righeVista.filter(r => r.schedina_id === g.id))
    return { g, primi: rr.filter(r => r.pos === 1) }
  }).filter(x => x.primi.length > 0)
  const record = righeVista.reduce<ClassificaRow | null>((best, r) => (!best || r.totale > best.totale ? r : best), null)
  const recordGiornata = record ? giornate.find(g => g.id === record.schedina_id) : undefined
  const piuVittorie = [...generale].sort((a, b) => b.vittorie - a.vittorie)[0]

  return (
    <div>
      {/* Vista: tutte le serie o una sola */}
      {serieConPunti.length > 1 && (
        <div className="flex gap-2 mb-4 -mx-4 px-4 overflow-x-auto [scrollbar-width:none]" aria-label="Serie">
          <Link href={href({ serie: null, g: null })} scroll={false} className={`seg-btn px-3 py-1.5 text-sm shrink-0 ${!serie ? 'is-active' : ''}`}>{tx('Tutte le serie', 'All divisions')}</Link>
          {serieConPunti.map(s => (
            <Link key={s} href={href({ serie: s, g: null })} scroll={false} className={`seg-btn px-3 py-1.5 text-sm shrink-0 ${serie === s ? 'is-active' : ''}`}>Serie {s}</Link>
          ))}
        </div>
      )}

      {io && <Io io={io} generale={generale} righe={righeVista} giornate={giocate} live={liveOra} soloNumero={!!serie} lingua={lingua} />}

      {generale.length >= 3 && <Podio top={generale.slice(0, 3)} userId={userId} tx={tx} />}

      {/* ===== Generale ===== */}
      <section className="mb-9">
        <div className="mb-3">
          <h2 className="font-display font-bold text-lg">{titolo}</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">{serie && `Serie ${serie} · `}{generale.length} {generale.length === 1 ? tx('giocatore', 'player') : tx('giocatori', 'players')} · {giocate.length} {giocate.length === 1 ? tx('giornata giocata', 'matchday played') : tx('giornate giocate', 'matchdays played')}</p>
        </div>
        <Lista righe={generale} userId={userId} cima={cima} max={generale[0]?.totale ?? 1} live={liveOra} tx={tx} />
        {turno.size > 0 && giocate.length > turno.size && (
          <p className="text-[11px] text-[var(--muted)] mt-2.5 px-1">
            <span className="text-[#2f7d4f] font-semibold">▲</span> <span className="text-[var(--danger)] font-semibold">▼</span> {tx('posizioni guadagnate o perse con l\'ultimo turno', 'places gained or lost in the last round')} · <span className="font-num">+n</span> {tx('punti dell\'ultimo turno', 'points from the last round')}
          </p>
        )}
      </section>

      {/* ===== Giornata per giornata ===== */}
      {scelta && (
        <section className="mb-9">
          <h2 className="font-display font-bold text-lg mb-3">{tx('Giornata per giornata', 'Matchday by matchday')}</h2>
          <div className="flex gap-2 mb-3 -mx-4 px-4 overflow-x-auto [scrollbar-width:none]" aria-label={tx('Giornata', 'Matchday')}>
            {giocate.map(g => (
              <Link key={g.id} href={href({ serie, g: g.id })} scroll={false}
                className={`seg-btn px-3 py-1.5 text-sm shrink-0 flex items-center gap-1.5 ${g.id === scelta.id ? 'is-active' : ''}`}>
                {g.live && <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse-glow" />}
                {etichettaGiornata(nomeBreve(g.nome), !!serie, lingua)}
              </Link>
            ))}
          </div>
          <Giornata g={scelta} righe={righeGiornata} userId={userId} cima={cima} lingua={lingua} />
        </section>
      )}

      {/* ===== Albo d'oro e primati ===== */}
      {albo.length > 0 && (
        <section className="mb-9">
          <h2 className="font-display font-bold text-lg mb-3">{tx('Albo d\'oro', 'Hall of fame')}</h2>
          {(record || (piuVittorie && piuVittorie.vittorie > 1)) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {record && (
                <div className="glass rounded-xl px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{tx('Record di giornata', 'Matchday record')}</div>
                  <div className="font-num font-semibold text-2xl text-[var(--gold)] leading-tight">{record.totale}<span className="text-xs font-normal text-[var(--muted)] ml-0.5">{tx('pt', 'pts')}</span></div>
                  <div className="text-xs truncate">{record.username}{recordGiornata && <span className="text-[var(--muted)]"> · {etichettaGiornata(nomeBreve(recordGiornata.nome), false, lingua)}</span>}</div>
                </div>
              )}
              {piuVittorie && piuVittorie.vittorie > 0 && (
                <div className="glass rounded-xl px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{tx('Più giornate vinte', 'Most matchdays won')}</div>
                  <div className="font-num font-semibold text-2xl text-[var(--gold)] leading-tight">{piuVittorie.vittorie}</div>
                  <div className="text-xs truncate">{piuVittorie.username}</div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 -mx-4 px-4 overflow-x-auto [scrollbar-width:none] pb-1">
            {albo.map(({ g, primi }) => (
              <Link key={g.id} href={href({ serie, g: g.id })} scroll={false} className="glass glass-hover rounded-xl px-3 py-2.5 shrink-0 w-36">
                <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <span>{etichettaGiornata(nomeBreve(g.nome), !!serie, lingua)}</span>
                  <IconCrown size={13} className="text-[var(--gold)]" />
                </div>
                <div className="font-display font-semibold truncate mt-1">{primi[0].username}</div>
                <div className="text-xs text-[var(--muted)]">
                  <span className="font-num text-[var(--gold)] font-semibold">{primi[0].totale} {tx('pt', 'pts')}</span>
                  {primi.length > 1 && tx(` · con altri ${primi.length - 1}`, ` · with ${primi.length - 1} ${primi.length === 2 ? 'other' : 'others'}`)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ---------- Il mio posto ---------- */

function Movimento({ m, grande = false, tx }: { m: number | null; grande?: boolean; tx: Tx }) {
  const c = grande ? 'text-xs' : 'text-[10px]'
  if (m === null) return <span className={`${c} font-semibold text-[var(--accent-cyan)]`}>{tx('nuovo', 'new')}</span>
  if (m > 0) return <span className={`${c} font-semibold text-[#2f7d4f] font-num`}>▲{m}</span>
  if (m < 0) return <span className={`${c} font-semibold text-[var(--danger)] font-num`}>▼{-m}</span>
  return <span className={`${c} text-[var(--muted)]`}>＝</span>
}

function Io({ io, generale, righe, giornate, live, soloNumero, lingua }: { io: RigaGenerale; generale: RigaGenerale[]; righe: ClassificaRow[]; giornate: GiornataVista[]; live: boolean; soloNumero: boolean; lingua: Lingua }) {
  const tx = txDi(lingua)
  // I miei punti, giornata per giornata (le ultime otto, in ordine di tempo).
  const mie = giornate.slice(0, 8).reverse().map(g => ({ g, punti: righe.find(r => r.schedina_id === g.id && r.user_id === io.user_id)?.totale ?? null }))
  const max = Math.max(1, ...mie.map(x => x.punti ?? 0))
  const frase = distacco(generale, io.user_id, lingua)
  return (
    <div className="rounded-2xl mb-6 p-4 relative overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-70 flex items-center gap-1.5">
            {tx('Il tuo posto', 'Your place')}
            {live && <span className="inline-flex items-center gap-1 text-[var(--accent)] normal-case tracking-normal font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-glow" />{tx('in diretta', 'live')}</span>}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-num font-semibold text-5xl leading-none tabular-nums">{lingua === 'en' ? ordinale(io.pos) : `${io.pos}°`}</span>
            <span className="text-sm opacity-70">{tx('su', 'of')} {generale.length}</span>
            {io.movimento !== 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold font-num" style={{ background: 'rgba(243,239,228,0.14)' }}>
                {io.movimento === null ? tx('nuovo', 'new') : io.movimento > 0 ? `▲ ${io.movimento}` : `▼ ${-io.movimento}`}
              </span>
            )}
          </div>
          {frase && <div className="text-sm mt-2 opacity-90">{frase}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="font-num font-semibold text-3xl leading-none tabular-nums text-[var(--accent)]">{io.totale}</div>
          <div className="text-[11px] opacity-70 mt-1">{tx('punti', 'points')}</div>
          {io.ultimo !== null && <div className="text-[11px] mt-1 font-num opacity-90">+{io.ultimo} {tx('ultimo turno', 'last round')}</div>}
        </div>
      </div>
      {mie.length > 1 && (
        <div className="flex items-end gap-1.5 mt-4 h-14" aria-label={tx('I tuoi punti per giornata', 'Your points by matchday')}>
          {mie.map(({ g, punti }) => (
            <div key={g.id} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              <span className="font-num text-[10px] leading-none mb-0.5 opacity-90">{punti ?? '–'}</span>
              <span className="w-full rounded-t points-bar-fill" style={{
                height: `${punti === null ? 3 : Math.max(8, (punti / max) * 100)}%`, maxHeight: '28px', minHeight: '2px',
                transformOrigin: 'bottom', animationName: 'grow-up',
                background: punti === null ? 'rgba(243,239,228,0.2)' : punti === max ? 'var(--accent)' : 'rgba(243,239,228,0.55)',
              }} />
              <span className="text-[9px] opacity-60 mt-1 truncate w-full text-center">{etichettaGiornata(nomeBreve(g.nome), soloNumero, lingua).replace(' · ', ' ').replace('MD ', '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Podio ---------- */

function Podio({ top, userId, tx }: { top: RigaGenerale[]; userId?: string; tx: Tx }) {
  const ordine = [top[1], top[0], top[2]]
  const altezze = ['h-16', 'h-24', 'h-12']
  const ritardi = ['0.15s', '0s', '0.3s']
  return (
    <div className="glass rounded-2xl px-3 pt-5 mb-7 overflow-hidden">
      <div className="flex items-end justify-center gap-2">
        {ordine.map((r, i) => {
          const mio = r.user_id === userId
          const primo = i === 1
          return (
            <div key={r.user_id} className="flex flex-col items-center flex-1 min-w-0">
              <div className="podium-medal flex flex-col items-center" style={{ animationDelay: ritardi[i] }}>
                {primo ? <IconCrown size={20} className="text-[var(--gold)] mb-1" /> : <span className="h-5 mb-1" />}
                <span className="rounded-full p-[3px]" style={{ background: coloreDi(r.pos) }}><Avatar nome={r.username} size={primo ? 52 : 42} /></span>
              </div>
              <div className={`font-semibold text-sm text-center truncate w-full mt-2 ${mio ? 'text-[var(--accent-soft)]' : ''}`}>{r.username}{mio && tx(' (tu)', ' (you)')}</div>
              <div className="font-num font-semibold text-xl tabular-nums leading-tight" style={{ color: coloreDi(r.pos) }}>{r.totale}<span className="text-[10px] text-[var(--muted)] font-normal ml-0.5">{tx('pt', r.totale === 1 ? 'pt' : 'pts')}</span></div>
              <div className={`podium-col mt-2 w-full ${altezze[i]} rounded-t-lg grid place-items-center`} style={{ animationDelay: ritardi[i], background: primo ? 'var(--ink)' : 'var(--surface-2)', borderTop: `3px solid ${coloreDi(r.pos)}` }}>
                <span className="font-num font-semibold text-2xl" style={{ color: primo ? 'var(--bg)' : 'var(--muted)' }}>{r.pos}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Lista generale ---------- */

function Lista({ righe, userId, cima, max, live, tx }: { righe: RigaGenerale[]; userId?: string; cima: number; max: number; live: boolean; tx: Tx }) {
  const { cima: primi, vicino } = daMostrare(righe, userId, cima)
  const riga = (r: RigaGenerale, idx: number) => {
    const mio = r.user_id === userId
    const pct = max > 0 ? Math.max((r.totale / max) * 100, 3) : 0
    return (
      <div key={r.user_id} className={`leader-row rounded-xl px-3 py-2.5 border ${mio ? 'border-[var(--accent)] bg-[rgba(232,100,28,0.07)]' : 'glass glass-hover'}`} style={{ animationDelay: `${Math.min(idx * 0.035, 0.6)}s` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 shrink-0 text-center leading-none">
            <div className="font-num font-semibold tabular-nums text-lg" style={{ color: coloreDi(r.pos) }}>{r.pos}</div>
            <div className="mt-0.5"><Movimento m={r.movimento} tx={tx} /></div>
          </div>
          <Avatar nome={r.username} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold truncate ${mio ? 'text-[var(--accent-soft)]' : ''}`}>{r.username}</span>
              {mio && <span className="text-[10px] font-bold text-[var(--accent-ink)] bg-[var(--accent)] rounded-full px-1.5 py-px shrink-0">{tx('TU', 'YOU')}</span>}
              {r.vittorie > 0 && <span className="flex items-center gap-0.5 text-[10px] text-[var(--gold)] font-semibold shrink-0" title={tx('Giornate vinte', 'Matchdays won')}><IconCrown size={11} />{r.vittorie}</span>}
            </div>
            <div className="h-1.5 mt-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="points-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: mio ? 'var(--accent)' : 'var(--ink)', animationDelay: `${Math.min(idx * 0.035, 0.6) + 0.1}s` }} />
            </div>
          </div>
          <div className="shrink-0 text-right leading-none">
            <div><span className="font-num font-semibold text-lg tabular-nums">{r.totale}</span><span className="text-[10px] text-[var(--muted)] ml-0.5">{tx('pt', r.totale === 1 ? 'pt' : 'pts')}</span></div>
            {r.ultimo !== null && <div className={`font-num text-[10px] mt-1 ${live ? 'text-[var(--accent-soft)] font-semibold' : 'text-[var(--muted)]'}`}>+{r.ultimo}</div>}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {primi.map(riga)}
      {vicino.length > 0 && <div className="text-center text-[var(--muted)] text-xs py-0.5 tracking-[0.3em]">···</div>}
      {vicino.map((r, i) => riga(r, primi.length + i))}
      {righe.length > primi.length + vicino.length && (
        <p className="text-center text-xs text-[var(--muted)] pt-1">{tx('e altri', 'and')} {righe.length - primi.length - vicino.length}{tx('', ' more')}</p>
      )}
    </div>
  )
}

/* ---------- Una giornata ---------- */

function Giornata({ g, righe, userId, cima, lingua }: { g: GiornataVista; righe: (ClassificaRow & { pos: number })[]; userId?: string; cima: number; lingua: Lingua }) {
  const tx = txDi(lingua)
  const { cima: primi, vicino } = daMostrare(righe, userId, cima)
  const media = righe.length ? righe.reduce((s, r) => s + r.totale, 0) / righe.length : 0
  const max = righe[0]?.totale ?? 1
  const riga = (r: ClassificaRow & { pos: number }, idx: number) => {
    const mio = r.user_id === userId
    const presi = r.minuti_azzeccati ?? []
    const pezzi = [
      { n: r.punti_minuti, l: tx('minuti', r.punti_minuti === 1 ? 'minute' : 'minutes'), c: 'var(--accent)' },
      { n: r.punti_recupero, l: tx('recupero', 'stoppage time'), c: 'var(--accent-cyan)' },
      { n: r.punti_bonus, l: tx('squadre', 'teams'), c: 'var(--gold)' },
    ].filter(p => p.n > 0)
    return (
      <div key={r.user_id} className={`leader-row rounded-xl px-3 py-2.5 border ${mio ? 'border-[var(--accent)] bg-[rgba(232,100,28,0.07)]' : 'glass'}`} style={{ animationDelay: `${Math.min(idx * 0.035, 0.6)}s` }}>
        <div className="flex items-center gap-2.5">
          <span className="w-6 shrink-0 text-center font-num font-semibold tabular-nums" style={{ color: coloreDi(r.pos) }}>{r.pos}</span>
          <Avatar nome={r.username} size={30} />
          <span className={`flex-1 min-w-0 font-semibold truncate ${mio ? 'text-[var(--accent-soft)]' : ''}`}>{r.username}{mio && <span className="text-[10px] font-bold text-[var(--accent-ink)] bg-[var(--accent)] rounded-full px-1.5 py-px ml-1.5 align-middle">{tx('TU', 'YOU')}</span>}</span>
          <span className="shrink-0"><span className="font-num font-semibold text-lg tabular-nums">{r.totale}</span><span className="text-[10px] text-[var(--muted)] ml-0.5">{tx('pt', r.totale === 1 ? 'pt' : 'pts')}</span></span>
        </div>
        {/* Da dove vengono i punti: una barra a pezzi, e i minuti presi */}
        {r.totale > 0 && (
          <div className="mt-2 pl-[2.1rem]">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)]" style={{ width: `${Math.max((r.totale / max) * 100, 12)}%` }}>
              {pezzi.map(p => <span key={p.l} className="points-bar-fill h-full" style={{ flexGrow: p.n, background: p.c }} />)}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-[var(--muted)]">
              {pezzi.map(p => <span key={p.l} className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: p.c }} />{p.n} {p.l}</span>)}
            </div>
            {presi.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <IconBall size={12} className="text-[var(--muted)]" />
                {presi.map(m => <span key={m} className="tag-static px-1.5 py-0.5 text-[10px]">{m}&apos;</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  return (
    <div>
      <div className="glass rounded-xl px-3 py-2.5 mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-semibold truncate">{nomeSchedina(nomeBreve(g.nome), lingua)}</div>
          <div className="text-xs mt-0.5">
            {g.live
              ? <span className="text-[var(--danger)] font-semibold">{tx('● In corso · punti provvisori', '● In progress · provisional points')}</span>
              : g.conclusa ? <span className="text-[var(--muted)]">{tx('Conclusa · punti definitivi', 'Finished · final points')}</span> : <span className="text-[var(--muted)]">{tx('Punti parziali', 'Partial points')}</span>}
          </div>
        </div>
        <div className="flex gap-4 shrink-0 text-right">
          <div><div className="font-num font-semibold text-lg leading-none">{righe.length}</div><div className="text-[10px] text-[var(--muted)] mt-1">{tx('giocatori', 'players')}</div></div>
          <div><div className="font-num font-semibold text-lg leading-none">{lingua === 'en' ? media.toFixed(1) : media.toFixed(1).replace('.', ',')}</div><div className="text-[10px] text-[var(--muted)] mt-1">{tx('media', 'average')}</div></div>
        </div>
      </div>
      {righe.length === 0 ? (
        <div className="glass rounded-2xl py-8 text-center text-[var(--muted)] text-sm"><IconTrophy size={24} className="inline-block mb-2" /><br />{tx('Nessuno in classifica per questa giornata.', 'No one in the standings for this matchday.')}</div>
      ) : (
        <div className="space-y-1.5">
          {primi.map(riga)}
          {vicino.length > 0 && <div className="text-center text-[var(--muted)] text-xs py-0.5 tracking-[0.3em]">···</div>}
          {vicino.map((r, i) => riga(r, primi.length + i))}
          {righe.length > primi.length + vicino.length && <p className="text-center text-xs text-[var(--muted)] pt-1">{tx('e altri', 'and')} {righe.length - primi.length - vicino.length}{tx('', ' more')}</p>}
        </div>
      )}
    </div>
  )
}
