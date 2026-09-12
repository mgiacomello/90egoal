# ONE TAP (`/onetap`)

**Vedi una cosa → ONE TAP capisce → tocchi una volta → fatto.**

App consumer autonoma che vive dentro a questo deploy. Non è un assistente, non è
una chat, non è una dashboard: è **un solo bottone** che trasforma quello che hai
davanti nell'azione più utile.

Provala su `/onetap`. Non serve un account, e si apre direttamente sulla home:
il "momento magico" resta raggiungibile da *How it works*, ma non fa da cancello
— chi vuole caricare subito una foto non deve prima attraversare una demo.

---

## Cosa fa, in concreto

| Vedi | ONE TAP mostra | Un tap e |
|---|---|---|
| `+39 333 1234567` | **CALL** | parte la chiamata |
| `Via Dante 15, Milano` | **NAVIGATE** | si apre Mappe con la destinazione |
| `IT60X05428111010…` | **COPY** | l'IBAN è negli appunti |
| `hello@example.com` | **EMAIL** | si apre il client di posta |
| `Cena da Nobu, martedì 19:30` | **ADD TO CALENDAR** | l'evento è pronto da salvare |
| `"Possiamo spostare a giovedì?"` | **REPLY** | tre risposte pronte, una la scegli |
| QR / codice a barre | dipende dal contenuto | letto **sul dispositivo**, senza rete |

Se le azioni possibili sono più d'una, ONE TAP ne sceglie **una** e mette le altre
in secondo piano. Se non è sicuro lo dice (*"Credo che tu voglia…"*). Se è
davvero incerto fa una domanda invece di indovinare.

---

## L'idea architetturale: l'AI trascrive, il codice decide

```
immagine ──► modello vision ──► testo trascritto ──► motore deterministico ──► azione
                (trascrive)                            (decide)
testo    ─────────────────────────────────────────────►
```

`lib/onetap/detect.ts` è una funzione pura, senza DOM e senza rete: dato un testo
restituisce entità (telefono, IBAN validato col mod-97, indirizzo, data/ora, url,
email, OTP, Wi-Fi) e un elenco di azioni ordinate per punteggio.

Perché conta: **l'azione non può essere allucinata.** Il modello non sceglie mai
cosa fare, si limita a leggere. Se un numero non è nel testo trascritto, nessuna
azione lo può proporre. Ed è testabile: `npm run test:onetap` (36 test, zero
dipendenze).

Conseguenza pratica: testo digitato, incollato, dettato, condiviso o letto da un
QR **non tocca la rete**. L'analisi è istantanea e gratuita. Il modello serve solo
per le immagini e per rifinire le risposte suggerite.

### File

| File | Ruolo |
|---|---|
| `lib/onetap/detect.ts` | il motore: entità, ranking, confidenza, risposte di fallback |
| `lib/onetap/actions.ts` | dall'azione all'href/ICS/vCard/clipboard |
| `lib/onetap/image.ts` | ridimensionamento, lettura QR locale, clipboard |
| `lib/onetap/storage.ts` | cronologia e contatore, store esterno su `localStorage` |
| `lib/onetap/demo.ts` | gli 8 scenari della demo |
| `app/api/onetap/analyze/route.ts` | unica chiamata al modello (OpenAI-compatibile) |
| `app/onetap/share/route.ts` | bersaglio dello share sheet (fallback senza service worker) |
| `public/onetap/sw.js` | riceve gli screenshot condivisi dal sistema |
| `components/onetap/*` | la UI |

---

## Configurazione

Serve una sola variabile per far funzionare la lettura delle immagini:

```
GROQ_API_KEY=...
```

Opzionali, per cambiare provider o modello (l'endpoint deve essere
OpenAI-compatibile):

```
ONETAP_AI_BASE_URL=https://api.groq.com/openai/v1
ONETAP_AI_KEY=...                # se diversa da GROQ_API_KEY
ONETAP_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
ONETAP_TEXT_MODEL=llama-3.3-70b-versatile
```

**Senza chiave l'app resta usabile, foto comprese.** Se il modello remoto non è
configurato o non risponde, l'immagine viene letta **sul dispositivo** con un
motore OCR servito da questo stesso dominio (`public/onetap/ocr`, copiato da
`node_modules` a ogni build da `scripts/onetap-ocr-assets.mjs`; i dati di lingua
sono versionati). Niente CDN: andare a prendere il motore da un terzo
contraddirebbe la promessa per cui la lettura locale esiste.

Il primo utilizzo scarica il motore una volta (~7 MB, poi resta in cache). La
lettura locale è più lenta e meno precisa di quella del modello: ed è un bene
che si veda, perché è lì che il controllo del checksum guadagna il suo posto —
su uno screenshot di fattura l'OCR ha letto `IT60X054281110100000**9**123456`
invece di `...0123456`, il mod-97 non è tornato, e ONE TAP **non** ha proposto di
copiare un IBAN sbagliato: è ricaduto sull'indirizzo. Un errore di lettura che
sarebbe finito dentro a un bonifico è stato fermato da tre righe di aritmetica.

