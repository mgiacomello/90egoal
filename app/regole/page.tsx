import type { Metadata } from 'next'
import Link from 'next/link'
import { IconClock, IconPlus, IconTrophy } from '@/components/Icons'
import { linguaServer, txServer } from '@/lib/lingua.server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await linguaServer()) === 'en' ? 'Rules — 90 & Goal' : 'Regole — 90 & Goal' }
}

const COLORE = ['text-[var(--accent)]', 'text-[var(--accent)]', 'text-[var(--accent)]', 'text-[var(--gold)]', 'text-[var(--gold)]']

const PUNTI = {
  it: [
    { p: '+1', t: 'per ogni tuo minuto in cui viene segnato almeno un gol, in una qualsiasi delle partite' },
    { p: '+2', t: 'se quel minuto è quello del primo gol della schedina (nei 90 minuti, in ordine di orario)' },
    { p: '+1', t: 'se c’è almeno un gol nel recupero del tempo che hai scelto (1° o 2°)' },
    { p: '+1', t: 'se indovini la squadra che segna il primo gol nei 90 minuti regolamentari' },
    { p: '+1', t: 'se indovini la squadra che segna l’ultimo gol nei 90 minuti regolamentari' },
  ],
  en: [
    { p: '+1', t: 'for each of your minutes in which at least one goal is scored, in any of the matches' },
    { p: '+2', t: 'if that minute is the one of the first goal of the ticket (within the 90 minutes, in real-time order)' },
    { p: '+1', t: 'if there is at least one goal in the stoppage time of the half you picked (1st or 2nd)' },
    { p: '+1', t: 'if you guess the team that scores the first goal within the 90 regular minutes' },
    { p: '+1', t: 'if you guess the team that scores the last goal within the 90 regular minutes' },
  ],
}

const S = ({ children }: { children: React.ReactNode }) => <strong className="text-[var(--ink)]">{children}</strong>

