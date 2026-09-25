export const cookie = `
Che cosa sono i cookie

I cookie sono piccoli file di testo che i siti visitati inviano al dispositivo dell'utente, dove vengono memorizzati per essere ritrasmessi agli stessi siti alla visita successiva. Oltre ai cookie, il presente sito utilizza tecnologie analoghe quali pixel, tag, identificativi di dispositivo e local storage (di seguito, congiuntamente, "cookie").

Cookie tecnici

I cookie tecnici sono necessari al funzionamento del sito e all'erogazione del servizio richiesto dall'utente. Non richiedono il consenso e comprendono i cookie di sessione, i cookie di autenticazione, i cookie di preferenza e i cookie di bilanciamento del carico. La loro disattivazione può compromettere la navigazione.

Cookie analitici

I cookie analitici sono utilizzati per raccogliere informazioni aggregate sul numero di visitatori e sulle modalità di utilizzo del sito. Ove i cookie analitici siano forniti da terze parti e non siano adottate misure di minimizzazione idonee a ridurre il potere identificativo, essi sono assimilati ai cookie di profilazione e richiedono il consenso dell'utente.

Cookie di profilazione e di terze parti

I cookie di profilazione sono volti a creare profili relativi all'utente e vengono utilizzati al fine di inviare messaggi pubblicitari in linea con le preferenze manifestate nel corso della navigazione. Il sito consente inoltre a partner terzi, elencati nel pannello delle preferenze, di installare i propri cookie per finalità di advertising personalizzato, misurazione delle campagne e integrazione con i social network. Tali partner agiscono in qualità di titolari autonomi del trattamento e le loro informative sono consultabili tramite i collegamenti resi disponibili nel pannello.

Come esprimere o revocare il consenso

Alla prima visita viene mostrato un banner che consente di accettare tutti i cookie, rifiutarli tutti o personalizzare le scelte. La chiusura del banner mediante la "X" comporta il mantenimento delle impostazioni predefinite, con l'installazione dei soli cookie tecnici. L'utente può modificare o revocare le scelte in qualsiasi momento tramite il collegamento "Preferenze cookie" presente a piè di pagina. Le scelte sono conservate per sei mesi, decorsi i quali il banner viene riproposto.

Durata

I cookie di sessione vengono cancellati alla chiusura del browser. I cookie persistenti hanno durata variabile, da alcuni giorni a un massimo di ventiquattro mesi, come indicato in dettaglio per ciascun cookie nel pannello delle preferenze.
`;

import type { Question, Task } from "../session/model";

export const cookieQuestions: Question[] = [
  {
    id: "q1",
    clauseId: "c5",
    prompt: "Se chiudi il banner con la \"X\" senza scegliere, quali cookie vengono installati?",
    options: ["Tutti", "Nessuno", "Solo quelli tecnici", "Quelli tecnici e analitici"],
    correctIndex: 2,
  },
  {
    id: "q2",
    clauseId: "c4",
    prompt: "Chi è responsabile dei cookie installati dai partner terzi per la pubblicità?",
    options: ["Il sito, come titolare unico", "I partner, come titolari autonomi", "Nessuno: sono anonimi", "Il browser dell'utente"],
    correctIndex: 1,
  },
  {
    id: "q3",
    clauseId: "c5",
    prompt: "Per quanto tempo il sito ricorda le tue scelte sui cookie prima di riproporre il banner?",
    options: ["Sei mesi", "Dodici mesi", "Ventiquattro mesi", "Per sempre"],
    correctIndex: 0,
  },
];

export const cookieTasks: Task[] = [
  { id: "t1", clauseId: "c5", prompt: "Hai accettato tutto per sbaglio e vuoi cambiare idea. Trova la clausola che dice dove si fa." },
  { id: "t2", clauseId: "c3", prompt: "Vuoi sapere se i cookie \"statistici\" richiedono il tuo consenso. Trova la clausola che lo spiega." },
];
