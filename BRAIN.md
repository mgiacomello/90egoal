# BRAIN (`/brain`)

**Il capo di gabinetto di una persona sola.**

Non è una chat sui documenti. È l'agente che ha letto tutto — email, calendario,
Drive, movimenti del conto, dati dell'anello — e che risponde come risponderebbe
una persona di fiducia: per punti, e con accanto a ogni punto **da dove viene e
di quando è**.

La differenza fra questo e un assistente qualsiasi sta in una regola:

> **Non gli è permesso sapere niente che non sia in memoria.**

E la regola non è affidata al prompt. Il prompt la chiede; il codice la impone.

---

## L'idea architetturale: il modello scrive, il codice verifica

È la stessa spina dorsale di ONE TAP (*l'AI trascrive, il codice decide*),
applicata alla memoria.

```
domanda ─► ricerca full-text ─► ranking deterministico ─► fonti numerate (F1…F8)
                                                                │
                                                                ▼
                                                    modello (output strutturato)
                                                                │
                                                                ▼
                                          verificatore ──► risposta con le fonti
                                         (lib/brain/cite.ts)
```

Il modello non restituisce testo libero: compila uno strumento con uno schema,
un elenco di affermazioni in cui **ognuna dichiara gli handle da cui viene**.
Poi passa da `verifyClaims()`, che applica due regole:

| # | Regola | Conseguenza |
|---|---|---|
| 1 | L'handle citato esiste fra le fonti offerte? | Se no, **l'affermazione non viene mostrata.** Nessuna eccezione. |
| 2 | Importi, IBAN, email, orari e date scritti nella frase compaiono nelle fonti *citate da quella frase*? | Se no, la frase resta ma il dettaglio è **marcato in giallo**. |

La regola 2 è la parente stretta del controllo mod-97 di ONE TAP: poche righe di
aritmetica che fermano un numero sbagliato prima che diventi una decisione. Un
importo copiato da un altro documento non passa, perché il confronto avviene
solo sulle fonti che quella frase ha citato.

Conseguenza pratica: **una risposta senza fonti è una risposta vuota**, e si
vede. "Non risulta" è un esito corretto del sistema, non un fallimento.

---

## Il nucleo deterministico

Funzioni pure, senza rete e senza DOM. `npm run test:brain` — 129 test, zero
dipendenze. Nessuna di queste importa valori da altri file: è la regola che le
tiene testabili in isolamento, e vale per ogni pezzo nuovo del nucleo.

| File | Ruolo | Perché non sta in un prompt |
|---|---|---|
| `lib/brain/chunk.ts` | spezza i documenti sui paragrafi, poi sulle frasi, con sovrapposizione | un taglio si verifica, un'intuizione no |
| `lib/brain/rank.ts` | ordina i pezzi: full-text, parole in comune, freschezza, persone nominate, frase esatta | un ordinamento si può testare |
| `lib/brain/cite.ts` | applica le due regole qui sopra | è la promessa del prodotto |
| `lib/brain/orchestrator.ts` | per ogni tipo di task, il modello che rende meglio | la scelta è una tabella, non un'opinione |
| `lib/brain/quote.ts` | una clausola citata esiste nel contratto? | è la promessa dell'agente Contratti |
| `lib/brain/pdf.ts` | quello che è uscito dal PDF è testo vero o un guscio vuoto? | un limite dichiarato vale più di un corpo mezzo vuoto |
| `lib/brain/reconcile.ts` | quale fattura corrisponde a quale movimento | l'aritmetica non si delega a un modello |
| `lib/brain/openpoints.ts` | è lo stesso punto aperto, riformulato? | senza, la lista si riempie di doppioni in una settimana |
| `lib/brain/briefmail.ts` | il brief come arriva nella posta | la mail non si rigenera: si formatta |
| `lib/brain/expand.ts` | con quali altre parole cercare, e come raccontare una ricerca a vuoto | l'espansione allarga il recupero, non deve dirottarlo |
| `lib/brain/correction.ts` | come si scrive una correzione perché regga da sola | la precedenza deve viaggiare col dato, non col prompt |
| `lib/brain/people.ts` | "Giulia Bianchi" e `giulia.bianchi@…` sono la stessa persona? | chi era nella stanza è un fatto: si interroga, non si cerca |
| `lib/brain/cron.ts` | chi può far partire un'esecuzione automatica | un controllo d'accesso si testa, e va testato |

Due dettagli che cambiano i risultati e che è facile sbagliare:

- **La freschezza dimezza ogni 90 giorni ma non arriva mai a zero** (fondo 0.05).
  La memoria vecchia è esattamente quella che un umano non ricorda più: va pesata
  meno, non cancellata.
- **La domanda diventa un OR.** `websearch_to_tsquery` mette in AND le parole
  separate da spazio: "cosa ha detto Rossi sul rinnovo" cercherebbe documenti che
  contengono *tutte* quelle parole, e non troverebbe niente. `toFtsQuery()`
  costruisce un OR e lascia al ranking il compito di pesare quante parole ciascun
  pezzo abbia davvero preso.

---

## Le correzioni: l'unica fonte che batte tutte le altre

Per nove commit la memoria si poteva solo **svuotare**: chiudere un punto,
cancellare un documento. Due modi di togliere, nessuno di dire *"questo è
sbagliato, la cosa giusta è quest'altra"*.

È il difetto che impedisce a un secondo cervello di diventare tuo. Se l'unico
rimedio a un suo errore è ricordartelo da solo, stai facendo esattamente il
lavoro che doveva fare lui.

### La forma, che è dove sta il valore

**Una correzione non è una tabella a parte: è un documento in memoria.** Viene
cercata, ordinata e **citata** come qualunque altra fonte. Quando una risposta è
corretta, la fonte che compare sotto la frase sei tu, con la data in cui l'hai
detto.

Niente regole invisibili che aggiustano le cose di nascosto: la correzione si
vede, si può rileggere, e si può a sua volta correggere.

Due proprietà discendono da questa scelta, ed erano il motivo per farla:

1. **Pesa più di ogni altra fonte** (`KIND_WEIGHT` in `rank.ts`), anche di un
   documento più recente. È l'unica cosa che deve poter battere la freschezza,
   perché è l'unica che arriva già sapendo cosa dicevano le altre. Un rimedio che
   non si vede nei risultati è peggio di nessun rimedio — c'è un test che mette
   una correzione di tre giorni prima contro l'email che corregge, e la
   correzione vince.
2. **La precedenza è scritta dentro al corpo del documento**, non solo nel prompt
   di sistema:

   > *Questa correzione viene dal titolare della memoria e ha la precedenza su
   > qualunque altra fonte sullo stesso punto, anche se più recente.*

   Così viaggia col dato. Qualunque agente la peschi — oggi il brief e il capo di
   gabinetto, domani uno che ancora non esiste — la legge insieme al contenuto,
   senza che nessuno debba ricordarsi di aggiungere la regola al suo prompt.

### Come si corregge

Sotto ogni affermazione, nel brief e nelle risposte, c'è un `✗ correggi` che si
apre **con il testo sbagliato già dentro**. La parte faticosa di una correzione è
ricopiare quello che il sistema aveva detto: se quella parte la fa l'utente,
nessuno correggerà mai niente.

Volutamente **non è un pollice verso**. Un voto non dice cosa fosse giusto,
quindi non serve né a te né al sistema. Qui si scrive il fatto vero, e da quel
momento è una fonte.

Serve solo *qual è la cosa giusta*: il resto è facoltativo. E reinviare la stessa
correzione non la duplica — la chiave deriva dal contenuto — ma due correzioni
che differiscono di una parola restano due, perché in una correzione una parola
diversa può essere tutto il punto.

### Riformulare un punto aperto

Stessa idea, sull'altra lista: un punto si può riscrivere meglio **senza perderne
l'età**. `opened_at` non si tocca, perché da quanto lo stai rimandando è l'unica
informazione che conta davvero, e azzerarla per una questione di forma sarebbe un
modo elegante di mentirsi.

---

## Il recupero, e perché "non risulta" va dimostrato

La regola *"solo quello che è in memoria"* ha un costo che si vede solo usando il
prodotto: **una ricerca andata male si traveste da risposta.** Chiedi *"cosa
avevamo deciso sul pricing"*, nei documenti c'è scritto "listino" e "tariffe", la
ricerca full-text non lo sa, e il sistema dice "non risulta" — che sembra un
fatto ed è un fallimento del recupero.

Due contromisure, e nessuna delle due tocca la garanzia sulle fonti.

### 1. Il modello propone parole, non risposte

Se il primo giro trova poco (meno di 12 pezzi), si chiede al modello veloce
*altre parole con cui la stessa cosa potrebbe essere scritta* — "pricing" →
listino, prezzi, tariffe, sconto, preventivo — e si cerca di nuovo. I risultati
si **uniscono**, non si sostituiscono.

Perché è sicuro: **chi propone i termini non vede nessun documento**, solo la
domanda. Non è un risparmio, è una garanzia strutturale — da lì non può uscire
niente che somigli a una risposta, perché non ha niente da cui ricavarla. Al
peggio si cerca una parola inutile, e il ranking la ignora.

Due dettagli che è facile sbagliare:

- **I termini della domanda non vengono mai scartati**, nemmeno se il modello ne
  propone quaranta e scatta il tetto. L'espansione allarga la ricerca, non la
  dirotta: se cadesse la parola che l'utente ha scritto, avremmo risposto a
  un'altra domanda.
- **Il ranking usa la domanda originale, non quella espansa.** Altrimenti un
  sinonimo suggerito dal modello peserebbe quanto una parola scritta da te.

Se il modello veloce non risponde, si va avanti con la ricerca diretta:
l'espansione è un miglioramento, non un requisito.

### 2. Una risposta vuota dice cosa ha cercato

> *Ho cercato "pricing", "listino", "tariffe", "sconto" su 1.240 documenti in
> memoria. Nessuno corrisponde alla domanda.*

Così "non risulta" diventa **falsificabile**: leggi i termini, vedi che manca
quello giusto, e riformuli. Senza quella riga non potresti distinguere un dato
che non c'è da un sistema che ha cercato male — e distinguerli è esattamente il
tipo di cosa che questo prodotto promette.

### Il passo dopo, e perché non è ancora questo

La ricerca semantica (embedding + pgvector) troverebbe "listino" senza bisogno di
chiedere sinonimi. Non è stata fatta ora per tre ragioni dichiarate: Anthropic
**non ha un endpoint di embedding**, quindi servirebbe un fornitore in più con la
sua chiave e il suo costo; richiede una migration e un backfill di tutti i pezzi
già in memoria; e su un archivio piccolo l'espansione dà gran parte del beneficio
a costo quasi nullo. Quando l'archivio cresce, il posto dove innestarla è
`searchMemory()`, e il ranking deterministico resta quello che è.

---

## La memoria

Un solo formato per tutto quello che entra: **da dove viene, che cos'è, quando è
successo**. Il resto del sistema non sa nulla di Gmail o di Qonto.

```ts
type BrainDocument = {
  source: 'gmail' | 'gcal' | 'gdrive' | 'qonto' | 'oura' | 'manual'
  kind: 'email' | 'event' | 'file' | 'transaction' | 'health' | 'note' | 'correction'
  externalId: string   // id stabile nel sistema di origine
  title: string
  body: string
  occurredAt: string   // quando è successo, non quando l'abbiamo letto
  url?: string | null
  participants?: string[]
}
```

Un documento è identificato da `(fonte, id esterno)`: **risincronizzare non
duplica mai niente**. E se il contenuto non è cambiato (confronto per impronta)
non si rifà il lavoro di spezzettamento — la sincronizzazione dice quanti ne ha
saltati.

Tabelle: `brain_documents`, `brain_chunks` (con `tsvector` italiano e indice
GIN), `brain_credentials`, `brain_runs`, `brain_open_points`. Tutte con **RLS attiva e nessuna
policy**: dal browser non sono raggiungibili nemmeno da autenticati. L'unica
porta è la service role key, e sta solo lato server.

---

## I connettori

Un connettore fa una cosa sola: procurarsi del testo con una data e una
provenienza. Aggiungerne uno è un file che restituisce `BrainDocument[]` più una
riga in `lib/brain/connectors/index.ts`. Memoria, ricerca, ranking, citazioni e
interfaccia non cambiano.

| Fonte | Accesso | Cosa entra in memoria |
|---|---|---|
| **Gmail** | OAuth Google, sola lettura | mail senza promozioni/social/spam, citazioni del thread tagliate |
| **Google Calendar** | OAuth Google, sola lettura | eventi del calendario principale, **passato e prossimi 60 giorni** |
| **Google Drive** | OAuth Google, sola lettura | Documenti, Fogli, Presentazioni e **PDF con livello di testo**; le scansioni restano al titolo |
| **Qonto** | chiave API, sola lettura | transazioni con controparte, importo, e se il giustificativo manca |
| **Oura** | token personale | un documento al giorno: sonno, prontezza, attività |

**Tutti leggono e basta.** Nessuno di questi agenti può scrivere una mail,
spostare un evento o disporre un pagamento — e gli scope OAuth richiesti sono
solo `.readonly`, quindi non è una promessa, è un limite tecnico.

### Perché Oura e non lo smartwatch

Scelta pratica, non estetica: **Oura ha un'API pubblica vera** (token personale,
Bearer, REST), mentre i dati di Apple Watch non escono dal telefono senza
un'app nativa da pubblicare sullo Store. Un connettore che si accende in due
minuti batte un connettore che richiede un ciclo di review.

