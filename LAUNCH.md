# ONE TAP — lancio come app

Stato al 16 settembre 2026. Il prodotto funziona su foto vere: chiama, scrive,
naviga, salva in calendario, rubrica e note. Questa pagina dice cosa manca fra
"funziona" e "è lanciata", chi deve farlo, e in che ordine.

## Già fatto nel codice

- PWA installabile (manifest completo con icone, screenshot, scorciatoie,
  share target Android), guida di installazione in `/onetap/install`.
- Lettura con Claude (fallback Groq, poi OCR sul dispositivo), motore
  deterministico che decide l'azione, 60 test.
- Protezioni dell'API: limite di 20 richieste al minuto per IP,
  immagine massima 8 MB, nessun log del contenuto.
- Informativa privacy (`/onetap/privacy`) e termini (`/onetap/terms`) scritti
  sul comportamento reale del software, linkati dal footer e dal pannello
  "Your data".
- Anteprima social del link (`/onetap/og.png`, Open Graph e Twitter card).
- Contatore mensile gratuito (20 azioni) e scheda Pro a 4,99 €/mese: misurati,
  non ancora applicati.

## Da fare prima del lancio (in ordine)

### 1. Identità legale — 10 minuti, tuo
Compila `lib/onetap/legal.ts`: Titolare, email di contatto. Rileggi privacy e
termini con il tuo occhio: sono una bozza fedele al codice, non un parere.
Verifica nelle condizioni API di Anthropic il periodo di conservazione per
sicurezza e la base del trasferimento extra-UE (DPA con SCC), e allinea il
paragrafo "Dove vanno le immagini" se serve.

### 2. Dominio e chiavi — 30 minuti, tuo
- Un dominio dedicato (es. `onetap.app`, `getonetap.it`) collegato al progetto
  Vercel. Poi imposta `NEXT_PUBLIC_SITE_URL=https://tuodominio` fra le variabili
  Vercel: alimenta i link assoluti dell'anteprima social.
- Chiave Anthropic di produzione con limite di spesa mensile impostato in
  console e un avviso via email al 50% e all'80%. Una cattura è un'immagine da
  circa 1.500 token più una risposta breve: pochi centesimi con il modello
  attuale. Controlla il listino in console e, se il costo pesa, passa a un
  modello più piccolo cambiando una riga (`ONETAP_ANTHROPIC_MODEL` fra le variabili Vercel, letta in
  `app/api/onetap/analyze/route.ts`).

### 3. Marchio — tuo
"ONE TAP" è descrittivo e affollato (classe 9 e 42). Prima di spendere in
store e comunicazione: ricerca di anteriorità su EUIPO/UIBM e, se il nome
regge, deposito. Altrimenti meglio scegliere un nome distintivo ora che dopo.

### 4. Store — il percorso più corto

**Android (Google Play)**: nessun codice nativo. Si impacchetta la PWA come
Trusted Web Activity.
1. Account Google Play Console (25 $ una tantum).
2. Su <https://www.pwabuilder.com> inserisci l'URL di produzione, scarica il
   pacchetto Android (`.aab`) e il file `assetlinks.json` con l'impronta della
   chiave di firma.
3. Pubblica `assetlinks.json` in `public/.well-known/assetlinks.json` e
   ridistribuisci: senza, l'app apre con la barra del browser.
4. Carica l'`.aab`, compila la scheda (usa gli screenshot in
   `public/onetap/screenshots/`, l'icona 512 e il testo sotto).

**iPhone (App Store)**: Apple non accetta una PWA "nuda". Serve un guscio
Capacitor che carica l'URL di produzione con fotocamera, foto e condivisione
native.
1. Apple Developer Program (99 $/anno) e un Mac con Xcode.
2. Progetto Capacitor con `server.url` verso il dominio di produzione, plugin
   Camera e Share, icona e splash da `public/onetap/`.
3. Estensione Share per ricevere immagini dal foglio di condivisione (oggi su
   iPhone si passa da un Comando rapido, spiegato in `/onetap/install`).
4. Revisione Apple: prepara la risposta alla regola 4.2 (l'app non è "solo un
   sito": fotocamera, condivisione e azioni native lo dimostrano).

Fino a quando gli store non sono pronti, il lancio è già possibile come web
app: il link si apre, si installa in home, e su Android entra nel menu di
condivisione.

### 5. Testo per gli store (bozza)

- **Nome**: ONE TAP
- **Sottotitolo**: Fotografa. Capisce. Un tocco.
- **Descrizione breve**: Inquadra un numero, un indirizzo, una locandina, un
  biglietto da visita o una lavagna: ONE TAP capisce cos'è e prepara l'azione
  giusta. Un tocco e sei già nell'app che serve.
- **Categoria**: Produttività. **Età**: 16+.
- **Privacy labels (App Store) / Data safety (Play)**, ricavati dal codice:
  foto e testo trattati solo per fornire la funzione, non collegati
  all'identità, non usati per tracciamento, non conservati; indirizzo IP solo
  per sicurezza, non registrato; nessun dato condiviso con terzi oltre al
  fornitore del modello per l'elaborazione.

### 6. Prima del "pubblica" — 1 ora, insieme
- Misura: Vercel Web Analytics (senza cookie, compatibile con l'informativa
  così com'è) per catture al giorno, tasso di azione eseguita, errori API.
- Errori: Vercel Logs bastano al primo mese; Sentry quando ci sono utenti.
- Prova su 3 telefoni veri (un iPhone, un Android recente, un Android
  economico) i quattro gesti: foto, screenshot condiviso, incolla, QR.
- Un indirizzo di supporto che legge qualcuno.

## Decisioni da prendere (non urgenti, ma tue)

- **Il limite gratuito è aggirabile**: vive nel browser. Per applicarlo davvero
  serve un'identità (Supabase è già nel progetto: login con email o Apple/
  Google) e un contatore lato server. Consiglio: lanciare senza gate, guardare i
  numeri un mese, poi decidere se il Pro va a consumo o ad abbonamento.
- **Lingua**: l'interfaccia è mista (etichette azione in inglese, testi in
  italiano). Per l'Italia scegli l'italiano pieno; per il resto d'Europa
  l'inglese con l'italiano come seconda lingua. È un pomeriggio di lavoro.
- **Offline**: oggi senza rete l'app non si apre (il service worker gestisce
  solo la condivisione). Un guscio offline con lettura OCR locale è possibile
  ed è già previsto dall'architettura.
