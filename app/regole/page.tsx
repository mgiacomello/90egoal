import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Regole — 90 & Goal' }

const PUNTI = [
  { p: '+1', t: 'per ogni tuo minuto in cui viene segnato almeno un gol, in una qualsiasi delle partite', c: 'text-[var(--accent)]' },
  { p: '+1', t: 'se c’è almeno un gol nel recupero del tempo che hai scelto (1° o 2°)', c: 'text-[var(--accent)]' },
  { p: '+3', t: 'se indovini la squadra che segna il primo gol OPPURE l’ultimo', c: 'text-[var(--gold)]' },
  { p: '+10', t: 'se le indovini entrambe (non si somma al +3)', c: 'text-[var(--gold)]' },
]

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Quale minuto vale?',
    a: <>Quello del tabellino ufficiale. Un gol segnato a 23 minuti e 40 secondi è al <strong className="text-white">24&apos;</strong>, cioè il minuto in corso.</>,
  },
  {
    q: 'E i gol nel recupero?',
    a: <>Un gol al 45+2&apos; o al 90+3&apos; <strong className="text-white">non vale per i minuti</strong> (non puoi sceglierlo), ma fa scattare il bonus recupero di quel tempo.</>,
  },
  {
    q: 'Due gol nello stesso minuto?',
    a: <>Se il 23&apos; esce in due partite diverse, chi l&apos;ha scelto prende comunque <strong className="text-white">1 punto</strong>. Conta il minuto, non quanti gol ci sono stati.</>,
  },
  {
    q: 'Autogol?',
    a: <>Vale per la squadra che ne beneficia, come sul tabellone.</>,
  },
  {
    q: 'Come si stabilisce il primo e l’ultimo gol?',
    a: <>In ordine di orario reale fra tutte le partite della schedina, tenendo conto dei diversi calci d&apos;inizio. Se una sola partita finisce dopo le altre, l&apos;ultimo gol è quasi sempre lì.</>,
  },
  {
    q: 'Fino a quando posso giocare?',
    a: <>Fino al <strong className="text-white">calcio d&apos;inizio della prima partita</strong> della schedina. Il pronostico, una volta inviato, è definitivo.</>,
  },
  {
    q: 'Quando vedo i punti?',
    a: <>Durante le partite: apri l&apos;app e trovi punteggi, minuti già azzeccati e classifica aggiornati. Non arrivano notifiche. La classifica diventa definitiva al fischio finale dell&apos;ultima partita.</>,
  },
  {
    q: 'Una partita rinviata o sospesa?',
    a: <>Valgono i gol segnati fino a quel momento nella giornata della schedina. Se la partita non si gioca, semplicemente non porta gol.</>,
  },
]

export default function RegolePage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Come si gioca</span>
      <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">📖 Regole</h1>
      <p className="text-[var(--muted)] mt-3">
        Ogni schedina raccoglie <strong className="text-white">10 partite della stessa giornata</strong>. Non devi indovinare i risultati:
        devi indovinare <strong className="text-white">in quali minuti arrivano i gol</strong>.
      </p>

      <section className="glass rounded-2xl p-5 sm:p-6 mt-6 space-y-4">
        <div className="flex gap-3">
          <span className="text-2xl">🕐</span>
          <div>
            <h2 className="font-display font-bold">1 · Scegli 13 minuti, dall&apos;1&apos; al 90&apos;</h2>
            <p className="text-sm text-[var(--muted)] mt-1">I minuti in cui pensi che qualcuno segni, in una qualsiasi delle 10 partite.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-2xl">➕</span>
          <div>
            <h2 className="font-display font-bold">2 · Recupero <span className="text-xs font-normal text-[var(--gold)]">facoltativo</span></h2>
            <p className="text-sm text-[var(--muted)] mt-1">Scegli se ci sarà un gol nel recupero del primo tempo oppure del secondo.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <h2 className="font-display font-bold">3 · Prima e ultima squadra a segnare <span className="text-xs font-normal text-[var(--gold)]">facoltativo</span></h2>
            <p className="text-sm text-[var(--muted)] mt-1">Fra tutte le squadre in campo nella schedina.</p>
          </div>
        </div>
      </section>

      <h2 className="font-display font-bold text-xl mt-8 mb-3">Punti</h2>
      <div className="space-y-2">
        {PUNTI.map((r, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3">
            <span className={`font-display font-extrabold text-2xl w-12 shrink-0 ${r.c}`}>{r.p}</span>
            <span className="text-sm text-white/80">{r.t}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">
        Nelle schedine a eliminazione diretta c&apos;è un bonus in più: <strong className="text-white">+5</strong> se indovini se almeno una partita andrà ai supplementari.
        Nelle giornate di campionato non c&apos;è.
      </p>
      <p className="text-xs text-[var(--muted)] mt-1">La classifica generale somma i punti di tutte le schedine del torneo.</p>

      <h2 className="font-display font-bold text-xl mt-8 mb-3">Domande frequenti</h2>
      <div className="space-y-2">
        {FAQ.map(f => (
          <details key={f.q} className="glass rounded-xl overflow-hidden group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 select-none font-semibold text-sm">
              {f.q}
              <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90 shrink-0">▶</span>
            </summary>
            <p className="px-4 pb-4 text-sm text-[var(--muted)] leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/schedine" className="btn-primary px-8 py-3.5">Vai alle schedine →</Link>
      </div>
    </div>
  )
}
