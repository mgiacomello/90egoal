# 🚀 Deploy di 90 & Goal su Vercel

Il repository git è già pronto con un commit iniziale e `.env.local` **escluso** (le chiavi non vengono caricate online).

## Variabili d'ambiente da impostare su Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://jzxeasfovkigtyptspan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_A98sGzVNr9A_uzbYpts4gQ_eO_uiw8l
```
(La `SUPABASE_SERVICE_ROLE_KEY` non è necessaria per il funzionamento attuale.)

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
