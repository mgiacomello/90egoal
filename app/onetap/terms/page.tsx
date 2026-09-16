import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/onetap/LegalPage'
import { LEGAL } from '@/lib/onetap/legal'
import { FREE_ACTIONS_PER_MONTH } from '@/lib/onetap/storage'

export const metadata: Metadata = {
  title: 'Termini d’uso — ONE TAP',
  description: 'Le regole d’uso di ONE TAP: cosa fa, cosa non garantisce, cosa resta a carico tuo.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Termini d’uso"
      updated={LEGAL.updated}
      intro={
        <p>
          ONE TAP è un servizio di <strong className="text-white">{LEGAL.owner}</strong>. Usandolo
          accetti queste condizioni. Sono corte perché il servizio è semplice: legge un&apos;immagine,
          propone un&apos;azione, e l&apos;azione la decidi tu.
        </p>
      }
    >
      <Section title="Cosa fa ONE TAP">
        <p>
          Trascrive il testo di una foto o di uno screenshot, riconosce numeri, indirizzi, date,
          contatti e testi, e prepara un&apos;azione da eseguire con le app del tuo telefono:
          chiamare, scrivere, navigare, aggiungere a calendario o rubrica, salvare una nota,
          cercare, tradurre.
        </p>
      </Section>

      <Section title="Sei tu a controllare prima di agire">
        <p>
          La lettura è affidata a un modello di intelligenza artificiale e a un riconoscimento
          automatico del testo. <strong>Può sbagliare</strong>: una cifra, una lettera, una data.
          ONE TAP mostra sempre cosa ha letto prima che tu esegua l&apos;azione, e su un contenuto
          incerto lo dice.
        </p>
        <p>
          Per questo, prima di chiamare un numero, inviare un messaggio, effettuare un bonifico
          verso un IBAN copiato, seguire un indirizzo o usare un codice, <strong>verifica il dato
          con la fonte</strong>. La responsabilità di ciò che fai con l&apos;azione proposta è tua.
        </p>
      </Section>

      <Section title="Uso consentito">
        <ul>
          <li>Puoi usare ONE TAP per scopi personali e professionali leciti.</li>
          <li>
            Non caricare immagini di cui non hai il diritto di disporre, né contenuti illeciti,
            offensivi o che violino la privacy o i diritti di altre persone.
          </li>
          <li>
            Non usare il servizio per raccogliere dati in modo massivo, per aggirare i limiti
            tecnici o per interferire con il suo funzionamento.
          </li>
        </ul>
      </Section>

      <Section title="Piano gratuito e piano Pro">
        <p>
          Il piano gratuito comprende {FREE_ACTIONS_PER_MONTH} azioni al mese per dispositivo.
          Un eventuale piano Pro, con azioni illimitate, viene proposto dentro all&apos;app con
          prezzo, durata e condizioni di recesso indicati al momento dell&apos;acquisto. Finché non
          lo attivi, non paghi nulla.
        </p>
      </Section>

      <Section title="Disponibilità e modifiche">
        <p>
          ONE TAP è fornita &laquo;così com&apos;è&raquo;. Possiamo cambiarla, sospenderla o interromperla,
          anche per limiti dei fornitori di cui si serve. Facciamo il possibile perché funzioni
          sempre, ma non garantiamo che sia priva di errori o sempre raggiungibile.
        </p>
      </Section>

      <Section title="Limitazione di responsabilità">
        <p>
          Nei limiti consentiti dalla legge, {LEGAL.owner} non risponde dei danni indiretti o
          derivanti dall&apos;affidamento su una lettura errata, da un&apos;azione aperta in un&apos;app
          terza o dall&apos;indisponibilità del servizio. Nulla in questi termini limita i diritti
          che la legge riconosce ai consumatori.
        </p>
      </Section>

      <Section title="Proprietà intellettuale">
        <p>
          Il nome ONE TAP, il logo, il design e il software sono di {LEGAL.owner}. Le immagini
          che carichi e il testo che ne esce restano tuoi: ci concedi solo il permesso tecnico di
          elaborarli per darti il risultato.
        </p>
      </Section>

      <Section title="Legge applicabile e foro">
        <p>
          Si applica la legge italiana. Per le controversie con consumatori è competente il foro
          del luogo di residenza o domicilio del consumatore; negli altri casi il foro della sede
          di {LEGAL.owner}.
        </p>
      </Section>

      <Section title="Contatti">
        <p>Per domande su questi termini: {LEGAL.email}</p>
      </Section>
    </LegalPage>
  )
}
