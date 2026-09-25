export const informativaNeurotech = `
1. Titolare del trattamento

La presente informativa è resa ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 ("GDPR") da NeuroSense Technologies S.r.l., con sede legale in Via dei Sensori 12, 20100 Milano, P. IVA 00000000000, in qualità di Titolare del trattamento dei dati personali raccolti tramite il dispositivo di neurofeedback "NeuroBand" e la relativa applicazione mobile (congiuntamente, i "Servizi").

2. Categorie di dati trattati

Nell'ambito dell'erogazione dei Servizi, il Titolare tratta le seguenti categorie di dati personali: (a) dati identificativi e di contatto forniti in fase di registrazione; (b) dati tecnici relativi al dispositivo, al sistema operativo, all'indirizzo IP e agli identificativi pubblicitari; (c) segnali fisiologici acquisiti dai sensori ottici del dispositivo, ivi inclusi i valori di assorbimento nel vicino infrarosso e nel rosso relativi all'emodinamica della corteccia prefrontale, i dati inerziali (accelerometro e giroscopio) e la temperatura cutanea; (d) dati derivati, ossia le elaborazioni, i punteggi, le classificazioni e le inferenze prodotte dagli algoritmi proprietari del Titolare a partire dai segnali di cui alla lettera (c), incluse le stime relative allo stato attentivo, al livello di attivazione e all'andamento delle sessioni di allenamento.

3. Finalità e basi giuridiche

I dati sono trattati per le seguenti finalità: (i) erogazione dei Servizi e adempimento del contratto, ai sensi dell'art. 6, par. 1, lett. b) GDPR; (ii) miglioramento, sviluppo e addestramento degli algoritmi di elaborazione del segnale e dei modelli di apprendimento automatico, ivi incluso mediante l'utilizzo dei dati di cui al punto 2, lettere (c) e (d), in forma pseudonimizzata, sulla base del legittimo interesse del Titolare ai sensi dell'art. 6, par. 1, lett. f) GDPR; (iii) ricerca scientifica, in collaborazione con enti accademici e partner industriali selezionati, previo consenso esplicito dell'interessato ai sensi degli artt. 6, par. 1, lett. a) e 9, par. 2, lett. a) GDPR; (iv) comunicazioni promozionali relative a prodotti e servizi del Titolare e di terzi, previo consenso; (v) adempimento di obblighi di legge.

4. Natura dei dati fisiologici

L'interessato prende atto che i segnali di cui al punto 2, lettera (c), possono costituire dati relativi alla salute ai sensi dell'art. 4, n. 15, GDPR e sono pertanto trattati nel rispetto dell'art. 9 GDPR. Il trattamento dei dati derivati di cui alla lettera (d) per le finalità di cui al punto 3, sub (ii), avviene previa applicazione di tecniche di pseudonimizzazione che, nella valutazione del Titolare, riducono il rischio di reidentificazione a un livello accettabile, fermo restando che il Titolare non garantisce l'irreversibilità di tali tecniche in presenza di informazioni aggiuntive detenute da terzi.

5. Conservazione

I dati identificativi sono conservati per la durata del rapporto contrattuale e per i dieci anni successivi alla sua cessazione. I segnali fisiologici grezzi sono conservati per un periodo di ventiquattro mesi dalla raccolta; decorso tale termine, sono cancellati ovvero resi anonimi. I dati derivati e i modelli addestrati sui medesimi, in quanto non più riconducibili all'interessato secondo la valutazione del Titolare, sono conservati senza limiti di tempo.

6. Destinatari e trasferimenti

I dati possono essere comunicati a: fornitori di servizi cloud, con server ubicati nell'Unione europea e negli Stati Uniti d'America; partner di ricerca; fornitori di servizi di analisi e advertising; autorità pubbliche ove richiesto dalla legge. I trasferimenti verso Paesi terzi avvengono sulla base delle clausole contrattuali standard adottate dalla Commissione europea o, ove applicabile, di decisioni di adeguatezza. L'elenco aggiornato dei responsabili del trattamento è disponibile su richiesta.

7. Diritti dell'interessato

L'interessato ha il diritto di ottenere l'accesso ai dati, la rettifica, la cancellazione, la limitazione del trattamento, la portabilità, nonché di opporsi al trattamento e di revocare il consenso in qualsiasi momento, senza pregiudicare la liceità del trattamento basato sul consenso prestato prima della revoca. La revoca del consenso alle finalità di cui al punto 3, sub (iii), non comporta la cancellazione dei modelli già addestrati né dei risultati di ricerca già prodotti. Le richieste vanno inviate a privacy@neurosense.example. È fatto salvo il diritto di proporre reclamo al Garante per la protezione dei dati personali.

8. Processo decisionale automatizzato

I Servizi utilizzano processi decisionali automatizzati per adattare la difficoltà delle sessioni di allenamento e per generare i punteggi visualizzati nell'applicazione. Tali processi non producono effetti giuridici né incidono in modo analogo significativamente sull'interessato ai sensi dell'art. 22 GDPR. L'interessato può richiedere informazioni sulla logica utilizzata scrivendo all'indirizzo di cui al punto 7.

9. Modifiche

Il Titolare si riserva di modificare la presente informativa. Le modifiche sono comunicate mediante pubblicazione nell'applicazione e hanno efficacia dalla data di pubblicazione. L'uso continuato dei Servizi successivamente alla pubblicazione costituisce presa d'atto delle modifiche.
`;

import type { Question, Task } from "../session/model";

// Tre domande di verifica (una risposta giusta, distrattori plausibili) e due
// prove operative: trovare la clausola che serve. Le clausole sono c1…c9
// nell'ordine del testo.
export const informativaNeurotechQuestions: Question[] = [
  {
    id: "q1",
    clauseId: "c5",
    prompt: "Per quanto tempo vengono conservati i segnali fisiologici grezzi?",
    options: ["Dieci anni dalla cessazione del contratto", "Ventiquattro mesi dalla raccolta", "Senza limiti di tempo", "Fino alla revoca del consenso"],
    correctIndex: 1,
  },
  {
    id: "q2",
    clauseId: "c7",
    prompt: "Se revochi il consenso alla ricerca scientifica, che cosa succede ai modelli già addestrati sui tuoi dati?",
    options: ["Vengono cancellati entro trenta giorni", "Vengono resi anonimi", "Non vengono cancellati", "Vengono restituiti all'interessato"],
    correctIndex: 2,
  },
  {
    id: "q3",
    clauseId: "c3",
    prompt: "Su quale base giuridica il Titolare usa i tuoi segnali per addestrare i propri algoritmi?",
    options: ["Il tuo consenso esplicito", "L'esecuzione del contratto", "Il legittimo interesse del Titolare", "Un obbligo di legge"],
    correctIndex: 2,
  },
];

export const informativaNeurotechTasks: Task[] = [
  { id: "t1", clauseId: "c7", prompt: "Vuoi revocare il consenso. Trova la clausola che dice come fare e a chi scrivere." },
  { id: "t2", clauseId: "c6", prompt: "Vuoi sapere se i tuoi dati possono finire negli Stati Uniti. Trova la clausola che lo dice." },
];
