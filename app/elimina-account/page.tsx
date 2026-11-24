import type { Metadata } from 'next'
import Link from 'next/link'
import { TITOLARE } from '@/lib/privacy'
import { linguaServer, txServer } from '@/lib/lingua.server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await linguaServer()) === 'en' ? 'Delete your account — 90 & Goal' : 'Eliminare l’account — 90 & Goal' }
}

// Pagina pubblica: spiega come cancellare account e dati, anche a chi non ha l'app sotto mano.
// È l'indirizzo che gli store chiedono per le richieste di eliminazione.
export default async function EliminaAccountPage() {
  const { tx } = await txServer()
  const mail = <a href={`mailto:${TITOLARE.email}`} className="underline">{TITOLARE.email}</a>
  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display font-bold text-2xl sm:text-3xl">{tx('Eliminare l’account', 'Delete your account')}</h1>
      <p className="text-sm text-[var(--muted)] mt-1">{tx('Come cancellare il tuo account di 90 & Goal e i dati collegati.', 'How to delete your 90 & Goal account and the related data.')}</p>

      <div className="mt-6 space-y-6 text-sm text-[var(--ink)]/85 leading-relaxed [&_strong]:text-[var(--ink)]">
        <section>
          <h2 className="font-display font-bold text-lg mb-2">{tx('Dall’app, in un minuto', 'From the app, in a minute')}</h2>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>{tx('Fai l’accesso con la tua email e la tua password.', 'Sign in with your email and password.')}</li>
            <li>{tx('Apri il Profilo e scorri fino in fondo.', 'Open your Profile and scroll to the bottom.')}</li>
            <li>{tx('Tocca “Elimina il mio account” e conferma scrivendo il tuo nickname.', 'Tap “Delete my account” and confirm by typing your nickname.')}</li>
          </ol>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg mb-2">{tx('Senza fare l’accesso', 'Without signing in')}</h2>
          <p>{tx('Scrivi a', 'Write to')} {mail} {tx('dall’indirizzo email con cui ti sei registrato, chiedendo l’eliminazione. Rispondiamo entro 30 giorni.', 'from the email address you signed up with, asking for deletion. We reply within 30 days.')}</p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg mb-2">{tx('Cosa viene cancellato', 'What is deleted')}</h2>
          <p>{tx('Subito e per sempre: nome, nickname, email e password, le schedine giocate e i punti, le leghe che hai creato e le tue iscrizioni alle altre, le preferenze sulle notifiche e i dati di utilizzo collegati all’account.',
                'Immediately and for good: name, nickname, email and password, the tickets you played and your points, the leagues you created and your memberships in the others, your notification preferences and the usage data linked to the account.')}</p>
          <p className="mt-2">{tx('Restano solo statistiche aggregate e anonime, che non permettono di risalire a te, e ciò che la legge ci obbliga a conservare.',
                'Only aggregate and anonymous statistics remain, which cannot be traced back to you, along with anything the law requires us to keep.')}</p>
        </section>
      </div>

      <div className="mt-8 border-t border-[var(--line)] pt-5 text-sm flex gap-4">
        <Link href="/profilo" className="text-[var(--accent-soft)] hover:underline">{tx('Vai al Profilo →', 'Go to your Profile →')}</Link>
        <Link href="/privacy" className="text-[var(--muted)] hover:text-[var(--ink)]">{tx('Informativa privacy', 'Privacy notice')}</Link>
      </div>
    </div>
  )
}
