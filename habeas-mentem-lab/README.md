# Habeas Mentem Lab

Prototipo interno, non commerciale, del programma di misurazione descritto in
*Habeas Mentem* (M. Giacomello, master v37, settembre 2026) e in *Progettare la
comprensione del diritto. Legal Experience e complessità cognitiva nelle
interfacce cervello-computer*, in *Mente e Tecnologia – BCI* (Springer, 2026,
pp. 135-158). Primo strumento: **LX Reader**, la lettura di un documento
giuridico una clausola alla volta con la fascia **Mendi** (fNIRS) collegata.

> Habeas Mentem è il diritto di ogni persona a comprendere, giudicare e
> decidere in condizioni che non siano state progettate contro di lei.
>
> La comprensione si misura, la mente non si legge. Nessun sensore dimostra
> da solo la comprensione: la conoscenza nasce dalla convergenza delle
> evidenze. Si misurano i documenti, mai le persone.

## Che cosa fa oggi (tool 1)

| Occhio del diritto | Stato | Che cosa registra |
|---|---|---|
| **Tempo** | ✅ | ms su ogni clausola, visite, ritorni indietro, parole/minuto, flag "troppo veloce per averla letta" (> 600 wpm) |
| **Corpo** | ✅ | frame Mendi a ~25 Hz (IR, rosso, ambiente per canale sinistro/destro/polso, IMU, temperatura), annotati con la clausola visibile; indice di sforzo relativo alla baseline; quota di artefatti da movimento |
| **Testo** | ✅ | stima euristica dell'LX Complexity Score per clausola: la lingua, l'affollamento, l'ordine, la distanza semantica |
| **Verifica** | ✅ | tre domande a risposta chiusa dopo la lettura, senza rileggere; tempo di risposta |
| **Prova operativa** | ✅ | due compiti pratici («vuoi revocare il consenso: trova la clausola»), con il documento riapribile; clausole aperte, tempo, scelta |
| Sguardo | — | tracciamento dello sguardo: non in questo tool |

**Mappa della frizione** (`src/session/friction.ts`): verde, giallo, rosso per
clausola, per convergenza. Ogni sensore alza al massimo un indizio: tempo
(troppo veloce o ritorni ripetuti), corpo (sforzo nel terzo più alto della
sessione), testo (LX sopra 45), verifica (domanda sbagliata), prova operativa
(compito fallito). Rosso con almeno tre indizi di cui uno da verifica o prova;
giallo con due indizi, o con una sola verifica o prova fallita; verde
altrimenti. Il corpo da solo non colora mai.

Uscita: CSV per clausola, CSV dei campioni grezzi, JSON della sessione.
Tutto resta nel browser finché non viene scaricato. Nessun server.

