This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🧠 BRAIN (`/brain`)

Il **capo di gabinetto** di una persona sola. Non una chat sui documenti: l'agente
che ha letto tutto — Gmail, Calendar, Drive, movimenti Qonto, anello Oura — e che
risponde per punti, con accanto a ogni punto **la fonte, la data e il canale**.

La regola che lo distingue da un assistente qualsiasi: *non gli è permesso sapere
niente che non sia in memoria*. E non è affidata al prompt. Il modello compila una
risposta strutturata in cui ogni affermazione dichiara le fonti da cui viene, poi
`lib/brain/cite.ts` verifica: **un'affermazione che cita una fonte inesistente non
viene mostrata**, e un importo o un IBAN che non compare nelle fonti citate da
quella frase viene marcato. È il parente stretto del controllo mod-97 di ONE TAP.

Ogni notte, dopo la sincronizzazione, si scrive il **brief**: cosa c'è oggi, cosa
è arrivato che richiede qualcosa da te, quali pagamenti non hanno giustificativo.
Ti arriva per posta, e ricaricare la pagina non lo riscrive. La mail **non viene
generata**: il brief è già verificato, l'email lo formatta e basta, fonti
comprese. E non parte se non c'è niente da dire. Sotto ci sono i **punti
aperti**, che **si chiudono solo a mano**: nessuno li toglie perché non se ne
parla più, e più invecchiano più si vedono — è la differenza fra una memoria e un
dimenticatoio con la barra di avanzamento.

Quando la ricerca trova poco, il modello propone *altre parole con cui la stessa
cosa potrebbe essere scritta* — e non vede nessun documento mentre lo fa, quindi
non può proporre una risposta. E se non trova niente, lo dice in modo
verificabile: *«ho cercato "pricing", "listino", "tariffe" su 1.240 documenti»*.
Così **«non risulta» si può smentire**, invece di doverci credere.

Sotto ogni affermazione c'è un `✗ correggi`, e **una correzione è memoria**: un
documento come gli altri, cercato e citato come gli altri, che però pesa più di
qualunque fonte — anche più recente. La precedenza è scritta dentro al documento,
non nel prompt, così viaggia col dato verso qualunque agente lo peschi.

Il secondo agente, **Contratti**, applica la stessa idea con una regola più
stretta: la clausola citata deve esistere *testualmente* nel contratto, altrimenti
la sua analisi non viene mostrata. Per ognuna dà rischio, standard di mercato e
controproposta pronta — e tiene ben separato quello che ha verificato (la
citazione) da quello che è un giudizio (tutto il resto).

Il nucleo — spezzettamento, ranking, verifica di citazioni e clausole, routing —
è fatto di funzioni pure: `npm run test:brain`, 120 test, zero dipendenze. I
connettori sono **tutti in sola lettura**, con scope OAuth `.readonly`: nessun
agente può scrivere una mail o disporre un pagamento, e la memoria si aggiorna
da sola una volta al giorno via cron.

Il terzo, **Amministrazione**, dice di quali soldi usciti manca la fattura e
quale documento in memoria potrebbe esserlo, con le ragioni in chiaro e la mail
pronta da mandare. Questo **non usa nessun modello**: abbinare una fattura a un
addebito è aritmetica, e l'aritmetica non si delega a qualcosa che ogni tanto può
leggere male una cifra. Funziona anche senza chiave AI.

I PDF con un livello di testo si leggono; quelli scansionati **no, e viene detto
dentro al documento** invece di riempire la memoria con quattro righe di
intestazione che poi un agente citerebbe come fonte.

Le tabelle `brain_*` hanno RLS attiva e nessuna policy: dal browser non sono
raggiungibili. Setup, limiti dichiarati e roadmap in **[BRAIN.md](BRAIN.md)**.

## ⚡ ONE TAP (`/onetap`)

App consumer autonoma inclusa in questo deploy: **vedi una cosa → ONE TAP capisce
→ tocchi una volta → fatto.** Fotografi (o incolli, o condividi) un numero, un
indirizzo, un IBAN, una fattura, un evento o un messaggio, e ONE TAP mostra *una*
azione grande — CALL, NAVIGATE, COPY, ADD TO CALENDAR, REPLY — che parte con un
solo tap.

Il modello si limita a **trascrivere**: a decidere l'azione è un motore
deterministico (`lib/onetap/detect.ts`, 36 test), quindi l'azione proposta non può
essere inventata. Testo, QR e demo funzionano **senza rete e senza chiave API**;
la chiave serve solo per leggere le foto.

Cronologia e contatore restano nel browser: nessuna copia sul server, nessuna
immagine salvata. Dettagli, configurazione e roadmap in **[ONETAP.md](ONETAP.md)**.

## 🎀 Salone di Bellezza (`/salone`)

Mini-gioco per bambini incluso nell'app, pensato per tablet e telefono.

- Si sceglie una modella già pronta (6 personaggi) oppure si carica una foto.
- Sui capelli si lavora **direttamente sul ritratto**, col dito o col mouse:
  - 🤲 **Mani** — si trascina una ciocca: verso l'alto esce la coda (fino in cima
    lo chignon), di lato le treccine, verso il basso tornano sciolti.
  - ✂️ **Forbici** — si tocca all'altezza voluta e lì i capelli si accorciano
    (con ciocche che cadono e schiocco delle lame); 🪄 li fa ricrescere.
  - 🧴 **Shampoo** — si strofina e arrivano le bolle di schiuma.
  - 🥥 **Balsamo** — si spalma sui capelli bagnati: dopo il phon restano lisci e
    lucidi invece che gonfi.
  - 🚿 **Doccia** — l'acqua scorre dove passi il dito, porta via la schiuma un po'
    alla volta e **sbiadisce le tinte fantasia** (rosa, azzurro, lilla, menta)
    fino a riportare il colore naturale.
  - 🌬️ **Phon** — asciuga i capelli bagnati e mentre si asciugano si gonfiano
    (col balsamo restano morbidi). Acqua e phon hanno anche il loro rumore.
- Si trucca **col dito** disegnando sul viso (rossetto, ombretto, fard sfumato,
  glitter, gomma per correggere) oltre al trucco veloce a pastiglie; più ciglia,
  lentiggini e glitter.
- Si veste: 6 capi, 12 colori, 5 fantasie, occhiali, corona/cerchietto/cappello, gioielli.
- Durante shampoo e doccia la scena cambia: bagno piastrellato e personaggio
  **nella vasca** (con paperella). Si entra e si esce anche col pulsante 🛁;
  quando il phon finisce, esce da sola.
- **🎁 Sorpresa** fa uscire del cibo: si trascina (o si tocca) sulla bocca e il
  personaggio lo mangia, con tanto di bocca aperta e cuoricini.
- Un **tutorial** in nove passi guida al primo avvio e si riapre con "❓ Come si gioca".
- Il look si salva nel "book" (fino a 12, nel browser) e si scarica come PNG.

Note tecniche: è tutto client-side, il disegno è un SVG (`components/salone/Avatar.tsx`)
esportato in PNG via canvas. **Le foto caricate non lasciano mai il dispositivo**: vengono
ridimensionate nel browser e tenute in memoria, nessun upload verso il server o Supabase.
La pagina è pubblica (non richiede login).