const FAQ: Record<'it' | 'en', { q: string; a: React.ReactNode }[]> = {
  it: [
    {
      q: 'Quale minuto vale?',
      a: <>Quello del tabellino ufficiale. Un gol segnato a 23 minuti e 40 secondi è al <strong className="text-[var(--ink)]">24&apos;</strong>, cioè il minuto in corso.</>,
    },
    {
      q: 'E i gol nel recupero?',
      a: <>Un gol al 45+2&apos; o al 90+3&apos; <strong className="text-[var(--ink)]">non vale per i minuti</strong> (non puoi sceglierlo), ma fa scattare il bonus recupero di quel tempo.</>,
    },
    {
      q: 'Quale minuto vale doppio?',
      a: <>Il minuto del <strong className="text-[var(--ink)]">primo gol</strong> segnato nei tempi regolamentari, considerando tutte le partite della schedina in ordine di orario reale. Se lo hai in schedina, vale 2 punti invece di 1. I gol nel recupero non contano per questa regola.</>,
    },
    {
      q: 'Prima e ultima squadra: quali gol contano?',
      a: <>Solo quelli segnati nei 90 minuti regolamentari, dal 1° al 45° e dal 46° al 90°, in ordine di orario reale fra tutte le partite della schedina. I gol nei minuti di recupero non contano per questo bonus. Ogni squadra indovinata vale <strong className="text-[var(--ink)]">1 punto</strong>.</>,
    },
    {
      q: 'Due gol nello stesso minuto?',
      a: <>Se il 23&apos; esce in due partite diverse, chi l&apos;ha scelto prende comunque <strong className="text-[var(--ink)]">1 punto</strong>. Conta il minuto, non quanti gol ci sono stati.</>,
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
      a: <>Fino al <strong className="text-[var(--ink)]">calcio d&apos;inizio della prima partita</strong> della schedina. Il pronostico, una volta inviato, è definitivo.</>,
    },
    {
      q: 'Quando vedo i punti?',
      a: <>Durante le partite: apri l&apos;app e trovi punteggi, minuti già azzeccati e classifica aggiornati. Se attivi le notifiche dal Profilo, ti avvisiamo noi a ogni gol, o solo quando esce un tuo minuto. La classifica diventa definitiva al fischio finale dell&apos;ultima partita.</>,
    },
    {
      q: 'Come attivo le notifiche?',
      a: <>Dal <strong className="text-[var(--ink)]">Profilo</strong>, tocca &quot;Attiva&quot;. Su iPhone funzionano solo se hai aggiunto 90 &amp; Goal alla schermata Home (Safari → Condividi → Aggiungi alla schermata Home) e la apri da lì. Su Android bastano Chrome o l&apos;app installata.</>,
    },
    {
      q: 'Posso fare una classifica solo con i miei amici?',
      a: <>Sì, con le <strong className="text-[var(--ink)]">leghe</strong>. Dal Profilo o dalla Classifica crei una lega e mandi il link al gruppo: chi lo apre entra con un tocco. Le schedine sono le stesse per tutti, la lega ha la sua classifica con i punti del torneo. Puoi stare in più leghe insieme.</>,
    },
    {
      q: 'Una partita rinviata o sospesa?',
      a: <>Valgono i gol segnati fino a quel momento nella giornata della schedina. Se la partita non si gioca, semplicemente non porta gol.</>,
    },
  ],
  en: [
    {
      q: 'Which minute counts?',
      a: <>The one on the official match report. A goal scored at 23 minutes and 40 seconds is in the <S>24&apos;</S>, the minute being played.</>,
    },
    {
      q: 'What about goals in stoppage time?',
      a: <>A goal at 45+2&apos; or 90+3&apos; <S>does not count for the minutes</S> (you cannot pick it), but it triggers the stoppage-time bonus for that half.</>,
    },
    {
      q: 'Which minute counts double?',
      a: <>The minute of the <S>first goal</S> scored in regular time, looking at all the matches of the ticket in real-time order. If it is on your ticket, it is worth 2 points instead of 1. Goals in stoppage time do not count for this rule.</>,
    },
    {
      q: 'First and last team: which goals count?',
      a: <>Only those scored within the 90 regular minutes, from the 1st to the 45th and from the 46th to the 90th, in real-time order across all the matches of the ticket. Goals in stoppage time do not count for this bonus. Each team you guess is worth <S>1 point</S>.</>,
    },
    {
      q: 'Two goals in the same minute?',
      a: <>If the 23&apos; comes up in two different matches, whoever picked it still gets <S>1 point</S>. The minute counts, not how many goals there were.</>,
    },
    {
      q: 'Own goals?',
      a: <>They count for the team that benefits, as on the scoreboard.</>,
    },
    {
      q: 'How are the first and last goal decided?',
      a: <>In real-time order across all the matches of the ticket, taking the different kick-off times into account. If one match ends after all the others, the last goal is almost always there.</>,
    },
    {
      q: 'Until when can I play?',
      a: <>Until the <S>kick-off of the first match</S> of the ticket. Once sent, your prediction is final.</>,
    },
    {
      q: 'When do I see my points?',
      a: <>During the matches: open the app and you find scores, the minutes you have already hit and the standings, all up to date. If you turn on notifications from your Profile, we tell you at every goal, or only when one of your minutes comes up. The standings become final at the last whistle of the last match.</>,
    },
    {
      q: 'How do I turn on notifications?',
      a: <>From your <S>Profile</S>, tap &quot;Turn on&quot;. On iPhone they only work if you have added 90 &amp; Goal to the Home Screen (Safari → Share → Add to Home Screen) and open it from there. On Android, Chrome or the installed app is enough.</>,
    },
    {
      q: 'Can I have standings just for my friends?',
      a: <>Yes, with <S>leagues</S>. From your Profile or the Standings you create a league and send the link to the group: whoever opens it joins with one tap. The tickets are the same for everyone, the league has its own standings with the tournament points. You can be in several leagues at once.</>,
    },
    {
      q: 'A postponed or suspended match?',
      a: <>The goals scored up to that moment on the ticket&apos;s matchday count. If the match is not played, it simply brings no goals.</>,
    },
  ],
}

