# 90 & Goal — Test campionati italiani (17 ottobre 2026)

Documento operativo per Max, Roberto e Marco. Nasce dalla call del 22 settembre,
dalla mail di Roberto (obiettivi e POA) e dalle schedine di Max del 23 settembre.

## Cosa abbiamo deciso in call

- Versione **Fun Game**, niente betting.
- **Solo PWA mobile**: si installa dal link, niente app native.
- **Test chiuso**, circa 100 persone: la community dei Mondiali più pochi nuovi.
- **Live semplice, senza notifiche push**: i dati si aggiornano quando si apre l'app.
- Partner commerciale (DAZN o Lega) deciso dopo il test.

> Nota: negli appunti di Gemini il compito di Marco dice "incluso il sistema di notifiche
> push". È in contrasto con la decisione concordata e con la mail di Roberto. Si procede
> **senza push**.

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
4. Se si vuole il codice invito:
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
   Un gol sbagliato si toglie toccandolo.

## Test interno (massimo 10 persone)

Proposta: sabato 10 o domenica 11 ottobre, prima del 17.

- Se ci sono partite vere quel weekend, Max crea una schedina con 5–10 partite e
  torneo "Test interno", così non entra nella classifica vera.
- Se non ci sono, si fa un **replay**: schedina su una giornata già giocata, scadenza
  qualche ora prima, e Max reinserisce i gol dal tabellino in tempo reale.
- Cosa guardiamo: tempi di compilazione da telefono, installazione della PWA su iPhone
  e Android, chiarezza dei punti durante il live, errori di inserimento lato admin.

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

- **Privacy**: il gioco raccoglie email e tempi di permanenza, ma non ha un'informativa.
  Per un test con persone esterne serve prima del 17/10.
- **Premi**: finché è gratis e senza premi è un gioco. Un premio può far scattare le regole
  sulle manifestazioni a premio (DPR 430/2001). Una quota di partecipazione insieme a un
  premio in denaro porta nel perimetro dei giochi riservati (concessione ADM).
  Va valutato prima di parlare di 0,50 € a schedina.
- **Riservatezza verso i partner**: prima di mostrare il POC a DAZN o alla Lega serve un
  NDA con clausola di non aggiramento, a tutela della versione betting.
