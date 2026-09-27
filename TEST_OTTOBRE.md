# 90 & Goal — Test campionati italiani (17 ottobre 2026)

Documento operativo per Max, Roberto e Marco. Nasce dalla call del 22 settembre,
dalla mail di Roberto (obiettivi e POA) e dalle schedine di Max del 23 settembre.

## Cosa abbiamo deciso in call

- Versione **Fun Game**, niente betting.
- **Solo PWA mobile**: si installa dal link, niente app native.
- **Test chiuso**, circa 100 persone: la community dei Mondiali più pochi nuovi.
- **Live semplice**: i dati si aggiornano quando si apre l'app.
- **Notifiche push**: escluse in call, poi aggiunte su decisione di Marco (25/9). Sono un canale
  in più, che ognuno attiva dal Profilo: il live funziona anche senza.
- Partner commerciale (DAZN o Lega) deciso dopo il test.

> Nota: gli appunti di Gemini (compito di Marco) prevedevano le push, la decisione in call e
> la mail di Roberto no. Marco ha scelto di includerle: vanno comunicate a Max e Roberto.

## Cosa è pronto nella piattaforma

| Area | Cosa fa |
|---|---|
| Schedine di campionato | Partite con ora e serie (A, B, C). Niente bonus supplementari. |
| Squadre di club | Sigla colorata al posto della bandiera. Prima le squadre senza bandiera sparivano dalla home e dal selettore prima/ultima rete. |
| Gestione schedine (admin) | Crea e modifica schedine dal telefono. Si può incollare l'elenco partite così com'è nel documento Word. |
| Live (admin) | Minuto più un tocco sulla squadra. Punteggi, minuti validi, recupero, prima e ultima squadra si calcolano da soli. |
| Live (giocatori) | Badge LIVE, partite in corso, minuti già azzeccati in verde, punti "finora", classifica provvisoria. Aggiornamento ogni 60 secondi, alla riapertura dell'app e col tasto "Aggiorna". |
| Classifica per torneo | La generale somma solo le schedine del torneo in corso. I Mondiali restano consultabili a parte. |
| Regole | Pagina `/regole` pubblica, con i casi particolari. |
| PWA | Icona, nome, avvio a schermo intero su `/schedine`, barra di navigazione in basso su telefono. |
| Test chiuso | Sito escluso dai motori di ricerca. Codice invito facoltativo per le nuove registrazioni. |
| Notifiche push | Gol in diretta (a scelta: tutti, o solo quando esce un tuo minuto), punti e posizione a fine giornata, promemoria prima della scadenza a chi non ha ancora giocato, messaggio libero dall'admin. Nessun costo esterno: Web Push standard. |
| Scadenza blindata | Dopo il calcio d'inizio il database rifiuta i pronostici, anche inviati aggirando l'app. Prima lo impediva solo la pagina, e col live visibile sarebbe stato un modo per barare. |

## Messa online: l'ordine conta

Il database è unico per anteprima e produzione. La migration archivia le schedine dei
Mondiali e carica quelle nuove. Se la si esegue prima del rilascio, la produzione attuale
mostrerebbe le partite nuove senza squadre selezionabili. Quindi:

1. Merge del branch su `main`: Vercel pubblica la nuova versione.
2. Subito dopo, nel SQL Editor di Supabase: `supabase/migration_campionato.sql` → Run.
   È idempotente: rilanciarla non duplica nulla.
3. Rendere admin Max (e chi farà il live):
   ```sql
   update public.profiles set is_admin = true where username = 'nickname_di_max';
   ```
4. Notifiche push:
   - SQL Editor: `supabase/migration_push.sql` → Run.
   - `/admin` → **Notifiche push** → "Genera le chiavi". Copiare le tre righe in Vercel
     (Settings → Environment Variables, Production e Preview) e rifare il deploy.
   - Dal proprio Profilo: "Attiva". Poi in admin: "Prova sul mio telefono".
5. Se si vuole il codice invito:
   ```sql
   update public.impostazioni set valore = 'GOAL17' where chiave = 'codice_invito';
   ```
   Chi è già registrato entra sempre. Per riaprire a tutti: `valore = ''`.

## Max: configurare e verificare le schedine

Le quattro schedine del documento sono già caricate dalla migration. Nomi uniformati
("Forlì", "Atalanta U23", "Juve Stabia"), perché il bonus prima/ultima squadra confronta
i nomi lettera per lettera.

Da `/admin` → **Gestione schedine**:

- **1° novembre e 7 novembre**: mancano gli orari. La scadenza è provvisoria
  (12:30 e 14:30). Vanno completati appena verificati i calendari.