Un documento al giorno, non uno per misura: la domanda che si fa a un coach è
"come ho dormito questa settimana", non "qual era il mio HRV alle 4:12".

### I PDF, e perché il limite è dichiarato

I PDF si leggono con `unpdf` — una build di pdf.js che gira in una funzione
serverless, senza dipendenze native. Ma **un PDF scansionato non contiene
testo**: è un'immagine in un involucro PDF, e pdf.js ne estrae zero caratteri o
quattro righe di intestazione.

Il modo sbagliato di gestirlo è mettere in memoria quel poco e andare avanti. Il
documento *sembrerebbe* letto, un agente lo citerebbe come fonte, e la citazione
risulterebbe formalmente valida su un testo che non è il contratto. Sarebbe un
buco esattamente nel punto che tutto il resto del sistema difende.

Quindi `assessExtraction()` decide, guardando densità di caratteri per pagina,
numero di parole e lunghezza media delle parole, e il verdetto finisce
**dentro al documento**, in chiaro:

> `[PDF scansionato: non contiene un livello di testo, quindi in memoria c'è solo il titolo. Per analizzarlo servirebbe un OCR, che qui non c'è.]`

Nella scheda Contratti un PDF senza testo viene rifiutato dicendo perché, invece
di produrre un'analisi vuota. Gli altri binari (immagini, archivi) restano al
titolo allo stesso modo.

