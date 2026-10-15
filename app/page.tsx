import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Schedina, Pronostico, Risultato, ClassificaRow, MatchDetail } from '@/lib/types'
import Flag from '@/components/Flag'
import Countdown from '@/components/Countdown'
import LiveFeed from '@/components/LiveFeed'
import LiveRefresh from '@/components/LiveRefresh'
import InstallButton from '@/components/InstallButton'
import PushToggle from '@/components/PushToggle'
import { nomeBreve } from '@/lib/teams'

// La home è "Oggi": una cosa sola, quella che conta adesso.
// Da compilare → il pulsante. Giocata → l'attesa. In corso → i gol in diretta. Finita → i punti.
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <Landing />

  const now = new Date()
  const nowIso = now.toISOString()
  const [{ data: schedineRaw }, { data: pronRaw }, { data: risRaw }, { data: clRaw }] = await Promise.all([
    supabase.from('schedine').select('*').order('id'),
    supabase.from('pronostici').select('*').eq('user_id', user.id),
    supabase.from('risultati').select('*'),
    supabase.from('classifica').select('*'),
  ])
  const attive = ((schedineRaw as Schedina[] | null) ?? []).filter(s => s.attiva !== false).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const pron = new Map(((pronRaw as Pronostico[] | null) ?? []).map(p => [p.schedina_id, p]))
  const ris = new Map(((risRaw as Risultato[] | null) ?? []).map(r => [r.schedina_id, r]))
  const cl = (clRaw as ClassificaRow[] | null) ?? []

  const conclusa = (s: Schedina) => {
    const d = (ris.get(s.id)?.dettagli as MatchDetail[] | undefined) ?? []
    return d.filter(x => (x.stato ?? 'finita') === 'finita').length === s.partite.length
  }
  // Quella del momento: in corso, altrimenti la prossima aperta, altrimenti l'ultima finita.
  const inCorso = attive.find(s => s.deadline <= nowIso && !conclusa(s))
  const prossima = attive.find(s => s.deadline > nowIso)
  const ultima = [...attive].reverse().find(s => s.deadline <= nowIso)
  const s = inCorso ?? prossima ?? ultima

  // Posizione nel torneo corrente
  const torneo = s?.torneo
  const ids = new Set(attive.filter(x => x.torneo === torneo).map(x => x.id))
  const tot = new Map<string, number>()
  cl.filter(r => ids.has(r.schedina_id)).forEach(r => tot.set(r.user_id, (tot.get(r.user_id) ?? 0) + r.totale))
  const generale = [...tot.entries()].sort((a, b) => b[1] - a[1])
  const myPos = generale.findIndex(([id]) => id === user.id) + 1
  const myTot = tot.get(user.id) ?? 0
  const posizione = myPos > 0 ? { pos: myPos, su: generale.length } : undefined

  if (!s) {
    return (
      <div className="max-w-lg mx-auto animate-fade-up text-center py-20">
        <div className="text-5xl mb-4">⚽</div>
        <h1 className="font-display font-bold text-2xl">Nessuna giornata in programma</h1>
        <p className="text-[var(--muted)] mt-2">Appena c&apos;è una schedina la trovi qui.</p>
      </div>
    )
  }

  const p = pron.get(s.id)
  const r = ris.get(s.id)
  const aperta = s.deadline > nowIso
  const deadline = new Date(s.deadline)
  const puntiSchedina = cl.find(x => x.schedina_id === s.id && x.user_id === user.id)?.totale
  const live = !aperta && !!r && !conclusa(s)

  return (
    <div className="max-w-lg mx-auto animate-fade-up space-y-5">
      {live && <LiveRefresh seconds={45} generatedAt={nowIso} />}

      {/* Testata: cosa, quando */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">
            {live ? '● In diretta' : aperta ? 'Prossima giornata' : 'Giornata conclusa'}
          </span>
          <h1 className="font-display font-bold text-2xl sm:text-3xl mt-1 leading-tight">{nomeBreve(s.nome)}</h1>
        </div>
        {posizione && (
          <Link href="/classifica" className="glass rounded-xl px-3 py-2 text-right shrink-0">
            <div className="font-display font-extrabold text-xl text-gradient-gold tabular-nums leading-none">{posizione.pos}°</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">{myTot} pt</div>
          </Link>
        )}
      </div>

      {/* ===== DA COMPILARE ===== */}
      {aperta && !p && (
        <>
          <div className="glass rounded-2xl p-5 text-center">
            <p className="text-sm text-[var(--muted)]">Si chiude {deadline.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} alle {deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</p>
            <div className="my-3"><Countdown deadline={s.deadline} /></div>
            <Link href={`/schedine/${s.id}`} className="btn-primary w-full py-4 text-base">Scegli i tuoi 13 minuti →</Link>
            <p className="text-xs text-[var(--muted)] mt-3">Un minuto giusto = 1 punto. Il primo e l&apos;ultimo gol della giornata = 2. <Link href="/regole" className="text-[var(--accent-soft)]">Regole</Link></p>
          </div>
          <Partite s={s} />
        </>
      )}

      {/* ===== GIOCATA, SI ASPETTA IL CAMPO ===== */}
      {aperta && p && (
        <>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[var(--accent-soft)]">✓ Schedina giocata</span>
              <span className="text-xs text-[var(--muted)]">si parte {deadline.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Rome' })} · {deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.minuti.map(m => <span key={m} className="tag-static px-2.5 py-1.5 text-sm">{m}&apos;</span>)}
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">Torna durante le partite: i minuti che escono si accendono qui.</p>
          </div>
          <PushToggle variant="banner" />
          <Partite s={s} />
        </>
      )}

      {/* ===== IN CORSO O FINITA ===== */}
      {!aperta && (
        r ? (
          <LiveFeed schedina={s} risultato={r} pronostico={p} punti={puntiSchedina} posizione={posizione} />
        ) : (
          <>
            <div className="glass rounded-2xl p-5 text-center text-sm text-[var(--muted)]">
              Le partite stanno per iniziare. I gol compaiono qui appena arrivano.
            </div>
            <Partite s={s} />
          </>
        )
      )}

      {!aperta && !p && (
        <p className="text-center text-xs text-[var(--muted)]">Questa giornata non l&apos;hai giocata. <Link href="/schedine" className="text-[var(--accent-soft)]">Le prossime →</Link></p>
      )}

      <InstallButton className="pt-2" />
    </div>
  )
}

function Partite({ s }: { s: Schedina }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 space-y-2">
      {s.partite.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-[11px] text-[var(--muted)] w-10 shrink-0 tabular-nums">{p.ora ?? ''}</span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="truncate">{p.home}</span>
            <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
          </div>
          <span className="text-white/25 text-xs">–</span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
            <span className="truncate">{p.away}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Chi arriva dal link di WhatsApp: cos'è, come si gioca, due pulsanti. Fine.
function Landing() {
  return (
    <div className="max-w-sm mx-auto animate-fade-up pt-6 pb-10 text-center">
      <div className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)] to-[var(--accent)] text-3xl shadow-[0_12px_30px_-8px_rgba(0,230,118,0.6)] mb-6">⚽</div>
      <h1 className="font-display font-extrabold text-4xl tracking-tight leading-[1.05]">
        Indovina il <span className="text-gradient">minuto</span> del gol
      </h1>
      <p className="mt-4 text-white/70">
        Dieci partite di Serie A, B e C nello stesso pomeriggio. Tu scegli <strong className="text-white">13 minuti</strong>. Ogni gol che arriva in uno dei tuoi è un punto.
      </p>

      <div className="glass rounded-2xl p-5 mt-8 text-left space-y-3 text-sm">
        {[
          ['1', 'Scegli 13 minuti, dall\'1\' al 90\'.'],
          ['2', 'Non importa in quale partita: basta che qualcuno segni.'],
          ['3', 'Durante le partite guardi i tuoi minuti accendersi.'],
        ].map(([n, t]) => (
          <div key={n} className="flex gap-3 items-start">
            <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent-soft)] font-display font-extrabold text-xs shrink-0">{n}</span>
            <span className="text-white/85">{t}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Link href="/prova" className="btn-primary w-full py-4 text-base">Gioca →</Link>
        <Link href="/auth/login" className="btn-ghost w-full py-3.5 text-sm">Ho già un account</Link>
        <p className="text-xs text-[var(--muted)]">Si prova subito, senza registrarsi. L&apos;account serve solo per entrare in classifica.</p>
        <InstallButton />
      </div>

      <p className="text-xs text-[var(--muted)] mt-8">Versione di test, senza premi. <Link href="/regole" className="text-[var(--accent-soft)]">Regole complete</Link></p>
    </div>
  )
}
