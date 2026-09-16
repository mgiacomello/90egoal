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

Funzioni pure, senza rete e senza DOM. `npm run test:brain` — 50 test, zero
dipendenze.

| File | Ruolo | Perché non sta in un prompt |
|---|---|---|
| `lib/brain/chunk.ts` | spezza i documenti sui paragrafi, poi sulle frasi, con sovrapposizione | un taglio si verifica, un'intuizione no |
| `lib/brain/rank.ts` | ordina i pezzi: full-text, parole in comune, freschezza, persone nominate, frase esatta | un ordinamento si può testare |
| `lib/brain/cite.ts` | applica le due regole qui sopra | è la promessa del prodotto |
| `lib/brain/orchestrator.ts` | per ogni tipo di task, il modello che rende meglio | la scelta è una tabella, non un'opinione |
| `lib/brain/quote.ts` | una clausola citata esiste nel contratto? | è la promessa dell'agente Contratti |
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

## La memoria

Un solo formato per tutto quello che entra: **da dove viene, che cos'è, quando è
successo**. Il resto del sistema non sa nulla di Gmail o di Qonto.

```ts
type BrainDocument = {
  source: 'gmail' | 'gcal' | 'gdrive' | 'qonto' | 'oura' | 'manual'
  kind: 'email' | 'event' | 'file' | 'transaction' | 'health' | 'note'
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
GIN), `brain_credentials`, `brain_runs`. Tutte con **RLS attiva e nessuna
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
| **Google Drive** | OAuth Google, sola lettura | Documenti, Fogli e Presentazioni in testo; PDF **solo per titolo** |
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

### Il soffitto, dichiarato

- **I PDF entrano solo con il titolo.** Estrarne il testo è un lavoro a sé (OCR,
  layout, tabelle) e va fatto bene o non fatto: meglio un limite dichiarato — la
  riga finisce dentro al documento — che un corpo mezzo sbagliato citato come
  fonte.
- **La sincronizzazione parte da sola una volta al giorno**, non a ogni mail che
  entra. Il push in tempo reale (Gmail via Pub/Sub, webhook Qonto) accorcia la
  latenza, non aggiunge capacità: costa un pezzo di infrastruttura su Google
  Cloud e vale la pena solo quando la latenza diventa il problema.
- **Due agenti.** Il capo di gabinetto risponde e l'agente Contratti analizza;
  nessuno dei due scrive ancora bozze, prepara i 1:1 o abbina fatture e movimenti.

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

## Il trigger

`GET /api/brain/cron` sincronizza tutti i connettori configurati. Vercel lo chiama
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

# 5. Le fonti (una alla volta, quando servono)
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
4. Documenti in memoria per fonte, e quanti ne salta una sincronizzazione
5. Domande a cui il sistema risponde "non risulta" pur avendo il dato
6. Esecuzioni automatiche riuscite di fila (se scende, la memoria sta invecchiando)
7. Clausole scartate per citazione inesistente, sul totale analizzato

La quinta è la più scomoda e la più utile: misura i buchi del *recupero*, non del
modello. `brain_runs` registra modello, pezzi letti e latenza di ogni risposta.

---

## Il passo dopo

L'architettura è già pronta per tutti e tre, senza toccare il nucleo:

- **Push al posto del cron.** Gmail via Pub/Sub, webhook Qonto. Il connettore non
  cambia e nemmeno la memoria: cambia solo chi chiama `syncConnectors`.
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
npm run test:brain     # 50 test del nucleo, nessuna dipendenza
npm test               # ONE TAP + BRAIN
npm run build
```