Una conferma che il pezzo regge, venuta dalla prova: pdf.js converte gli
apostrofi dritti in apostrofi tipografici. Una citazione scritta col dritto
ritrova comunque il testo, perché `matchQuote()` normalizza proprio quello.

### Il soffitto, dichiarato

- **Nessun OCR.** Un PDF scansionato non entra. Farlo bene lato server (layout,
  tabelle, più pagine) non sta nei limiti di una funzione serverless, e farlo
  male sarebbe peggio che non farlo.
- **I DOCX non si leggono.** Sono archivi zip di XML, e servirebbe una
  dipendenza in più. Nel frattempo Drive li mostra col solo titolo.
- **La sincronizzazione parte da sola una volta al giorno**, non a ogni mail che
  entra. Il push in tempo reale (Gmail via Pub/Sub, webhook Qonto) accorcia la
  latenza, non aggiunge capacità: costa un pezzo di infrastruttura su Google
  Cloud e vale la pena solo quando la latenza diventa il problema.
- **Cinque agenti.** Brief, capo di gabinetto, Incontri, Contratti, Amministrazione.
  Manca il post-call, e manca per una ragione: non c'è una fonte di trascrizioni.

---

## L'agente Incontri

È il *One to One* del post che ha ispirato questo prodotto, generalizzato: non solo
i 1:1 col team, ma **qualunque incontro con qualcuno**. Cinque minuti prima di
entrare: cosa è rimasto in sospeso, cosa toccare, cosa avere in testa.