export default async function RegolePage() {
  const { lingua, tx } = await txServer()
  const en = lingua === 'en'
  const facoltativo = <span className="text-xs font-normal text-[var(--gold)]">{tx('facoltativo', 'optional')}</span>
  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">{tx('Come si gioca', 'How to play')}</span>
      <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">{tx('Regole', 'Rules')}</h1>
      <p className="text-[var(--muted)] mt-3">
        {en ? (
          <>Each ticket brings together <S>10 matches from the same matchday</S>. You do not have to guess the results:
          you have to guess <S>in which minutes the goals come</S>.</>
        ) : (
          <>Ogni schedina raccoglie <strong className="text-[var(--ink)]">10 partite della stessa giornata</strong>. Non devi indovinare i risultati:
          devi indovinare <strong className="text-[var(--ink)]">in quali minuti arrivano i gol</strong>.</>
        )}
      </p>

      <section className="glass rounded-2xl p-5 sm:p-6 mt-6 space-y-4">
        <div className="flex gap-3">
          <IconClock size={24} className="text-[var(--accent)] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold">{en ? <>1 · Pick 13 minutes, from 1&apos; to 90&apos;</> : <>1 · Scegli 13 minuti, dall&apos;1&apos; al 90&apos;</>}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{tx('I minuti in cui pensi che qualcuno segni, in una qualsiasi delle 10 partite.', 'The minutes in which you think someone will score, in any of the 10 matches.')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <IconPlus size={24} className="text-[var(--gold)] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold">2 · {tx('Recupero', 'Stoppage time')} {facoltativo}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{tx('Scegli se ci sarà un gol nel recupero del primo tempo oppure del secondo.', 'Choose whether there will be a goal in first-half or second-half stoppage time.')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <IconTrophy size={24} className="text-[var(--gold)] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold">3 · {tx('Prima e ultima squadra a segnare', 'First and last team to score')} {facoltativo}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{tx('Fra tutte le squadre in campo nella schedina.', 'Among all the teams playing on the ticket.')}</p>
          </div>
        </div>
      </section>

      <h2 className="font-display font-bold text-xl mt-8 mb-3">{tx('Punti', 'Points')}</h2>
      <div className="space-y-2">
        {PUNTI[lingua].map((r, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-4 py-3">
            <span className={`font-display font-extrabold text-2xl w-12 shrink-0 ${COLORE[i]}`}>{r.p}</span>
            <span className="text-sm text-[var(--ink)]">{r.t}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">
        {en ? (
          <>Knockout tickets have one more bonus: <S>+5</S> if you guess whether at least one match will go to extra time.
          League matchdays do not have it.</>
        ) : (
          <>Nelle schedine a eliminazione diretta c&apos;è un bonus in più: <strong className="text-[var(--ink)]">+5</strong> se indovini se almeno una partita andrà ai supplementari.
          Nelle giornate di campionato non c&apos;è.</>
        )}
      </p>
      <p className="text-xs text-[var(--muted)] mt-1">{tx('La classifica generale somma i punti di tutte le schedine del torneo.', 'The overall standings add up the points of all the tickets in the tournament.')}</p>

      <h2 className="font-display font-bold text-xl mt-8 mb-3">{tx('Domande frequenti', 'Frequently asked questions')}</h2>
      <div className="space-y-2">
        {FAQ[lingua].map(f => (
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
        <Link href="/schedine" className="btn-primary px-8 py-3.5">{tx('Vai alle schedine →', 'Go to the tickets →')}</Link>
      </div>
    </div>
  )
}