- **1° novembre**: "Carpi Renate" era senza trattino, caricata come Carpi – Renate. Da confermare.
- **Tutte**: confermare squadre e orari sui calendari ufficiali. Il tasto
  "= primo calcio d'inizio" imposta la scadenza da solo.
- Una schedina si toglie di mezzo togliendo la spunta "Attiva": va in archivio.

## Il giorno delle partite

1. `/admin` → **Live · inserimento gol**, scegli la schedina.
2. Al calcio d'inizio metti la partita su **● Live**.
3. A ogni gol: scrivi il minuto (`23`, oppure `45+2` e `90+3` per il recupero) e tocca la squadra.
   Autogol: la squadra che ne beneficia.
4. A fine partita: **Finita**. Quando sono finite tutte, la classifica è definitiva.
5. **Una sola persona per schedina**: due persone insieme si sovrascrivono.
   Un gol sbagliato si toglie toccandolo (la notifica già partita non si ritira: meglio
   un secondo di controllo prima del tocco).
6. Ogni gol inserito parte come notifica. La casella "📣 Notifica i giocatori a ogni gol"
   la spegne, utile nei test. Quando l'ultima partita va su "Finita", il pannello chiede se
   mandare a ciascuno punti e posizione.
7. Il promemoria di scadenza si manda a mano da **Notifiche push**, di solito 2 ore prima.

## Notifiche: cosa sapere

- **iPhone**: solo con l'app aggiunta alla schermata Home e iOS 16.4 o successivo. Da Safari
  "normale" non arrivano. È il punto da spiegare bene ai tester.
- **Android**: funzionano da Chrome e dall'app installata.
- Chi riceve i gol: solo chi ha giocato quella schedina. Chi sceglie "Solo i miei minuti"
  riceve solo i gol che gli portano punti.
- Un gol vecchio di 15 minuti non viene più consegnato: se il telefono era spento, non arriva
  una raffica di gol superati.
- Dispositivi che revocano il permesso vengono tolti da soli al primo invio.

## Test interno (massimo 10 persone)

Proposta: sabato 10 o domenica 11 ottobre, prima del 17.

- Se ci sono partite vere quel weekend, Max crea una schedina con 5–10 partite e
  torneo "Test interno", così non entra nella classifica vera.
- Se non ci sono, si fa un **replay**: schedina su una giornata già giocata, scadenza
  qualche ora prima, e Max reinserisce i gol dal tabellino in tempo reale.
- Cosa guardiamo: tempi di compilazione da telefono, installazione della PWA su iPhone
  e Android, notifiche che arrivano davvero (e quanto in ritardo), chiarezza dei punti
  durante il live, errori di inserimento lato admin.

## Tempistiche proposte

| Quando | Cosa | Chi |
|---|---|---|
| entro 1/10 | Piattaforma in anteprima, verifica schedine | Marco, Max |
| 5/10 | Call di avanzamento con demo | tutti |
| 10–11/10 | Test interno | Marco, Max, ~10 persone |
| 12–14/10 | Correzioni | Marco |
| 14/10 | Invito alla community con link (e codice) | Max, Roberto |
| 17/10 | Prima giornata live | Max al pannello live |

## Da decidere (proposte già scritte nelle regole)

1. **Minuto valido**: quello del tabellino ufficiale, cioè il minuto in corso
   (23:40 = 24'). Serve una fonte unica per chi inserisce i gol.
2. **Scadenza**: calcio d'inizio della prima partita (prima era mezzanotte del giorno prima).
3. **Partita rinviata o sospesa**: valgono i gol segnati nel giorno della schedina.
4. **Codice invito**: sì o no.
5. **Link al "Salone"** (gioco per bambini): tolto dalla barra di navigazione, la pagina resta raggiungibile.

## Rischi da tenere d'occhio

- **Privacy**: il gioco raccoglie email, tempi di permanenza e iscrizioni alle notifiche,
  ma non ha un'informativa. Per un test con persone esterne serve prima del 17/10.
  Il "messaggio a tutti" va usato per il gioco, non per promozioni: per quelle servirebbe
  un consenso specifico.
- **Premi**: finché è gratis e senza premi è un gioco. Un premio può far scattare le regole
  sulle manifestazioni a premio (DPR 430/2001). Una quota di partecipazione insieme a un
  premio in denaro porta nel perimetro dei giochi riservati (concessione ADM).
  Va valutato prima di parlare di 0,50 € a schedina.
- **Riservatezza verso i partner**: prima di mostrare il POC a DAZN o alla Lega serve un
  NDA con clausola di non aggiramento, a tutela della versione betting.
