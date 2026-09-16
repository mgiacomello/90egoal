# 🚀 Deploy di 90 & Goal su Vercel

Il repository git è già pronto con un commit iniziale e `.env.local` **escluso** (le chiavi non vengono caricate online).

## Variabili d'ambiente da impostare su Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://jzxeasfovkigtyptspan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_A98sGzVNr9A_uzbYpts4gQ_eO_uiw8l
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
```
(La `SUPABASE_SERVICE_ROLE_KEY` non è necessaria per il funzionamento attuale.)

### Quale chiave mettere

**`ANTHROPIC_API_KEY` è la scelta migliore per ONE TAP.** Claude legge le foto
molto meglio: su una fattura storta o un cartello in penombra la differenza fra
leggere e indovinare è tutta lì. Si prende su
<https://console.anthropic.com> → **API Keys**. Se c'è, l'app la usa e ignora le
altre; il modello è `claude-opus-5`, sovrascrivibile con
`ONETAP_ANTHROPIC_MODEL`.

**`GROQ_API_KEY` è l'alternativa** (endpoint OpenAI-compatibile), e serve
comunque all'assistente della home.

Ordine con cui l'app sceglie: Anthropic → OpenAI-compatibile → lettura sul
dispositivo. **L'ultima non richiede niente e funziona sempre**: le foto si
analizzano anche a chiavi zero, solo con meno precisione sul testo fitto.

### `GROQ_API_KEY` — a cosa serve

Una sola chiave, due funzioni:

- l'assistente della home (`/api/ask`), che senza chiave risponde *"AI non
  configurata"*;
- la lettura delle foto di ONE TAP (`/api/onetap/analyze`).

Si prende gratis su <https://console.groq.com> → **API Keys** → *Create API Key*.

**Importante: su Vercel va spuntata anche l'anteprima.** Le variabili sono per
ambiente: se la chiave è solo su *Production*, i deployment di anteprima non la
vedono e sembrano rotti. Settings → Environment Variables → seleziona
**Production, Preview e Development**. Dopo averla aggiunta serve un nuovo deploy
(Deployments → ⋯ → *Redeploy*): le variabili vengono lette al build.

**Senza chiave ONE TAP resta usabile**: testo, incolla, QR e demo funzionano
sempre, e le foto vengono lette sul dispositivo con l'OCR locale — più lento e
meno preciso sul testo fitto, ma funzionante.

### Come verificare in un secondo

Apri nel browser:

```
https://90egoal.vercel.app/api/onetap/analyze
```

Risponde `{"configured":true,"provider":"anthropic"}` se c'è Claude,
`"openai-compatible"` con Groq, `{"configured":false,"provider":"none"}` se non
c'è nessuna chiave (e allora le foto si leggono sul dispositivo). Nessuna chiave
viene mai esposta da questo endpoint.

---

## Variabili in più per BRAIN (`/brain`)

BRAIN è la memoria personale del proprietario: se non lo usi, non serve niente e
la sezione resta chiusa da sola. Se lo usi, queste vanno su Vercel **oltre** alle
tre di Supabase (la `SUPABASE_SERVICE_ROLE_KEY` diventa obbligatoria, perché le
tabelle `brain_*` hanno RLS attiva e nessuna policy):

```
BRAIN_OWNER_EMAIL=tu@esempio.it        # chi può entrare. Senza, entra chi è admin
ANTHROPIC_API_KEY=sk-ant-...           # già presente per ONE TAP, la riusa
GOOGLE_CLIENT_ID=...                   # Gmail, Calendar, Drive (scope .readonly)
GOOGLE_CLIENT_SECRET=...
BRAIN_APP_URL=https://90egoal.vercel.app   # solo se l'origine vista dal server non è quella pubblica
QONTO_LOGIN=...                        # transazioni, sola lettura
QONTO_SECRET_KEY=...
OURA_TOKEN=...                         # sonno, prontezza, attività
CRON_SECRET=...                        # senza, la sincronizzazione automatica resta chiusa
RESEND_API_KEY=re_...                  # facoltativa: il brief arriva per posta
BRAIN_MAIL_FROM=brain@tuodominio.it    # mittente verificato su Resend
BRAIN_WEBHOOK_URL=https://...          # in alternativa: Slack, n8n, Telegram
```

`vercel.json` pianifica `/api/brain/cron` ogni giorno alle 05:00 UTC. Vercel
manda `Authorization: Bearer $CRON_SECRET`: **senza quella variabile l'endpoint
risponde 401 a tutti, Vercel compreso** — è voluto, chiuso per difetto. Genera
il segreto con `openssl rand -hex 32`.

Prima del primo accesso va eseguito `supabase/migration_brain.sql` nell'SQL
Editor del progetto Supabase. In Google Cloud Console il redirect URI da
autorizzare è `https://iltuodominio/api/brain/connect/google/callback`, e deve
coincidere **esattamente** con quello che il server costruisce: è il motivo per
cui esiste `BRAIN_APP_URL`.

Il dettaglio completo, limiti dichiarati compresi, è in [BRAIN.md](BRAIN.md).

## Opzione A — GitHub + Vercel (consigliata, deploy automatici a ogni push)

### 1. Crea il repo su GitHub
- Vai su <https://github.com/new>, nome `90egoal`, **vuoto** (niente README), **Create repository**.

### 2. Collega e fai push (dal terminale, nella cartella `90egoal`)
```bash
cd "/Users/mgiacomello/Downloads/Test Claude Code/90egoal"
git remote add origin https://github.com/TUO-UTENTE/90egoal.git
git push -u origin main
```

### 3. Importa su Vercel
- Vai su <https://vercel.com/new> → **Import** del repo `90egoal`.
- Framework: **Next.js** (rilevato in automatico). Root: lascia di default.
- **Environment Variables**: incolla le 2 variabili qui sopra.
- **Deploy**. In ~1 minuto avrai l'URL pubblico.

### 4. Configura Supabase per il dominio di produzione
In Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: l'URL Vercel (es. `https://90egoal.vercel.app`)
- Aggiungi lo stesso URL anche in **Redirect URLs**.

---

## Opzione B — Vercel CLI (deploy diretto, senza GitHub)
```bash
cd "/Users/mgiacomello/Downloads/Test Claude Code/90egoal"
npx vercel login        # autenticazione nel browser
npx vercel --prod       # segui le domande; poi imposta le env vars
```
Le variabili si aggiungono con `npx vercel env add NEXT_PUBLIC_SUPABASE_URL` ecc., oppure dalla dashboard del progetto.

---

## Dopo il deploy
- Registrati sul sito live e poi rendi admin il tuo account dal SQL Editor di Supabase:
  ```sql
  update public.profiles set is_admin = true where username = 'iltuonickname';
  ```
- Condividi l'URL con i tester. 🎉
