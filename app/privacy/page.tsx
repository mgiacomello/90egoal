import type { Metadata } from 'next'
import Link from 'next/link'
import { TITOLARE, PRIVACY_VERSIONE } from '@/lib/privacy'

export const metadata: Metadata = { title: 'Informativa privacy — 90 & Goal' }

const SEZIONI: { t: string; c: React.ReactNode }[] = [
  {
    t: '1. Chi tratta i tuoi dati',
    c: <p>Il titolare del trattamento è <strong>{TITOLARE.nome}</strong>, con sede in {TITOLARE.indirizzo}. Per qualsiasi richiesta sui tuoi dati puoi scrivere al titolare a questo indirizzo.</p>,
  },
  {
    t: '2. Quali dati raccogliamo',
    c: (
      <ul>
        <li><strong>Dati di registrazione:</strong> nome e cognome, nickname, indirizzo email e password. La password è conservata in forma cifrata e non è leggibile da nessuno.</li>
        <li><strong>Dati di gioco:</strong> le schedine che giochi, i minuti e i bonus scelti, i punti, la posizione in classifica e le leghe tra amici a cui partecipi.</li>
        <li><strong>Dati di utilizzo:</strong> quando apri e invii una schedina, quanto tempo impieghi a compilarla e le pagine che visiti mentre hai fatto l&apos;accesso. Servono a capire come viene usato il gioco e a migliorarlo.</li>
        <li><strong>Notifiche, solo se le attivi:</strong> l&apos;identificativo tecnico del tuo dispositivo fornito dal browser, il tipo di browser e la tua preferenza sulle notifiche.</li>
        <li><strong>Assistente del gioco:</strong> le domande che scrivi all&apos;assistente.</li>
      </ul>
    ),
  },
  {
    t: '3. Perché li trattiamo e su quale base',
    c: (
      <ul>
        <li><strong>Per farti giocare:</strong> creare l&apos;account, registrare le schedine, calcolare i punti e mostrare le classifiche. La base è l&apos;esecuzione del servizio che hai chiesto registrandoti.</li>
        <li><strong>Per inviarti le notifiche:</strong> solo con il tuo consenso, che dai attivandole e che puoi togliere quando vuoi dal Profilo o dalle impostazioni del dispositivo.</li>
        <li><strong>Per migliorare e proteggere il gioco:</strong> statistiche d&apos;uso e controlli contro gli abusi. La base è il legittimo interesse del titolare a far funzionare bene il servizio.</li>
        <li><strong>Per rispettare la legge:</strong> quando una norma o un&apos;autorità lo richiede.</li>
      </ul>
    ),
  },
  {
    t: '4. Cosa vedono gli altri giocatori',
    c: <p>Nelle classifiche e nelle leghe gli altri giocatori che hanno fatto l&apos;accesso vedono il tuo <strong>nickname</strong>, i tuoi punti e, a giornata chiusa, i minuti che hai indovinato. Il nome e cognome che inserisci alla registrazione è visibile agli altri giocatori accanto al nickname: se preferisci non mostrarlo, scegli un nickname che non ti identifichi e indica solo il nome. La tua email non è mai visibile agli altri giocatori.</p>,
  },
  {
    t: '5. A chi comunichiamo i dati',
    c: (
      <>
        <p>I dati non vengono venduti né ceduti a terzi per fini di marketing. Li trattano, per conto del titolare e solo per far funzionare il servizio, questi fornitori:</p>
        <ul>
          <li><strong>Supabase</strong>, per il database e l&apos;accesso con email e password;</li>
          <li><strong>Vercel</strong>, per l&apos;ospitalità del sito;</li>
          <li><strong>i servizi di notifica del tuo browser o dispositivo</strong> (ad esempio Apple, Google, Mozilla), se attivi le notifiche;</li>
          <li><strong>Groq</strong>, per l&apos;assistente del gioco: riceve il testo della tua domanda e i dati pubblici di gioco, come risultati e nickname dei primi in classifica.</li>
        </ul>
        <p>Alcuni di questi fornitori possono trattare i dati anche fuori dall&apos;Unione Europea. In quel caso il trasferimento avviene con le garanzie previste dal Regolamento (UE) 2016/679, come le clausole contrattuali standard approvate dalla Commissione Europea.</p>
      </>
    ),
  },
  {
    t: '6. Per quanto tempo li conserviamo',
    c: <p>Conserviamo i dati finché hai un account. Se chiedi la cancellazione, eliminiamo l&apos;account con le schedine, i punti, le leghe e i dati di utilizzo collegati, salvo ciò che la legge ci obbliga a conservare. I dati di utilizzo possono essere tenuti più a lungo solo in forma aggregata e anonima.</p>,
  },
  {
    t: '7. Cookie e dati salvati sul dispositivo',
    c: <p>Il gioco usa solo cookie tecnici, necessari per tenerti collegato dopo l&apos;accesso. Non usa cookie di profilazione né pubblicità. Sul tuo dispositivo salva inoltre alcune preferenze, come la schedina di prova giocata senza account: restano sul telefono e puoi cancellarle dalle impostazioni del browser.</p>,
  },
  {
    t: '8. I tuoi diritti',
    c: (
      <>
        <p>In ogni momento puoi chiedere al titolare di:</p>
        <ul>
          <li>sapere quali dati abbiamo su di te e riceverne una copia;</li>
          <li>correggerli o aggiornarli;</li>
          <li>cancellarli, o limitarne il trattamento;</li>
          <li>opporti al trattamento basato sul legittimo interesse;</li>
          <li>ricevere i dati in un formato leggibile da un altro servizio;</li>
          <li>revocare un consenso già dato, senza effetti su ciò che è stato fatto prima.</li>
        </ul>
        <p>Per esercitare questi diritti scrivi a {TITOLARE.nome}, {TITOLARE.indirizzo}. Se ritieni che il trattamento violi la legge puoi presentare reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">garanteprivacy.it</a>).</p>
      </>
    ),
  },
  {
    t: '9. Età minima',
    c: <p>Il gioco è gratuito, senza premi in denaro e senza scommesse. Per registrarsi bisogna avere almeno 14 anni. Chi ha meno di 14 anni può usare il servizio solo con il consenso di chi esercita la responsabilità genitoriale.</p>,
  },
  {
    t: '10. Sei obbligato a darci i dati?',
    c: <p>I dati di registrazione sono necessari: senza non possiamo creare l&apos;account né metterti in classifica. Puoi comunque provare una schedina senza registrarti. Le notifiche sono facoltative.</p>,
  },
  {
    t: '11. Modifiche a questa informativa',
    c: <p>Se l&apos;informativa cambia in modo sostanziale lo segnaliamo nel gioco. La versione in vigore è sempre quella pubblicata su questa pagina.</p>,
  },
]

export default function PrivacyPage() {
  const [a, m, g] = PRIVACY_VERSIONE.split('-')
  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display font-bold text-2xl sm:text-3xl">Informativa privacy</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        Come 90 &amp; Goal tratta i tuoi dati personali, ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679. Versione del {g}/{m}/{a}.
      </p>

      <div className="mt-6 space-y-6">
        {SEZIONI.map(s => (
          <section key={s.t}>
            <h2 className="font-display font-bold text-lg mb-2">{s.t}</h2>
            <div className="text-sm text-[var(--ink)]/85 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[var(--ink)]">{s.c}</div>
          </section>
        ))}
      </div>

      <div className="mt-8 border-t border-[var(--line)] pt-5 text-sm flex gap-4">
        <Link href="/" className="text-[var(--accent-soft)] hover:underline">← Torna al gioco</Link>
        <Link href="/regole" className="text-[var(--muted)] hover:text-[var(--ink)]">Regole</Link>
      </div>
    </div>
  )
}