---

## Privacy by design

- **La cronologia non esiste sul server.** Sta in `localStorage`, e non c'è alcun
  endpoint che possa rileggerla. "Delete everything" cancella davvero tutto.
- **Le immagini non vengono salvate.** Passano in memoria dentro all'handler,
  vanno al modello, e finiscono lì: niente disco, niente database, niente log,
  nessun URL pubblico.
- **Meno rete possibile.** QR e codici a barre sono letti dal browser; il testo
  non lascia mai il dispositivo, tranne quando serve rifinire le tre risposte.
- **Niente training.** Il contenuto dell'utente non viene usato per addestrare
  modelli.
- **Niente indicizzazione:** `robots: noindex` su tutta la sezione.
- Le foto vengono ridotte a 1400px lato lungo *prima* di partire: meno byte,
  meno latenza, meno dati.

---

## Portarla fuori dall'app (`/onetap/install`)

Guida interna che rileva il dispositivo e dà i passi giusti. Il punto: l'app
non va aperta, si arriva all'azione da dove si è già.

**Android** — "Installa app" da Chrome e basta: il `share_target` del manifest
è onorato dal sistema, quindi ONE TAP compare nel menu di condivisione per
immagini, testo e link. Il service worker (`public/onetap/sw.js`) intercetta la
POST, mette il file nella Cache Storage del dispositivo e rimanda all'app, che
lo legge e lo cancella: **l'immagine non passa dal server**. Al primo utilizzo,
prima che il worker sia attivo, `app/onetap/share/route.ts` chiede di riprovare
invece di salvare il file lato server.

**iPhone** — Safari **non implementa** i Web Share Target: una PWA non può
comparire nel menu di condivisione di iOS, punto. La strada che funziona è un
comando dell'app Comandi (Ricevi Immagini dal menu di condivisione → *Estrai
testo dall'immagine* → *Codifica URL* → *Apri URL* su `/onetap?text=…`), che si
costruisce in due minuti. Effetto collaterale ottimo: l'OCR è quello di Apple,
gira sul telefono, quindi su questa strada **l'immagine non lascia mai il
dispositivo** e non serve nemmeno la chiave AI. Si aggancia poi a Tocco
posteriore o al tasto Azione.

**Desktop** — installazione dalla barra degli indirizzi, poi ⌘V/Ctrl+V ovunque
nell'app, o trascinare il file.

### Il soffitto, dichiarato

Nessuna web app può stare sopra alle altre app, intercettare i messaggi in
arrivo o leggere il rullino: **non esiste un permesso browser per la galleria**,
su nessuna piattaforma. Un'immagine arriva a ONE TAP solo se la scatti, la
condividi, la incolli o la scegli — ed è esattamente il confine su cui regge la
promessa di privacy. Le parti mancanti (azione sulla foto stessa, azioni dentro
alle notifiche, tile in lock screen) richiedono un'app nativa: è il passo dopo
questo MVP, e il motore che decide l'azione non cambierebbe.

## Modello di business (misurato, non applicato)

Free: 20 azioni al mese. Pro: illimitate, €4.99/mese.

Nell'MVP **il contatore non blocca nulla** e non c'è alcun pagamento: serve solo
a capire se qualcuno arriva davvero al limite. Se nessuno lo raggiunge, il
prodotto non serve abbastanza; se tutti lo superano la prima settimana, c'è un
business.

---

## Metriche che contano

1. **Azioni per utente attivo al giorno** ← la metrica chiave
2. Tempo dalla cattura all'azione
3. % di azioni completate con un solo tap (nessuna secondaria toccata)
4. Accuratezza della detection (confidenza alta vs. domande fatte all'utente)
5. Ritorno a 7 giorni

Il contatore mensile e la cronologia locale bastano per le prime tre senza
raccogliere niente lato server.

---

## Estensioni future già previste dall'architettura

Il motore è una funzione pura su testo: ogni nuovo canale deve solo procurarsi
del testo e poi chiamare `analyze()`.

- **Estensione browser / desktop** → `analyze()` gira tale e quale, lato client.
- **Share sheet Android/iOS** → già attivo via `share_target` nel manifest.
- **WhatsApp, email, notifiche** → nuovo ingresso, stesso motore.
- **Nuove azioni** (PAY, BUY, SIGN, TRANSLATE avanzato) → una voce in `ActionKind`,
  un punteggio in `analyze()`, un href in `actionHref()`.
- **Esecuzione tramite agente** → il punto di innesto è `runAction()`, che oggi
  apre link e genera file.
- **SDK/API B2B** → `app/api/onetap/analyze` è già l'API: immagine o testo in,
  azioni ordinate out.

---

## Comandi

```bash
npm run dev            # http://localhost:3000/onetap
npm run test:onetap    # 36 test del motore, nessuna dipendenza
npm run onetap:icons   # rigenera le icone PWA
npm run build
```