La scheda apre sugli appuntamenti veri dei prossimi 14 giorni, non su un campo
vuoto — chi ha una riunione fra dieci minuti non ha voglia di descriverla, la
tocca e legge.

### Prima chi, poi cosa

Qui il recupero è **l'opposto** di quello di tutti gli altri agenti, e vale la
pena capire perché.

Gli altri cercano per parole. Cercare una *persona* per parole è però il modo più
sicuro di sbagliare: "Bianchi" prende anche il fornitore Bianchi Srl, "Giulia"
prende tre Giulie. Ma **chi era nella stanza è un fatto strutturato** — sta nella
colonna `participants`, con il suo indice GIN — e su un fatto si fa una query,
non una ricerca.

Quindi: prima l'elenco esatto degli indirizzi, poi — solo dopo — una ricerca per
parole sul titolo dell'incontro, per pescare i documenti in cui la persona non è
formalmente fra i partecipanti ma l'argomento sì.

`lib/brain/people.ts` fa il ponte fra i due mondi, ed è lì che sta la parte
delicata: un nome vale solo se **tutte** le sue parole si ritrovano nello stesso
partecipante. "Giulia Bianchi" non deve agganciare `marco.bianchi@` né
`giulia.verdi@`, e pretendere l'intersezione piena è l'unico modo per escluderli
entrambi senza una rubrica. Le caselle generiche (`info@`, `amministrazione@`) non
identificano nessuno e vengono scartate, altrimenti una mail della contabilità
risulterebbe "di Giulia".

### L'ordine delle sezioni è il prodotto

**Prima cosa è rimasto in sospeso**, poi i punti, poi i fatti. Un'agenda che
riassume quello che vi siete detti è un riassunto; una che dice cosa avete
lasciato aperto è una preparazione. E i punti aperti già in memoria, filtrati su
quelle persone, compaiono in cima con la loro età.

---

## L'agente Contratti

Non un riassuntore: la griglia con cui un contratto si legge quando bisogna
deciderlo. Per ogni clausola critica dice **se è accettabile o rischiosa**,
**cos'è standard di mercato** e **quale controproposta fare**, col testo pronto
da incollare.

Prima di tutto chiede **da che parte stai**. Non è una gentilezza: la stessa
clausola di limitazione di responsabilità è un problema per chi la subisce e una
tutela per chi la scrive, e un'analisi che non lo sa è un'analisi che non serve.
Se non lo dichiari, l'analisi resta neutra e lo scrive.

### La regola, qui, è più stretta

Per il capo di gabinetto valeva: nessuna affermazione senza una fonte in memoria.
Per un contratto la regola giusta è un'altra, perché un'analisi costruita su una
clausola inesistente non è imprecisa, è pericolosa:

> **La clausola citata deve esistere testualmente nel contratto. Se non c'è,
> la sua analisi non viene mostrata.**

`matchQuote()` confronta dopo aver normalizzato quello che non cambia il
significato — virgolette tipografiche, trattini lunghi, a capo in mezzo alla
frase, spazi unificatori, trattini morbidi: il rumore che il testo estratto da un
PDF o da un DOCX si porta sempre dietro. **La punteggiatura no**: in un contratto
una virgola sposta un obbligo, e ignorarla renderebbe il confronto compiacente.

Tre esiti:

| Esito | Quando | Cosa succede |
|---|---|---|
| `exact` | il testo coincide dopo la normalizzazione | la clausola si mostra col bollo verde |
| `partial` | coincide un tratto contiguo di almeno 6 parole e del 60% della citazione | si mostra col bollo giallo e l'invito a rileggere l'originale |
| `missing` | nient'altro | **la clausola non esiste: viene scartata** |

E se qualcosa viene scartato, il pannello lo dice in cima: il verdetto
complessivo potrebbe essersi formato anche su quelle, quindi va riletto con
diffidenza. Nasconderlo sarebbe peggio che non verificare affatto.

### Cosa è verificato e cosa no

Questa distinzione è il punto, e confonderla sarebbe più dannoso che non
controllare niente:

- **La citazione è un fatto.** Viene confrontata col testo. Se non regge, sparisce.
- **Rischio, standard di mercato e controproposta sono giudizi.** Non sono
  verificabili contro niente, e vanno letti come si legge il parere di un collega
  giovane: utile per non partire da zero, non per firmare.

L'interfaccia li tiene visivamente separati apposta: la citazione in monospazio
dentro al suo riquadro col bollo, il resto fuori.

---

## Il brief, e i punti aperti

Fino a un certo punto BRAIN rispondeva **solo se interrogato**. Una memoria che
aspetta di essere cercata si usa due volte alla settimana: il valore c'è, ma te
lo devi andare a prendere.

Il brief gira **dopo la sincronizzazione notturna** e sta lì la mattina. Tre
sezioni, tutte che possono essere vuote:

- **Oggi e domani** — appuntamenti e scadenze con una data che cade adesso.
- **Cosa è arrivato** — non un riassunto della posta: solo le cose che
  richiedono qualcosa da te.
- **Conto** — i pagamenti senza giustificativo, presi dall'agente Amministrazione
  e quindi **calcolati senza modello**.

Non inventa una nuova forma di garanzia: usa la stessa. Ogni riga passa da
`verifyClaims()`, quindi è riconducibile a un documento in memoria esattamente
come una risposta chiesta a mano. Il fatto che non l'abbia chiesta nessuno non la
rende meno verificabile — semmai di più, perché nel momento in cui viene scritta
non c'è nessuno lì a rileggerla.

Aprire la console **non** riscrive il brief: quello che leggi è quello di
stanotte. Ricaricare la pagina non deve cambiare quello che ti è stato detto, e
non deve costare una chiamata al modello.

### E ti raggiunge

Il brief arriva per posta (o su un webhook), così il sistema non si limita a
partire da solo: **ti trova**.

La mail **non viene generata**. Il modello ha già scritto il brief e ogni riga è
già passata dal verificatore; `renderBriefEmail()` formatta e basta. Un secondo
giro di modello — *"riscrivimelo in forma di email"* — potrebbe dire cose che il
brief verificato non dice, e la garanzia costruita a monte varrebbe zero proprio
nel punto in cui esce di casa. Per lo stesso motivo **le fonti restano attaccate
a ogni riga anche nella mail**, link compresi: la posta non deve essere un
artefatto meno affidabile della console.

**Il brief non parte se non c'è niente da dire.** Una mail quotidiana che dice
"niente di nuovo" viene archiviata senza leggerla entro una settimana, e da lì in
poi non si legge nemmeno quella che conta. Servono almeno una riga in agenda, una
novità, una fattura mancante o un punto **fermo** — i punti aperti da soli non
bastano, quelli sono lì per definizione. Il silenzio diventa a sua volta
un'informazione.

> **Perché non con Gmail.** Sarebbe stata la strada comoda: il connettore c'è
> già. Ma gli scope di questo prodotto sono tutti `.readonly`, e l'unica cosa che
> li rende una garanzia e non una promessa è che nessuno li allarghi quando fa
> comodo. Aggiungere `gmail.send` significherebbe che da domani un agente *può*
> scrivere a nome tuo, e la frase "nessun agente può mandare una mail"
> smetterebbe di essere vera. La posta esce da un canale suo, separato, che non
> ha accesso a niente.

