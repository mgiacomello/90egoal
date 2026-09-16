import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/onetap/LegalPage'
import { LEGAL } from '@/lib/onetap/legal'

export const metadata: Metadata = {
  title: 'Privacy — ONE TAP',
  description: 'Cosa fa ONE TAP con le tue foto e i tuoi dati: niente archivi, niente profili, niente training.',
  robots: { index: true, follow: true },
}

// Ogni frase qui sotto descrive quello che il codice fa davvero. Se cambia il
// codice, cambia questa pagina: un'informativa che promette più del software
// è un rischio, non una tutela.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated={LEGAL.updated}
      intro={
        <p>
          ONE TAP legge quello che fotografi e ti propone un&apos;azione. Per farlo non ha bisogno di
          conoscerti: <strong className="text-white">niente account, niente profilo, niente archivio
          delle tue foto</strong>. Questa pagina spiega, senza giri di parole, quali dati passano di
          qui e dove finiscono.
        </p>
      }
    >
      <Section title="Titolare del trattamento">
        <p>{LEGAL.owner}</p>
        <p>Contatto: {LEGAL.email}</p>
      </Section>

      <Section title="Cosa tratta ONE TAP e perché">
        <ul>
          <li>
            <strong>La foto o lo screenshot che scegli tu.</strong>{' '}Viene ridotta nel tuo browser
            (1400 px sul lato lungo), inviata una volta al modello di lettura per trascriverne il
            testo e scartata. Serve solo a produrre l&apos;azione che ti viene proposta.
          </li>
          <li>
            <strong>Il testo letto.</strong>{' '}Numeri, indirizzi, date, nomi che compaiono nell&apos;immagine.
            Resta nel tuo dispositivo, dentro alla cronologia locale, finché non la cancelli.
          </li>
          <li>
            <strong>Il tuo indirizzo IP</strong>, usato solo in memoria e per pochi minuti per
            limitare il numero di richieste e proteggere il servizio dagli abusi. Non viene
            registrato.
          </li>
        </ul>
        <p>
          Base giuridica: l&apos;esecuzione del servizio che richiedi con ogni cattura (art. 6.1.b GDPR)
          e il legittimo interesse a proteggere il servizio dagli abusi (art. 6.1.f GDPR).
        </p>
      </Section>

      <Section title="Dove vanno le immagini">
        <p>
          Per leggere il testo nella foto ONE TAP usa un modello di intelligenza artificiale
          fornito da <strong>{LEGAL.aiProvider}</strong>, che agisce come responsabile del
          trattamento. L&apos;immagine gli viene trasmessa cifrata, viene elaborata per rispondere e
          non viene usata per addestrare modelli. Il fornitore può conservarla per un periodo
          limitato ai soli fini di sicurezza e prevenzione degli abusi, secondo le proprie
          condizioni per l&apos;uso via API. Il trasferimento verso gli Stati Uniti avviene sulla base
          delle clausole contrattuali standard e delle garanzie previste dal fornitore.
        </p>
        <p>
          I codici QR e i codici a barre vengono letti direttamente dal tuo browser, quando può:
          in quel caso non parte nulla.
        </p>
      </Section>

      <Section title="Cosa non facciamo">
        <ul>
          <li>Non salviamo le tue foto su nessun server, disco, database o registro.</li>
          <li>Non creiamo un profilo su di te e non incrociamo i tuoi dati con altri servizi.</li>
          <li>Non usiamo cookie di tracciamento né strumenti di analisi di terze parti.</li>
          <li>Non vendiamo né cediamo dati a nessuno.</li>
          <li>Non usiamo il tuo contenuto per addestrare modelli.</li>
        </ul>
      </Section>

      <Section title="Cosa resta sul tuo dispositivo">
        <p>
          La cronologia delle catture, le azioni eseguite e il contatore mensile vivono nella
          memoria locale del tuo browser. Non esiste una copia altrove e nessuno può leggerli da
          remoto. Il pulsante <strong>Delete everything</strong>{' '}nel pannello &laquo;Your data&raquo; li
          cancella davvero e subito.
        </p>
      </Section>

      <Section title="Fotocamera e foto">
        <p>
          ONE TAP chiede l&apos;accesso alla fotocamera o alle foto solo quando tocchi il pulsante
          corrispondente, e usa soltanto l&apos;immagine che scegli. Puoi revocare il permesso in
          qualsiasi momento dalle impostazioni del telefono o del browser.
        </p>
      </Section>

      <Section title="Le azioni che apri">
        <p>
          Quando tocchi ONE TAP si apre un&apos;app del tuo telefono: Telefono, Messaggi, WhatsApp,
          Mail, Mappe, Calendario, Note, il browser. Da quel momento vale l&apos;informativa di
          quell&apos;app. ONE TAP non sa cosa fai dopo.
        </p>
      </Section>

      <Section title="I tuoi diritti">
        <p>
          Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti al
          trattamento scrivendo a {LEGAL.email}. Hai diritto di proporre reclamo al Garante per la
          protezione dei dati personali. In pratica, però, i dati di cui parla questa pagina non li
          conserviamo: quello che vedi nella cronologia lo cancelli tu, da solo, in un tocco.
        </p>
      </Section>

      <Section title="Minori">
        <p>ONE TAP è pensata per persone di almeno 16 anni.</p>
      </Section>

      <Section title="Modifiche">
        <p>
          Se cambia il modo in cui ONE TAP tratta i dati, cambia questa pagina e cambia la data
          in alto. Le modifiche sostanziali vengono segnalate dentro all&apos;app.
        </p>
      </Section>
    </LegalPage>
  )
}
