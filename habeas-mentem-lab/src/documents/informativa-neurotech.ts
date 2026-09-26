// Informativa privacy per un dispositivo di neurofeedback indossabile.
//
// Scritta come la scriverebbe uno studio serio per un produttore europeo nel
// 2026: artt. 13 e 14 GDPR, dati relativi alla salute (art. 9), Codice
// privacy italiano (d.lgs. 196/2003 come novellato dal d.lgs. 101/2018),
// Data Privacy Framework UE-USA, DPIA, Regolamento (UE) 2024/1689 sull'IA.
// Non è un documento di un'azienda esistente: la società, gli indirizzi e i
// recapiti sono di fantasia. La densità cambia da clausola a clausola, come
// nei documenti reali: alcune sono scritte per essere lette, altre per
// essere opponibili.

export const informativaNeurotech = `
1. Titolare del trattamento e responsabile della protezione dei dati

Questa informativa è resa ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") e del d.lgs. 196/2003 ("Codice privacy") da NeuroSense Technologies S.r.l., con sede legale in Via dei Sensori 12, 20124 Milano, codice fiscale e partita IVA 12345670154, iscritta al Registro delle imprese di Milano-Monza-Brianza-Lodi ("NeuroSense" o il "Titolare"). NeuroSense è il titolare del trattamento dei dati personali raccolti attraverso la fascia di neurofeedback "NeuroBand", l'applicazione mobile "NeuroBand App" per iOS e Android e l'area riservata del sito neuroband.example (insieme, i "Servizi"). Il Titolare ha nominato un responsabile della protezione dei dati (RPD/DPO), raggiungibile all'indirizzo dpo@neurosense.example e, per posta, presso la sede legale con la dicitura "all'attenzione del DPO". Versione 4.2 del 15 gennaio 2026; le versioni precedenti sono disponibili su richiesta.

2. Quali dati trattiamo e da dove provengono

Trattiamo le seguenti categorie di dati personali. (a) Dati di registrazione e account: nome, cognome, indirizzo e-mail, data di nascita, lingua, password in forma cifrata. (b) Dati tecnici e di utilizzo: modello e sistema operativo del telefono, identificativo dell'installazione, versione del firmware della fascia, indirizzo IP, registri di connessione Bluetooth, eventi d'uso dell'applicazione, segnalazioni di errore. (c) Segnali fisiologici acquisiti dai sensori della fascia: intensità luminosa riflessa nel rosso e nel vicino infrarosso da tre canali ottici posti sulla fronte, da cui si stimano le variazioni di emoglobina ossigenata e deossigenata nella corteccia prefrontale (spettroscopia funzionale nel vicino infrarosso, fNIRS), frequenza cardiaca, accelerazione e velocità angolare della testa, temperatura cutanea. (d) Dati derivati: punteggi di sessione, indici di attivazione, andamenti nel tempo, classificazioni e inferenze prodotte dai nostri algoritmi a partire dai segnali di cui alla lettera (c). (e) Dati di pagamento: gestiti dal prestatore di servizi di pagamento; NeuroSense riceve solo l'esito, l'importo e le ultime quattro cifre della carta. I dati di cui alle lettere (a) e (c) ci vengono forniti da te; quelli di cui alla lettera (b) sono generati dai Servizi; se colleghi Apple Health o Google Health Connect, riceviamo da tali piattaforme, con il tuo permesso, sonno e passi (art. 14 GDPR).

3. Perché trattiamo i dati e su quale base giuridica

I dati sono trattati per le finalità e sulle basi giuridiche che seguono. (i) Erogazione dei Servizi, gestione dell'account, assistenza e fatturazione: esecuzione del contratto ai sensi dell'art. 6, par. 1, lett. b), GDPR; per i segnali fisiologici e i dati derivati, che costituiscono dati relativi alla salute ai sensi dell'art. 4, n. 15, e del considerando 35 GDPR, il trattamento richiede in ogni caso il tuo consenso esplicito ai sensi dell'art. 9, par. 2, lett. a), GDPR, raccolto separatamente al primo avvio della fascia, in assenza del quale i Servizi di neurofeedback non possono essere erogati. (ii) Miglioramento dei Servizi, sicurezza informatica e prevenzione degli abusi: legittimo interesse del Titolare ai sensi dell'art. 6, par. 1, lett. f), GDPR, limitatamente ai dati di cui al punto 2, lettere (a) e (b); la valutazione comparativa degli interessi (LIA) è disponibile su richiesta al DPO. (iii) Addestramento e validazione degli algoritmi di elaborazione del segnale con i tuoi segnali fisiologici e dati derivati: esclusivamente previo consenso esplicito, distinto da quello di cui al punto (i) e revocabile in ogni momento, ai sensi degli artt. 6, par. 1, lett. a), e 9, par. 2, lett. a), GDPR; in mancanza, i segnali sono usati a tal fine soltanto dopo anonimizzazione irreversibile secondo i criteri del Parere 05/2014 del Gruppo di lavoro Articolo 29 e delle Linee guida EDPB in materia. (iv) Ricerca scientifica con università ed enti di ricerca: consenso esplicito ai sensi dell'art. 9, par. 2, lett. a), GDPR, ovvero, per i progetti approvati da un comitato etico, art. 9, par. 2, lett. j), GDPR, art. 89 GDPR e art. 110-bis del Codice privacy, con le garanzie ivi previste. (v) Comunicazioni commerciali su prodotti e servizi di NeuroSense: consenso ai sensi dell'art. 6, par. 1, lett. a), GDPR e dell'art. 130 del Codice privacy; per i clienti, e-mail su prodotti analoghi ai sensi dell'art. 130, comma 4, con possibilità di opporsi in ogni messaggio. (vi) Adempimento di obblighi di legge, contabili e fiscali: art. 6, par. 1, lett. c), GDPR. (vii) Accertamento, esercizio o difesa di un diritto in sede giudiziaria: art. 6, par. 1, lett. f), e art. 9, par. 2, lett. f), GDPR.

4. Dati relativi alla salute e dati neurali: le nostre regole

I segnali della fascia descrivono l'attività emodinamica del tuo cervello e sono, per noi, dati relativi alla salute a tutti gli effetti, anche quando la fascia non viene usata per finalità mediche. Per questo: chiediamo un consenso esplicito, separato e granulare, che puoi revocare dall'applicazione in qualsiasi momento; abbiamo svolto una valutazione d'impatto sulla protezione dei dati ai sensi dell'art. 35 GDPR, aggiornata a ogni modifica rilevante degli algoritmi, la cui sintesi è pubblicata su neuroband.example/dpia; i segnali sono cifrati sul telefono e in transito e sono conservati in forma pseudonimizzata, con chiavi separate dai dati identificativi; non comunichiamo mai segnali o dati derivati a datori di lavoro, assicurazioni, istituti di credito o piattaforme pubblicitarie, e non li usiamo per valutare la tua idoneità a un lavoro, a una polizza o a un credito. NeuroBand non è un dispositivo medico ai sensi del Regolamento (UE) 2017/745 e non fornisce diagnosi né terapie; il sistema di neurofeedback è stato valutato ai sensi del Regolamento (UE) 2024/1689 sull'intelligenza artificiale e non rientra tra i sistemi ad alto rischio. La fascia è destinata a persone maggiorenni.

5. Per quanto tempo conserviamo i dati

Applichiamo tempi di conservazione distinti per categoria. Dati di registrazione e account: per tutta la durata del rapporto e per i 12 mesi successivi alla chiusura dell'account, salvo i dati necessari alla fatturazione, conservati per 10 anni ai sensi dell'art. 2220 del codice civile e della normativa fiscale. Segnali fisiologici grezzi: 24 mesi dalla raccolta; alla scadenza vengono cancellati oppure resi anonimi in modo irreversibile. Dati derivati (punteggi e andamenti): finché l'account è attivo, così che tu possa consultare la tua storia; alla chiusura dell'account sono cancellati entro 30 giorni. Dati usati per l'addestramento degli algoritmi con il tuo consenso: fino alla revoca del consenso, e comunque non oltre 24 mesi dalla raccolta. Registri tecnici e di sicurezza: 12 mesi. Dati per comunicazioni commerciali: fino alla revoca del consenso o all'opposizione, e comunque non oltre 24 mesi dall'ultimo contatto. Le copie di sicurezza sono sovrascritte entro 30 giorni dalla cancellazione. Decorsi i termini, i dati sono cancellati o resi anonimi.

6. A chi comunichiamo i dati e dove possono andare

I dati sono trattati dal personale autorizzato di NeuroSense e da fornitori che agiscono come responsabili del trattamento ai sensi dell'art. 28 GDPR, vincolati da contratto: servizi di hosting e archiviazione con data center nell'Unione europea; servizi di invio e-mail e assistenza clienti; servizi di analisi delle prestazioni dell'applicazione; il prestatore di servizi di pagamento; consulenti e revisori tenuti al segreto professionale. Gli enti di ricerca con cui collabori tramite il tuo consenso agiscono come contitolari ai sensi dell'art. 26 GDPR, in base a un accordo la cui sintesi è disponibile su richiesta. Non vendiamo dati personali e non li cediamo a intermediari di dati. Alcuni fornitori hanno sede negli Stati Uniti d'America: il trasferimento avviene verso società certificate nell'ambito dell'EU-U.S. Data Privacy Framework, riconosciuto adeguato dalla decisione della Commissione europea del 10 luglio 2023, oppure, in mancanza, sulla base delle clausole contrattuali tipo adottate con decisione (UE) 2021/914, integrate da una valutazione d'impatto del trasferimento e da misure supplementari, tra cui la cifratura con chiavi detenute in Europa. I segnali fisiologici grezzi non lasciano l'Unione europea. L'elenco aggiornato dei responsabili e delle garanzie applicate è disponibile scrivendo al DPO.

7. I tuoi diritti e come esercitarli

Hai il diritto di ottenere dal Titolare l'accesso ai dati personali che ti riguardano, la rettifica, la cancellazione, la limitazione del trattamento e la portabilità dei dati forniti o generati dal tuo uso della fascia, che ti consegniamo in un formato strutturato, di uso comune e leggibile da dispositivo automatico (CSV ed EDF), nonché di opporti in qualsiasi momento, per motivi connessi alla tua situazione particolare, ai trattamenti fondati sul legittimo interesse e, senza necessità di motivazione, ai trattamenti per finalità di marketing (artt. 15-22 GDPR). Puoi revocare ciascun consenso in qualsiasi momento, dalle impostazioni dell'applicazione o scrivendo a privacy@neurosense.example o alla PEC neurosense@pec.example; la revoca non pregiudica la liceità del trattamento effettuato prima di essa. In caso di revoca del consenso alla ricerca o all'addestramento degli algoritmi, cessiamo il trattamento e cancelliamo i tuoi segnali e i dati derivati ancora riconducibili a te entro 30 giorni; non è invece tecnicamente possibile rimuovere il contributo dei tuoi dati dai modelli statistici già addestrati né ritirare i risultati aggregati già pubblicati, che non ti identificano. Rispondiamo entro un mese dalla richiesta, prorogabile di due mesi nei casi di particolare complessità, di cui ti daremo avviso. Se ritieni che il trattamento violi il GDPR, puoi proporre reclamo al Garante per la protezione dei dati personali (art. 77 GDPR; www.garanteprivacy.it) o ricorrere all'autorità giudiziaria (art. 79 GDPR). L'esercizio dei diritti è gratuito e non comporta alcuna limitazione dei Servizi, salvo quelle che derivano necessariamente dalla revoca del consenso di cui al punto 3, sub (i).

8. Decisioni automatizzate, profilazione e minori

L'applicazione adatta automaticamente la difficoltà degli esercizi e calcola i punteggi che vedi dopo ogni sessione: si tratta di elaborazioni automatizzate che non producono effetti giuridici né incidono in modo analogo significativamente sulla tua persona, e non costituiscono quindi decisioni ai sensi dell'art. 22, par. 1, GDPR. Non svolgiamo profilazione per finalità pubblicitarie. Se in futuro introducessimo decisioni automatizzate con effetti significativi, lo faremmo solo con il tuo consenso esplicito, garantendoti in ogni caso il diritto di ottenere l'intervento umano, di esprimere la tua opinione e di contestare la decisione. Puoi chiedere in ogni momento informazioni sulla logica utilizzata dagli algoritmi scrivendo al DPO. I Servizi non sono destinati a persone di età inferiore a 18 anni; se veniamo a conoscenza di dati raccolti da un minore, li cancelliamo.

9. Modifiche a questa informativa

Possiamo aggiornare questa informativa. Se le modifiche riguardano finalità, basi giuridiche, destinatari o tempi di conservazione, ti avvisiamo nell'applicazione e via e-mail almeno 30 giorni prima che entrino in vigore. L'uso dei Servizi dopo l'avviso non vale come consenso a nuove finalità: dove serve un consenso, te lo chiederemo di nuovo. La data e il numero di versione sono indicati all'inizio del documento.
`;