Due canali, entrambi facoltativi: **email** via Resend, e un **webhook** generico
che riceve il brief in JSON (il campo `text` è già pronto per un incoming webhook
di Slack). Senza nessuno dei due il brief resta sulla console e non si rompe
niente. Il pulsante *Provalo via mail* lo manda ignorando il controllo su "vale
la pena", perché al primo giro devi poter verificare che la posta esca davvero.

### I punti aperti si chiudono solo a mano

È la riga più preziosa del post che ha ispirato questo prodotto — *"i punti
aperti si trascinano finché non li chiudo io"* — ed è quella che nessun
assistente rispetta, perché ricordarsene costa uno stato e dimenticarsene no.

Qui è letterale. **Nessuna chiusura automatica, mai.** Il brief di domani non
lascia cadere un punto perché nessuno l'ha più nominato: se non se ne parla, il
punto resta e invecchia. `decidePoints()` sa fare due cose sole — aprire un punto
nuovo e riconoscerne uno che c'è già — e non sa chiudere.

L'età è la cosa che si guarda, non il numero: `nuovo` sotto i 3 giorni, `in
attesa` fino a 14, **`fermo`** oltre. Un punto fermo da tre settimane non è una
cosa da fare: è una decisione che stai rimandando, e l'etichetta rossa serve a
dirlo.

Il problema tecnico è che lo stesso impegno, riformulato dal modello il giorno
dopo, è una stringa diversa. Senza un riconoscimento tollerante la lista si
riempirebbe di doppioni e sarebbe inguardabile in una settimana. Quindi:

| Meccanismo | Cosa risolve |
|---|---|
| impronta a **sacco di parole ordinato** | "chiedere la fattura a Rossi" e "a Rossi, chiedere la fattura" hanno la stessa impronta, e il doppione identico lo ferma il vincolo di unicità del database |
| **somiglianza di Jaccard** ≥ 0.6 sui token | riconosce la riformulazione — "devo ancora rispondere a Bianchi sul rinnovo" ritrova "rispondere a Bianchi sulla proposta di rinnovo" |
| confronto anche **dentro lo stesso brief** | due frasi simili nello stesso giro non diventano due righe |

Fra più candidati vince il più somigliante, non il primo trovato.

---

## L'agente Amministrazione

Risponde a una domanda sola, ma è quella che costa più ore di chiunque altra:
**di quali soldi usciti non ho la fattura, e dove sta quella che ho già?**

Ordine dei risultati: **prima i movimenti per cui in memoria non esiste nessuna
fattura**, perché quelli sono lavoro da fare. Per ognuno c'è la mail già pronta
da mandare, costruita dai dati del movimento — importo, data, controparte — non
generata, perché non c'è niente da inventare e un testo deterministico non può
sbagliare la cifra che sta chiedendo.

I movimenti che il giustificativo ce l'hanno già non compaiono: un elenco di
cose a posto non serve a nessuno. E gli incassi nemmeno — quella fattura l'hai
emessa tu.

### Questo agente non usa nessun modello

Non è una scorciatoia, è la scelta giusta. Abbinare una fattura a un addebito è
aritmetica — un importo, una data, un nome — e delegarla a qualcosa che ogni
tanto può leggere male una cifra sarebbe un peggioramento pagato anche in
latenza e in costo. Il modello serve dove serve giudizio; sommare non è giudizio.

Conseguenza pratica: **questa scheda funziona anche senza `ANTHROPIC_API_KEY`**,
e risponde in un decimo di secondo.

Tre segnali, in quest'ordine: l'importo esatto, il nome della controparte, la
vicinanza nel tempo (finestra di 120 giorni). Senza importo identico non si è
nemmeno candidati — è il vincolo che tiene fuori il rumore. Ma l'importo da solo
non basta a dire "certa": due fornitori possono aver emesso la stessa cifra.

| Confidenza | Quando |
|---|---|
| `certa` | importo esatto **e** nome della controparte **e** dentro la finestra |
| `probabile` | importo esatto e uno solo fra nome e finestra |
| `debole` | importo esatto e nient'altro |

Ogni abbinamento porta le sue ragioni in chiaro — "importo identico (€ 1.250,00)
· controparte: bianchi · 5 giorni di distanza" — perché chi guarda deve poter
dire "sì, è questa" senza aprire niente.

### Due trappole che ci sono costate un bug

**Il formato degli importi.** "1.250,00" e "1,250.00" sono lo stesso numero con i
segni invertiti, e "1.250" da solo è ambiguo. La prima versione riconosceva il
formato *dentro alla regex* e su "1250,00" si fermava dopo tre cifre, leggendo
**125,00 invece di 1.250,00** — esattamente l'errore che questo modulo esiste per
impedire. Ora la regex prende il numero intero e il formato si decide in un posto
solo, in `parseAmount()`. C'è un test di regressione che porta quel nome.

**`Intl` dipende dalla build ICU.** `toLocaleString('it-IT')` su un runtime con
ICU ridotto restituisce "1250,00" invece di "1.250,00". Una funzione dichiarata
pura che cambia risultato secondo l'host non è pura — e qui il risultato finisce
sia dentro a una mail che chiede soldi a qualcuno, sia dentro al documento in
memoria che `parseAmounts()` poi rilegge per abbinare. Quindi `formatEuro()` e
`formatDay()` formattano a mano, e il connettore Qonto le usa.

---

## Il trigger

`GET /api/brain/cron` sincronizza tutti i connettori configurati **e poi scrive
il brief** — è il passaggio che dà senso a tutto il resto: senza, la memoria si
aggiornerebbe da sola senza dire mai niente a nessuno. Un brief fallito non fa
fallire il giro (la memoria aggiornata vale comunque) ma lascia la sua riga di
errore, e la console la mostra. Vercel lo chiama
ogni giorno alle **05:00 UTC** (`vercel.json`), cioè prima che la giornata
cominci: il momento in cui una memoria aggiornata serve davvero.

Non si autentica come il resto di BRAIN, perché qui non c'è nessuno loggato: c'è
uno scheduler. Il controllo è un segreto condiviso — Vercel manda
`Authorization: Bearer $CRON_SECRET` — confrontato a tempo costante.

> **Senza `CRON_SECRET` configurata l'endpoint risponde 401 a chiunque, Vercel
> compreso.** Chiuso per difetto: un segreto mancante non è un caso da trattare
> con indulgenza, è una porta spalancata su una memoria personale.

Ogni esecuzione finisce in `brain_runs` con l'agente `cron:sync`, **anche quando
fallisce**, e la scheda *Fonti* mostra l'esito dell'ultima. Il motivo è preciso:
un cron che ha smesso di girare in silenzio è peggio di un cron che non c'è,
perché la memoria *sembra* aggiornata.

Un connettore che fallisce non ferma gli altri. La finestra parte sempre
dall'ultima sincronizzazione riuscita **meno sei ore**, così un documento
arrivato in ritardo non cade nella fessura fra due esecuzioni; e siccome
`(fonte, id esterno)` è la chiave d'identità, la sovrapposizione non duplica
niente.

Per andare più fitto di una volta al giorno serve un piano Vercel che lo
consenta: si cambia solo la riga `schedule` in `vercel.json`.

---

## Configurazione

Nessuna chiave è obbligatoria per *vedere* la console: senza, `/brain` dice cosa
manca. Per farla funzionare servono, nell'ordine:

```bash
# 1. Memoria (obbligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # scrive e legge le tabelle brain_*

