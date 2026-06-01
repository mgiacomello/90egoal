# 🚀 Setup di 90 & Goal con Supabase

Segui questi passi una sola volta. Tempo richiesto: ~5 minuti.

## 1. Crea il progetto Supabase
1. Vai su <https://supabase.com> → **Sign in** (gratis, basta GitHub/email).
2. **New project** → dai un nome (es. `90egoal`), scegli una **password DB** (salvala) e la region **West EU (Ireland)** o **Central EU (Frankfurt)**.
3. Attendi ~2 minuti che il progetto venga creato.

## 2. Esegui lo schema del database
1. Nel progetto, menu laterale → **SQL Editor** → **New query**.
2. Apri il file [`supabase/schema.sql`](supabase/schema.sql) di questo progetto, **copia tutto** e incollalo.
3. Premi **Run** (in basso a destra). Deve comparire *Success. No rows returned*.
   - Crea tabelle, policy di sicurezza, la view classifica e inserisce le 2 schedine con tutte le partite.

## 3. Copia le chiavi API
1. Menu laterale → **Project Settings** (icona ingranaggio) → **API**.
2. Ti servono **due valori**:
   - **Project URL** (es. `https://abcd1234.supabase.co`)
   - **anon public** key (sotto *Project API keys*)
3. (Per le funzioni admin server-side, opzionale ora) **service_role** key.

## 4. Configura le variabili d'ambiente
Nel file `.env.local` del progetto, incolla:

```
NEXT_PUBLIC_SUPABASE_URL=https://iltuoprogetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-tua-anon-key
SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key
```

Poi riavvia il server di sviluppo.

## 5. (Consigliato) Disattiva la conferma email per i test
Così i tester entrano subito senza dover confermare la mail:
- **Authentication** → **Providers** → **Email** → disattiva *Confirm email* → **Save**.
- In produzione puoi riattivarla.

## 6. Diventa admin
1. Registrati dall'app con il tuo account.
2. Torna in **SQL Editor** ed esegui (con il tuo nickname):
   ```sql
   update public.profiles set is_admin = true where username = 'iltuonickname';
   ```
3. Ora puoi aprire `/admin` per inserire i risultati reali.

## 7. Deploy su Vercel (quando sei pronto)
1. Carica il progetto su GitHub.
2. Su <https://vercel.com> → **Import** del repo.
3. In **Environment Variables** incolla le stesse 3 variabili del punto 4.
4. **Deploy**. Fatto.

---

### Note tecniche
- Le immagini (stadi Unsplash, bandiere flagcdn) sono già autorizzate in `next.config.ts`.
- La view `classifica` calcola i punteggi automaticamente in base ai risultati inseriti dall'admin.
- Le RLS proteggono i dati: ogni utente vede solo i propri pronostici; le classifiche sono pubbliche solo come punteggi aggregati.