import type { Question, Task } from "../session/model";

// Tre domande di verifica (una risposta giusta, distrattori plausibili) e due
// prove operative: trovare la clausola che serve. Le clausole sono c1…c9
// nell'ordine del testo.
export const informativaNeurotechQuestions: Question[] = [
  {
    id: "q1",
    clauseId: "c5",
    prompt: "Per quanto tempo NeuroSense conserva i segnali fisiologici grezzi della fascia?",
    options: ["Per tutta la durata dell'account", "24 mesi dalla raccolta, poi cancellazione o anonimizzazione", "10 anni, come i dati di fatturazione", "12 mesi, come i registri tecnici"],
    correctIndex: 1,
  },
  {
    id: "q2",
    clauseId: "c7",
    prompt: "Se revochi il consenso all'addestramento degli algoritmi, che cosa succede?",
    options: [
      "Vengono cancellati anche i modelli statistici già addestrati",
      "Non succede nulla fino alla chiusura dell'account",
      "I tuoi segnali ancora riconducibili a te vengono cancellati entro 30 giorni, ma il loro contributo ai modelli già addestrati non si può rimuovere",
      "I Servizi di neurofeedback vengono sospesi",
    ],
    correctIndex: 2,
  },
  {
    id: "q3",
    clauseId: "c3",
    prompt: "Su quale base giuridica NeuroSense può usare i tuoi segnali fisiologici per addestrare i propri algoritmi?",
    options: ["Il legittimo interesse del Titolare", "L'esecuzione del contratto", "Un consenso esplicito separato, oppure solo dopo anonimizzazione irreversibile", "Un obbligo di legge"],
    correctIndex: 2,
  },
];

export const informativaNeurotechTasks: Task[] = [
  { id: "t1", clauseId: "c7", prompt: "Vuoi revocare un consenso e sapere entro quanto tempo ti rispondono. Trova la clausola che lo dice." },
  { id: "t2", clauseId: "c6", prompt: "Vuoi sapere se i tuoi dati possono finire negli Stati Uniti e con quali garanzie. Trova la clausola." },
];