# 2. Chi può entrare (consigliato: senza, entra chi è admin del sito)
BRAIN_OWNER_EMAIL=tu@esempio.it

# 3. Il modello che risponde (obbligatorio per "Chiedi")
ANTHROPIC_API_KEY=sk-ant-...

# 4. La sincronizzazione automatica (senza, l'endpoint cron resta chiuso)
CRON_SECRET=una-stringa-lunga-e-casuale

# 5. La consegna del brief (facoltativa: senza, resta sulla console)
RESEND_API_KEY=re_...                  # email
BRAIN_MAIL_FROM=brain@tuodominio.it    # mittente verificato su Resend
BRAIN_MAIL_TO=tu@esempio.it            # se diverso da BRAIN_OWNER_EMAIL
BRAIN_WEBHOOK_URL=https://...          # in alternativa o in aggiunta: Slack, n8n, Telegram

# 6. Le fonti (una alla volta, quando servono)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
BRAIN_APP_URL=https://tuodominio.it   # solo dietro a un proxy
QONTO_LOGIN=...
QONTO_SECRET_KEY=...
OURA_TOKEN=...
```

Opzionale: `BRAIN_GMAIL_QUERY` sovrascrive il filtro di Gmail.

### Passi

1. **SQL Editor di Supabase** → incolla `supabase/migration_brain.sql` → Run.
   Poi `supabase/migration_brain_brief.sql` (il delta per i punti aperti).
2. Imposta `BRAIN_OWNER_EMAIL` e `ANTHROPIC_API_KEY`, riavvia.
3. Apri `/brain`, scheda **Memoria**, incolla una nota. Funziona già: chiedi
   qualcosa e guarda la fonte comparire sotto la frase.
4. Per Google: crea un OAuth client (tipo *Web application*) in Google Cloud
   Console, aggiungi come redirect URI `https://iltuodominio/api/brain/connect/google/callback`,
   abilita le API Gmail, Calendar e Drive. Poi scheda **Fonti** → *Collega Google*.
5. Qonto e Oura: basta la chiave nell'ambiente, poi *Sincronizza tutto*.
6. Imposta `CRON_SECRET` su Vercel e rifai il deploy: da lì in poi la memoria si
   aggiorna da sola, e la scheda *Fonti* dice quando è successo l'ultima volta.

---

