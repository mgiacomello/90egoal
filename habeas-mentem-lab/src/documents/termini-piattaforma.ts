export const termini = `
1. Oggetto

I presenti Termini di servizio ("Termini") disciplinano l'accesso e l'utilizzo della piattaforma digitale "Orbita" (la "Piattaforma") messa a disposizione da Orbita Digital S.p.A. (il "Fornitore"). L'utilizzo della Piattaforma comporta l'accettazione integrale dei Termini. Qualora l'utente non intenda accettare i Termini, è tenuto ad astenersi dall'utilizzo della Piattaforma.

2. Registrazione e account

Per accedere ad alcune funzionalità è necessario creare un account fornendo informazioni veritiere, complete e aggiornate. L'utente è responsabile della riservatezza delle credenziali e di ogni attività compiuta tramite il proprio account. Il Fornitore si riserva la facoltà di sospendere o chiudere l'account, a propria discrezione e senza preavviso, in caso di violazione dei Termini o di condotte che, a giudizio del Fornitore, possano arrecare pregiudizio alla Piattaforma o a terzi.

3. Licenza sui contenuti dell'utente

Caricando contenuti sulla Piattaforma, l'utente concede al Fornitore una licenza mondiale, non esclusiva, gratuita, sublicenziabile e trasferibile, per utilizzare, riprodurre, modificare, adattare, pubblicare, tradurre, creare opere derivate, distribuire ed esibire tali contenuti, con qualsiasi mezzo e su qualsiasi supporto, anche a fini promozionali e di addestramento di sistemi di intelligenza artificiale, per tutta la durata dei diritti d'autore. La licenza permane anche successivamente alla chiusura dell'account limitatamente ai contenuti già condivisi con altri utenti o già utilizzati dal Fornitore.

4. Corrispettivi e rinnovo automatico

I servizi a pagamento sono offerti in abbonamento. Salvo disdetta comunicata almeno trenta giorni prima della scadenza, l'abbonamento si rinnova automaticamente per un periodo di pari durata, al prezzo in vigore al momento del rinnovo, che il Fornitore potrà aggiornare dandone comunicazione con almeno quindici giorni di preavviso. La disdetta è esercitabile esclusivamente tramite l'apposita sezione delle impostazioni dell'account. Non è previsto alcun rimborso per i periodi già fatturati.

5. Limitazione di responsabilità

Nella misura massima consentita dalla legge applicabile, il Fornitore non risponde di danni indiretti, consequenziali, perdita di profitto, perdita di dati o interruzione dell'attività derivanti dall'uso o dall'impossibilità di uso della Piattaforma. In ogni caso, la responsabilità complessiva del Fornitore non potrà eccedere l'importo corrisposto dall'utente nei dodici mesi precedenti l'evento che ha originato la pretesa. Nulla nei Termini esclude o limita la responsabilità per dolo o colpa grave, né i diritti inderogabili riconosciuti ai consumatori.

6. Modifiche ai Termini

Il Fornitore può modificare i Termini in qualsiasi momento. Le modifiche sostanziali sono comunicate con almeno quindici giorni di preavviso tramite e-mail o avviso sulla Piattaforma. La prosecuzione dell'utilizzo dopo l'entrata in vigore delle modifiche ne costituisce accettazione. L'utente che non intenda accettare le modifiche può recedere chiudendo l'account prima della loro entrata in vigore.

7. Legge applicabile e foro competente

I Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente in via esclusiva il Foro di Milano, fatta salva, per gli utenti consumatori, la competenza inderogabile del foro del luogo di residenza o domicilio. Gli utenti consumatori possono altresì ricorrere alla piattaforma europea per la risoluzione delle controversie online.
`;

import type { Question, Task } from "../session/model";

export const terminiQuestions: Question[] = [
  {
    id: "q1",
    clauseId: "c4",
    prompt: "Entro quando devi disdire l'abbonamento per evitare il rinnovo automatico?",
    options: ["Entro il giorno della scadenza", "Almeno quindici giorni prima", "Almeno trenta giorni prima", "In qualsiasi momento, con rimborso del periodo residuo"],
    correctIndex: 2,
  },
  {
    id: "q2",
    clauseId: "c3",
    prompt: "Caricando un contenuto sulla Piattaforma, concedi al Fornitore il diritto di usarlo anche per addestrare sistemi di intelligenza artificiale?",
    options: ["No, solo per mostrarlo agli altri utenti", "Sì, e la licenza è gratuita e sublicenziabile", "Sì, ma solo finché l'account resta aperto", "Solo se lo autorizzi caso per caso"],
    correctIndex: 1,
  },
  {
    id: "q3",
    clauseId: "c5",
    prompt: "Qual è il tetto massimo alla responsabilità del Fornitore verso di te?",
    options: ["Nessun tetto", "Il prezzo dell'ultimo mese", "Quanto hai pagato nei dodici mesi precedenti", "Il doppio di quanto hai pagato in totale"],
    correctIndex: 2,
  },
];

export const terminiTasks: Task[] = [
  { id: "t1", clauseId: "c4", prompt: "Vuoi disdire l'abbonamento. Trova la clausola che dice dove e come si fa." },
  { id: "t2", clauseId: "c7", prompt: "Sei un consumatore e vuoi fare causa. Trova la clausola che dice davanti a quale giudice puoi andare." },
];