## Avvio

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # decoder protobuf, indice di sforzo, metriche
npm run build
```

Requisiti per la fascia reale: **Chrome o Edge** su desktop o Android
(Web Bluetooth), pagina servita da `localhost` o `https`. Safari e Firefox
non supportano Web Bluetooth. Senza fascia si può usare la **fascia
simulata** (flusso realistico, ma non simula il carico cognitivo) oppure
**leggere senza fascia** (resta attivo il solo sensore del tempo).

Flusso: consenso → collega la fascia → scegli il documento (tre modelli
inclusi, oppure **incolla un tuo testo**) → 30 s di baseline a riposo →
lettura clausola per clausola → verifica → prova operativa → tabella dei
risultati, esportazione e fascicolo PDF. Dalla schermata iniziale,
**Fascicolo aggregato** importa i JSON di più sessioni sullo stesso
documento e produce la mappa della frizione tra lettori.

## Come parla con Mendi

Mendi non pubblica un'API. Il protocollo BLE è ricostruito dalla libreria
open source [`mendi`](https://crates.io/crates/mendi) (Rust, MIT):

- servizio GATT `fc3eabb0-c6c4-49e6-922a-6e551c455af5`, nome `Mendi…`;
- caratteristica Frame `…abb1` (notifiche protobuf a ~25 Hz), ADC `…abb4`
  (batteria), Calibration `…abb6` (autocalibrazione LED), Diagnostics `…abb5`;
- schema `proto3` in `src/mendi/protobuf.ts`, decoder scritto a mano
  (solo varint, fixed32, float), coperto dai test.

Accensione, verificata su firmware 1.0.4 / hardware r2.2a: il flusso ottico
non parte da solo. Dentro la fascia c'è un front-end TI AFE4404, raggiungibile
registro per registro dalla caratteristica Sensor `…abb2`; il firmware lo
configura all'avvio ma lascia spento il timer di campionamento (registro
`0x1E`, bit TIMEREN). Il client scrive `0x1E = 0x000100` dopo la calibrazione
e i frame arrivano entro un secondo; allo scollegamento lo rimette a zero.
Il tasto «sonda di accensione» fotografa i 64 registri e prova le varianti,
scrivendo tutto nel log: è ciò che ha permesso di trovare la sequenza.

Un aggiornamento del firmware Mendi può cambiare il protocollo senza
preavviso. È il rischio accettato per un prototipo interno.

## Parola per parola

La fascia non vede la singola parola: la risposta emodinamica arriva 4-8 s
dopo lo stimolo. Ciò che si misura davvero parola per parola è il tempo, e
solo se il testo compare a porzioni. Tre modi di presentazione, scelti prima
della sessione:

- **clausola intera**: il tempo si misura per clausola (modo originale);
- **a porzioni, al ritmo del lettore**: poche parole alla volta (2-5, spezzate
  alla punteggiatura e prima dei connettivi), si avanza con spazio o freccia:
  tempo per parola, ritorni;
- **a porzioni, a scorrimento**: le porzioni avanzano da sole a un ritmo in
  parole al minuto; contano fermate e ritorni.

Il segnale corporeo non viene «spostato»: viene modellato (`src/session/hrf.ts`).
Ogni porzione ha un regressore pari alla sua esposizione convoluta con la
risposta emodinamica canonica (doppia gamma: picco a 6 s, sottoscatto a 16 s,
30 s di durata); i pesi β si stimano tutti insieme ai minimi quadrati, con
costante e deriva lineare, escludendo i campioni con movimento. È il modello
lineare generale dell'analisi fNIRS: le porzioni vicine si sovrappongono nel
segnale e risolverle insieme le separa. Lo stesso modello dà un β per clausola.
Resta un'attribuzione modellata, non una misura della parola, e il fascicolo lo
scrive insieme alla varianza spiegata e all'errore standard di ogni β. Per
confronto il CSV riporta anche la media su finestra spostata di 4 s. La vista
«Parola per parola» colora ogni porzione per tempo per parola oppure per β.
Facoltativa la registrazione vocale (lettura ad alta voce): resta nel
browser, si scarica in `.webm`, e il CSV dà l'offset di ogni porzione
dall'inizio dell'audio per un allineamento forzato fuori dal browser.

## L'indice di sforzo, e i suoi limiti

`src/mendi/signal.ts`, dichiarato per intero:

1. sottrazione della luce ambiente per canale;
2. densità ottica relativa alla baseline, `od = −ln(I / I₀)`;
3. proxy HbO = `od(rosso) − od(IR)` (coefficienti di estinzione e DPF non
   applicati: è un'approssimazione di primo ordine, non una concentrazione);
4. media dei canali frontali sinistro e destro, media mobile di 1 s.

Unità arbitrarie, confrontabili solo tra clausole della **stessa sessione**.
Il modulo non produce un giudizio di comprensione, non inferisce emozioni,
non classifica il partecipante. Segnala dove il segnale si sposta rispetto
al riposo: un indizio da leggere in convergenza con gli altri sensori.

## L'LX Complexity Score, stimato

`src/session/lx.ts`. Il libro Springer (pp. 145-147) nomina e misura due
componenti principali, **densità sintattica** e **distanza semantica**, su
scala 0-100 con soglia sperimentale di accessibilità a **45**; *Habeas
Mentem* (cap. *La cartografia della comprensione*) descrive le quattro
strade: la lingua, l'affollamento, l'ordine, la distanza semantica. Le
formule sono calibrate sui valori del corpus BCI riportati nel libro (41
parole per frase contro obiettivo 22, 3,8 subordinate per periodo, 68% di
passive; 34 termini tecnici ogni 600 parole, 56% senza definizione), così
che quei valori restituiscano 72 e 68 come nel libro. È una stima di
superficie calcolata nel browser, non il modello NLC calibrato su EEG/fNIRS
(pannello di 100 lettori, r = −0,71 in calibrazione e −0,68 in validazione).
Il punteggio non giudica le persone: fa la diagnosi ai documenti.

## La costituzione della misurazione, applicata

I sei articoli del capitolo *La costituzione della misurazione* (v37), tradotti
nel prototipo:

1. **Una sola finalità** — migliorare la comprensibilità del documento; nessun uso secondario.
2. **Si misurano i documenti, mai le persone** — nessun esito individuale, nessun giudizio sul lettore.
3. **Il sensore meno invasivo, i dati minimi** — pseudonimo casuale, nessuna rete, dati solo nella pagina; strumenti neurofisiologici solo in laboratorio, con consenso pieno.
4. **Il metodo è pubblico** — formule e soglie nel codice, punteggi ricalcolabili dai CSV esportati.
5. **Nessuno è obbligato a essere misurato** — si legge anche senza fascia; si può chiudere in ogni momento.
6. **Chi misura accetta di essere misurato** — test automatici, e questo README dichiara cosa lo strumento non sa fare.

Con partecipanti esterni i segnali ottici sono con ogni probabilità dati
relativi alla salute (art. 9 GDPR): servono informativa, consenso esplicito
e, verosimilmente, una DPIA. Per una pubblicazione, parere del comitato etico.

## Struttura

```
src/mendi/       protocollo, decoder protobuf, client Web Bluetooth, simulatore, indice di sforzo
src/session/     modello della sessione, metriche per clausola, esportazione
src/documents/   tre documenti modello + import di testo incollato
src/ui/          registratore (hook), schermate, tracciato dal vivo
tests/           vitest
```

## Roadmap (dal libro)

2. ~~Test e prova operativa~~ — fatto.
3. ~~Mappa della frizione~~ — fatto (prima versione; le soglie sono dichiarate nel codice).
4. ~~LX Score Analyzer~~ — fatto in prima versione: `src/session/calibrate.ts` ricalibra i pesi delle quattro strade sui dati aggregati (misura composita di comprensione = verifica, prova operativa, tempo compatibile con la lettura; ricerca dei pesi che rendono più negativa la correlazione, come nel libro; soglia osservata), con minimi dichiarati (5 lettori, 6 clausole), confronto con r = −0,71/−0,68 del libro e cautele esplicite. Il risultato entra nel fascicolo aggregato.
6. ~~Fascicolo aggregato~~ — fatto: `src/session/aggregate.ts` importa i JSON di più sessioni sullo stesso documento e calcola, in forma anonima, dove i lettori si perdono (quote di lettori troppo veloci o tornati indietro, accuratezza della verifica, riuscita della prova, sforzo medio tra chi aveva il segnale, quota di lettori "persi"); frizione per convergenza tra lettori con soglie dichiarate (`AGGREGATE_THRESHOLDS`) e PDF aggregato in orizzontale.
5. ~~Fascicolo di comprensibilità~~ — fatto: `src/session/dossier.ts` genera nel browser (jsPDF) il PDF con sintesi, mappa della frizione, risposte e compiti, metodo dichiarato, costituzione applicata, nome di chi risponde del documento e impronta SHA-256 del JSON di sessione.

I documenti modello in `src/documents/` sono scritti per il laboratorio sul
calco delle informative reali; non appartengono ad aziende esistenti.
