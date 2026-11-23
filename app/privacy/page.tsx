import type { Metadata } from 'next'
import Link from 'next/link'
import { TITOLARE, PRIVACY_VERSIONE } from '@/lib/privacy'
import { linguaServer, txServer } from '@/lib/lingua.server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await linguaServer()) === 'en' ? 'Privacy notice — 90 & Goal' : 'Informativa privacy — 90 & Goal' }
}

const SEZIONI: { t: string; c: React.ReactNode }[] = [
  {
    t: '1. Chi tratta i tuoi dati',
    c: <p>Il titolare del trattamento è <strong>{TITOLARE.nome}</strong>, con sede in {TITOLARE.indirizzo}. Per qualsiasi richiesta sui tuoi dati puoi scrivere a <a href={`mailto:${TITOLARE.email}`} className="underline">{TITOLARE.email}</a> o al titolare all&apos;indirizzo qui sopra.</p>,
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
    c: <p>Il gioco usa solo cookie tecnici, necessari per tenerti collegato dopo l&apos;accesso e per ricordare la lingua che hai scelto. Non usa cookie di profilazione né pubblicità. Sul tuo dispositivo salva inoltre alcune preferenze, come la schedina di prova giocata senza account: restano sul telefono e puoi cancellarle dalle impostazioni del browser.</p>,
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
        <p>Per esercitare questi diritti scrivi a <a href={`mailto:${TITOLARE.email}`} className="underline">{TITOLARE.email}</a>, oppure a {TITOLARE.nome}, {TITOLARE.indirizzo}. Se ritieni che il trattamento violi la legge puoi presentare reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">garanteprivacy.it</a>).</p>
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

const MAIL = <a href={`mailto:${TITOLARE.email}`} className="underline">{TITOLARE.email}</a>

// Traduzione di cortesia: il testo che fa fede è quello italiano.
const SECTIONS: { t: string; c: React.ReactNode }[] = [
  {
    t: '1. Who processes your data',
    c: <p>The data controller is <strong>{TITOLARE.nome}</strong>, with registered office at {TITOLARE.indirizzo}. For any request about your data you can write to {MAIL} or to the controller at the address above.</p>,
  },
  {
    t: '2. What data we collect',
    c: (
      <ul>
        <li><strong>Registration data:</strong> first and last name, nickname, email address and password. The password is stored in encrypted form and cannot be read by anyone.</li>
        <li><strong>Game data:</strong> the tickets you play, the minutes and bonuses you pick, your points, your place in the standings and the leagues with friends you take part in.</li>
        <li><strong>Usage data:</strong> when you open and send a ticket, how long you take to fill it in and the pages you visit while signed in. We use them to understand how the game is used and to improve it.</li>
        <li><strong>Notifications, only if you turn them on:</strong> the technical identifier of your device provided by the browser, the type of browser and your notification preference.</li>
        <li><strong>Game assistant:</strong> the questions you write to the assistant.</li>
      </ul>
    ),
  },
  {
    t: '3. Why we process them and on what basis',
    c: (
      <ul>
        <li><strong>To let you play:</strong> creating the account, recording tickets, calculating points and showing the standings. The basis is the performance of the service you asked for by signing up.</li>
        <li><strong>To send you notifications:</strong> only with your consent, which you give by turning them on and can withdraw at any time from your Profile or from your device settings.</li>
        <li><strong>To improve and protect the game:</strong> usage statistics and checks against abuse. The basis is the controller&apos;s legitimate interest in making the service work well.</li>
        <li><strong>To comply with the law:</strong> when a rule or an authority requires it.</li>
      </ul>
    ),
  },
  {
    t: '4. What other players see',
    c: <p>In the standings and in leagues, other signed-in players see your <strong>nickname</strong>, your points and, once the matchday is closed, the minutes you guessed. The first and last name you enter when signing up is visible to other players next to your nickname: if you prefer not to show it, choose a nickname that does not identify you and enter your first name only. Your email is never visible to other players.</p>,
  },
  {
    t: '5. Who we share the data with',
    c: (
      <>
        <p>The data are not sold or passed on to third parties for marketing purposes. They are processed, on behalf of the controller and only to make the service work, by these providers:</p>
        <ul>
          <li><strong>Supabase</strong>, for the database and sign-in with email and password;</li>
          <li><strong>Vercel</strong>, for hosting the site;</li>
          <li><strong>the notification services of your browser or device</strong> (for example Apple, Google, Mozilla), if you turn on notifications;</li>
          <li><strong>Groq</strong>, for the game assistant: it receives the text of your question and public game data, such as results and the nicknames of the players at the top of the standings.</li>
        </ul>
        <p>Some of these providers may process the data outside the European Union as well. In that case the transfer takes place with the safeguards laid down by Regulation (EU) 2016/679, such as the standard contractual clauses approved by the European Commission.</p>
      </>
    ),
  },
  {
    t: '6. How long we keep them',
    c: <p>We keep the data for as long as you have an account. If you ask for erasure, we delete the account with the related tickets, points, leagues and usage data, except for what the law requires us to keep. Usage data may be kept longer only in aggregate and anonymous form.</p>,
  },
  {
    t: '7. Cookies and data saved on your device',
    c: <p>The game only uses technical cookies, needed to keep you signed in and to remember the language you chose. It does not use profiling cookies or advertising. It also saves some preferences on your device, such as the trial ticket played without an account: they stay on your phone and you can delete them from your browser settings.</p>,
  },
  {
    t: '8. Your rights',
    c: (
      <>
        <p>At any time you can ask the controller to:</p>
        <ul>
          <li>know what data we hold about you and receive a copy;</li>
          <li>correct or update them;</li>
          <li>erase them, or restrict their processing;</li>
          <li>object to processing based on legitimate interest;</li>
          <li>receive the data in a format another service can read;</li>
          <li>withdraw a consent already given, without affecting what was done before.</li>
        </ul>
        <p>To exercise these rights write to {MAIL}, or to {TITOLARE.nome}, {TITOLARE.indirizzo}. If you believe the processing breaches the law you can lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">garanteprivacy.it</a>).</p>
      </>
    ),
  },
  {
    t: '9. Minimum age',
    c: <p>The game is free, with no cash prizes and no betting. You must be at least 14 years old to sign up. Anyone under 14 may use the service only with the consent of the person holding parental responsibility.</p>,
  },
  {
    t: '10. Do you have to give us your data?',
    c: <p>Registration data are necessary: without them we cannot create the account or put you in the standings. You can still try a ticket without signing up. Notifications are optional.</p>,
  },
  {
    t: '11. Changes to this notice',
    c: <p>If the notice changes in a substantial way we will point it out in the game. The version in force is always the one published on this page.</p>,
  },
]

export default async function PrivacyPage() {
  const { lingua, tx } = await txServer()
  const en = lingua === 'en'
  const [a, m, g] = PRIVACY_VERSIONE.split('-')
  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <h1 className="font-display font-bold text-2xl sm:text-3xl">{tx('Informativa privacy', 'Privacy notice')}</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        {en
          ? <>How 90 &amp; Goal processes your personal data, under Articles 13 and 14 of Regulation (EU) 2016/679. Version of {g}/{m}/{a}.</>
          : <>Come 90 &amp; Goal tratta i tuoi dati personali, ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679. Versione del {g}/{m}/{a}.</>}
      </p>
      {en && <p className="text-xs text-[var(--muted)] mt-2">This is a courtesy translation. If the two versions differ, the Italian text prevails.</p>}

      <div className="mt-6 space-y-6">
        {(en ? SECTIONS : SEZIONI).map(s => (
          <section key={s.t}>
            <h2 className="font-display font-bold text-lg mb-2">{s.t}</h2>
            <div className="text-sm text-[var(--ink)]/85 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[var(--ink)]">{s.c}</div>
          </section>
        ))}
      </div>

      <div className="mt-8 border-t border-[var(--line)] pt-5 text-sm flex gap-4">
        <Link href="/" className="text-[var(--accent-soft)] hover:underline">{tx('← Torna al gioco', '← Back to the game')}</Link>
        <Link href="/regole" className="text-[var(--muted)] hover:text-[var(--ink)]">{tx('Regole', 'Rules')}</Link>
      </div>
    </div>
  )
}
