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