## L'orchestrator

Per ogni tipo di task, il modello che rende meglio su quella singola azione:

| Task | Modello | Perché |
|---|---|---|
| `answer` | `claude-opus-5` | ragionamento lungo su fonti eterogenee |
| `extract` | `claude-haiku-4-5` | estrazione ripetitiva: conta la velocità |
| `draft` | `claude-sonnet-5` | testo per un umano: tono ed equilibrio |

La tabella prevede anche OpenAI e Google come alternative per riga, e
`pickModel()` sceglie il primo provider con una chiave. **Onestà sullo stato: in
questa versione l'unico provider con un esecutore è Anthropic.** Le altre righe
esistono perché il routing sia vero appena arriva la chiave, non per far
sembrare il sistema più grande di quello che è: se il routing sceglie un
provider non eseguibile, la chiamata fallisce dicendolo.

---

## Privacy

- **Le tabelle non sono leggibili dal client.** RLS attiva, zero policy: solo la
  service role key passa, e non lascia mai il server.
- **L'accesso è di uno.** Con `BRAIN_OWNER_EMAIL` entra solo quell'indirizzo;
  senza, solo chi è già amministratore. In assenza di configurazione si chiude,
  non si apre.
- **Gli scope sono `.readonly`.** Non è una policy interna: Google non
  concederebbe la scrittura nemmeno volendo.
- **Il refresh token sta in `brain_credentials`**, non in un cookie e non nel
  client.
- **"Dimentica" cancella davvero**: documento e pezzi, in cascata. Un secondo
  cervello senza questo tasto non è accettabile.
- **`robots: noindex`** su tutta la sezione.

---

## Metriche che contano

1. **Risposte in cui tutte le affermazioni hanno passato la regola 1** ← la metrica chiave
2. Affermazioni scartate per fonte inventata (deve tendere a zero)
3. Dettagli marcati dalla regola 2 (dice quanto ci si può fidare del modello del momento)
4. **Domande che scattano il secondo giro di ricerca** (se sono tante, i termini dei documenti e quelli che usi tu non coincidono)
5. **Correzioni registrate al mese** ← se è zero, o il sistema è perfetto o hai smesso di fidarti abbastanza da correggerlo. La seconda è più probabile.
4. Documenti in memoria per fonte, e quanti ne salta una sincronizzazione
5. Domande a cui il sistema risponde "non risulta" pur avendo il dato
6. Esecuzioni automatiche riuscite di fila (se scende, la memoria sta invecchiando)
7. Clausole scartate per citazione inesistente, sul totale analizzato
8. PDF entrati col solo titolo, sul totale dei PDF (dice quanto dell'archivio è scansionato)
9. Movimenti senza giustificativo, e quanti di questi trovano la fattura in memoria
10. **Punti aperti in stato `fermo`** ← la metrica più scomoda: misura le decisioni rimandate, non il sistema
11. Brief non spediti perché non c'era niente da dire (se è sempre zero, la soglia è troppo bassa)

La quinta è la più scomoda e la più utile: misura i buchi del *recupero*, non del
modello. `brain_runs` registra modello, pezzi letti e latenza di ogni risposta.

---

## Il passo dopo

L'architettura è già pronta per tutti e tre, senza toccare il nucleo:

- **Il brief a orari diversi.** Oggi è uno al giorno alle 05:00 UTC; un secondo
  giro a fine giornata cambierebbe solo la riga `schedule` in `vercel.json`.
- **Il post-call.** Nel post c'è, qui no, e non per dimenticanza: richiede una
  fonte di trascrizioni che questo sistema non ha. Il giorno in cui ci fosse, è
  un file in `lib/brain/agents/` come gli altri.
- **Push al posto del cron.** Gmail via Pub/Sub, webhook Qonto. Il connettore non
  cambia e nemmeno la memoria: cambia solo chi chiama `syncConnectors`.
- **DOCX, e poi OCR.** Il primo è una dipendenza; il secondo è un servizio a
  parte, perché dentro a una lambda non ci sta.
- **Altri agenti.** Ognuno è un file in `lib/brain/agents/` che recupera dalla
  memoria e passa da un verificatore deterministico — `verifyClaims()` per le
  affermazioni, `matchQuote()` per le citazioni testuali. I candidati dal post —
  amministrazione, post-call, preparazione dei 1:1 — leggono tutti dalla stessa
  memoria.
- **Azioni con approvazione.** Il punto d'innesto è un agente che produce una
  *bozza* (`task: 'draft'`) e la mette in una coda; a mandarla è un tocco umano.
  Con i connettori in sola lettura, oggi, non può partire niente per sbaglio.

---

## Comandi

```bash
npm run dev            # http://localhost:3000/brain
npm run test:brain     # 129 test del nucleo, nessuna dipendenza
npm test               # ONE TAP + BRAIN
npm run build
```
