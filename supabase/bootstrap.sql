-- ============================================================
-- 90 & Goal — Base dati da zero, in un colpo solo
-- Generato dai file schema.sql + migration_*.sql (ottobre 2026), per
-- ricreare il gioco su un progetto Supabase nuovo o condiviso con altre app.
-- Senza le schedine dei Mondiali 2026. Idempotente dopo la prima volta
-- tranne la parte "schema" (create table senza if not exists).
-- ============================================================

-- ==================== schema ====================
-- 90 & Goal — Schema Supabase

-- Profiles (estende auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profilo visibile a tutti gli utenti autenticati"
  on profiles for select using (auth.role() = 'authenticated');
create policy "Utente può aggiornare il proprio profilo"
  on profiles for update using (auth.uid() = id);

-- Trigger: crea profilo automaticamente alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Base condivisa con altre app: si crea il profilo solo per chi arriva da 90 & Goal,
  -- che manda sempre il nickname nei metadati. Gli altri account passano oltre.
  if not (new.raw_user_meta_data ? 'username') then return new; end if;
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Schedine (definizione delle schedine)
create table public.schedine (
  id serial primary key,
  nome text not null,
  deadline timestamptz not null,
  partite jsonb not null,  -- array di { home, away, date, venue }
  attiva boolean default true,
  created_at timestamptz default now()
);
alter table public.schedine enable row level security;
create policy "Schedine visibili a tutti" on schedine for select using (true);
create policy "Solo admin può gestire schedine"
  on schedine for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Pronostici degli utenti
create table public.pronostici (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  schedina_id integer references schedine(id) not null,
  minuti integer[] not null,           -- 13 minuti da 1 a 90
  recupero text check (recupero in ('primo', 'secondo', null)),  -- recupero primo o secondo tempo
  first_goal text,                     -- nome squadra
  last_goal text,                      -- nome squadra
  submitted_at timestamptz default now(),
  unique(user_id, schedina_id)
);
alter table public.pronostici enable row level security;
create policy "Utente vede solo i propri pronostici"
  on pronostici for select using (auth.uid() = user_id);
create policy "Utente può inserire pronostico"
  on pronostici for insert with check (auth.uid() = user_id);
create policy "Utente può aggiornare pronostico prima della deadline"
  on pronostici for update using (
    auth.uid() = user_id and
    exists (
      select 1 from schedine s
      where s.id = schedina_id and s.deadline > now()
    )
  );
create policy "Admin vede tutti i pronostici"
  on pronostici for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Risultati (inseriti dall'admin dopo le partite)
create table public.risultati (
  id serial primary key,
  schedina_id integer references schedine(id) unique not null,
  minuti_gol integer[] not null,       -- minuti dove sono stati segnati gol reali
  recupero text check (recupero in ('primo', 'secondo', 'entrambi', 'nessuno')),
  first_goal_team text,
  last_goal_team text,
  note text,
  created_at timestamptz default now()
);
alter table public.risultati enable row level security;
create policy "Risultati visibili a tutti gli autenticati"
  on risultati for select using (auth.role() = 'authenticated');
create policy "Solo admin può inserire risultati"
  on risultati for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- View classifica con punteggi calcolati
create or replace view public.classifica as
select
  p.schedina_id,
  p.user_id,
  pr.username,
  pr.full_name,
  -- Punti minuti: intersezione tra minuti pronosticati e minuti reali
  coalesce(
    (select count(*) from unnest(p.minuti) m where m = any(r.minuti_gol))::integer,
    0
  ) as punti_minuti,
  -- Punto recupero
  case
    when r.recupero = 'entrambi' and p.recupero in ('primo','secondo') then 1
    when r.recupero = p.recupero then 1
    else 0
  end as punti_recupero,
  -- Bonus first/last goal
  case
    when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
    when p.first_goal = r.first_goal_team then 3
    when p.last_goal = r.last_goal_team then 3
    else 0
  end as punti_bonus,
  -- Totale
  coalesce(
    (select count(*) from unnest(p.minuti) m where m = any(r.minuti_gol))::integer,
    0
  ) +
  case
    when r.recupero = 'entrambi' and p.recupero in ('primo','secondo') then 1
    when r.recupero = p.recupero then 1
    else 0
  end +
  case
    when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
    when p.first_goal = r.first_goal_team then 3
    when p.last_goal = r.last_goal_team then 3
    else 0
  end as totale
from pronostici p
join risultati r on r.schedina_id = p.schedina_id
join profiles pr on pr.id = p.user_id;

-- La view gira con i privilegi del creatore (definer) così la classifica
-- mostra TUTTI i giocatori e non solo le righe dell'utente corrente.
-- Serve però il GRANT esplicito per l'API REST di Supabase.
grant select on public.classifica to anon, authenticated;

-- ==================== activity ====================
-- ============================================================
-- 90 & Goal — Tracciamento utenti & attività
-- Aggiunge: email/registrazione nei profili, tabella attività,
-- e una view riepilogo per il tempo di permanenza.
-- ============================================================

-- 1) Email nei profili (per vedere chi si è registrato)
alter table public.profiles add column if not exists email text;

-- backfill email dagli account esistenti
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- aggiorna il trigger di creazione profilo per salvare anche l'email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Base condivisa con altre app: si crea il profilo solo per chi arriva da 90 & Goal,
  -- che manda sempre il nickname nei metadati. Gli altri account passano oltre.
  if not (new.raw_user_meta_data ? 'username') then return new; end if;
  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

-- 2) Tabella attività (un "battito" ~ ogni minuto di permanenza attiva)
create table if not exists public.activity (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  path text,
  created_at timestamptz default now()
);
create index if not exists activity_user_time_idx on public.activity (user_id, created_at);

alter table public.activity enable row level security;

drop policy if exists "Utente registra la propria attività" on public.activity;
create policy "Utente registra la propria attività"
  on public.activity for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admin legge tutta l'attività" on public.activity;
create policy "Admin legge tutta l'attività"
  on public.activity for select
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

grant insert, select on public.activity to authenticated;
grant usage on sequence public.activity_id_seq to authenticated;

-- 3) Riepilogo attività per utente (security_invoker: rispetta le policy,
--    quindi solo l'admin vede i dati di tutti)
create or replace view public.user_activity_summary
with (security_invoker = true) as
select
  user_id,
  count(*)                                  as minuti_attivi,   -- 1 battito ≈ 1 minuto
  min(created_at)                           as primo_accesso,
  max(created_at)                           as ultimo_accesso,
  count(distinct date_trunc('day', created_at)) as giorni_attivi
from public.activity
group by user_id;

grant select on public.user_activity_summary to authenticated;

-- ==================== eliminazione ====================
-- ============================================================
-- 90 & Goal — Fase a eliminazione diretta
-- Esegui questo blocco UNA VOLTA nel SQL editor di Supabase.
-- (Tutte le istruzioni sono idempotenti: si può rilanciare senza danni.)
-- ============================================================

-- 1) Fase delle schedine: 'gironi' (vecchie) | 'eliminazione' (knockout)
alter table public.schedine add column if not exists fase text not null default 'eliminazione';

-- Le schedine 1 e 2 sono gironi e vanno archiviate (restano consultabili, sola lettura)
-- (nessuna schedina dei Mondiali da archiviare in una base nuova)

-- 2) Pronostico: previsione "andrà ai supplementari?" (solo eliminazione)
alter table public.pronostici add column if not exists extra_time boolean;

-- 3) Risultato: esito reale dei supplementari
alter table public.risultati add column if not exists extra_time boolean;

-- 4) Vista classifica: stessa definizione attuale + bonus +5 supplementari (null-safe).
--    Le colonne restano identiche e nello stesso ordine (incl. minuti_azzeccati).
create or replace view public.classifica as
select p.schedina_id,
    p.user_id,
    pr.username,
    pr.full_name,
    coalesce((( select count(*) as count
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)))::integer, 0) as punti_minuti,
        case
            when r.recupero = 'entrambi'::text and (p.recupero = any (array['primo'::text, 'secondo'::text])) then 1
            when r.recupero = p.recupero then 1
            else 0
        end as punti_recupero,
        (case
            when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
            when p.first_goal = r.first_goal_team then 3
            when p.last_goal = r.last_goal_team then 3
            else 0
        end
        + case when p.extra_time is not null and p.extra_time = r.extra_time then 5 else 0 end) as punti_bonus,
    coalesce((( select count(*) as count
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)))::integer, 0) +
        case
            when r.recupero = 'entrambi'::text and (p.recupero = any (array['primo'::text, 'secondo'::text])) then 1
            when r.recupero = p.recupero then 1
            else 0
        end +
        case
            when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
            when p.first_goal = r.first_goal_team then 3
            when p.last_goal = r.last_goal_team then 3
            else 0
        end
        + case when p.extra_time is not null and p.extra_time = r.extra_time then 5 else 0 end as totale,
    coalesce(( select array_agg(m.m order by m.m) as array_agg
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)), '{}'::integer[]) as minuti_azzeccati
   from pronostici p
     join risultati r on r.schedina_id = p.schedina_id
     join profiles pr on pr.id = p.user_id;

grant select on public.classifica to anon, authenticated;

-- ==================== campionato ====================
-- ============================================================
-- 90 & Goal — Test campionati italiani (autunno 2026)
-- Esegui questo blocco UNA VOLTA nel SQL Editor di Supabase.
-- Tutte le istruzioni sono idempotenti: si può rilanciare senza danni.
-- ============================================================

-- 1) Torneo: raggruppa le schedine. La classifica generale somma solo
--    le schedine dello stesso torneo, così i punti dei Mondiali non
--    pesano sul test di ottobre.
alter table public.schedine add column if not exists torneo text not null default 'Mondiali 2026';

-- 2) Dettaglio partita per partita (punteggio, gol, stato live).
--    In produzione la colonna esiste già, aggiunta a mano: qui diventa esplicita.
alter table public.risultati add column if not exists dettagli jsonb;

-- 3) I Mondiali sono finiti: le loro schedine passano in archivio (sola lettura).
update public.schedine set attiva = false where torneo = 'Mondiali 2026' and attiva is distinct from false;

-- 3b) Niente pronostici dopo la scadenza, nemmeno aggirando l'app.
--     Finora lo impediva solo la pagina: con i gol visibili in diretta, una chiamata
--     diretta all'API avrebbe permesso di "pronosticare" minuti già usciti.
drop policy if exists "Utente può inserire pronostico" on public.pronostici;
create policy "Utente può inserire pronostico"
  on public.pronostici for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.schedine s
      where s.id = schedina_id and s.deadline > now() and s.attiva is not false
    )
  );

-- 4) Test chiuso: codice invito facoltativo per le NUOVE registrazioni.
--    Finché il valore è vuoto la registrazione resta libera come oggi.
--    Per attivarlo:  update public.impostazioni set valore = 'GOAL17' where chiave = 'codice_invito';
--    Chi è già registrato entra sempre con le sue credenziali.
create table if not exists public.impostazioni (
  chiave text primary key,
  valore text
);
alter table public.impostazioni enable row level security;   -- nessuna policy: dal client non si legge
insert into public.impostazioni (chiave, valore) values ('codice_invito', '')
  on conflict (chiave) do nothing;

-- Serve alla pagina di registrazione per sapere se chiedere il codice, senza esporlo.
create or replace function public.invito_richiesto()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(trim(valore), '') is not null from impostazioni where chiave = 'codice_invito'), false)
$$;

-- Controllo del codice prima dell'invio, per dare un errore chiaro invece di uno generico.
create or replace function public.invito_valido(codice text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not public.invito_richiesto() then true
    else exists (select 1 from impostazioni where chiave = 'codice_invito'
                 and lower(trim(valore)) = lower(trim(coalesce(codice, ''))))
  end
$$;

-- Nickname libero? Senza, un nickname doppio fallisce con un errore generico del database.
create or replace function public.username_disponibile(nome text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(nome)))
$$;

grant execute on function public.invito_richiesto() to anon, authenticated;
grant execute on function public.invito_valido(text) to anon, authenticated;
grant execute on function public.username_disponibile(text) to anon, authenticated;

-- Il trigger di registrazione applica davvero il codice: il controllo nel browser
-- serve solo a dare un messaggio chiaro, a decidere è il database.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (new.raw_user_meta_data ? 'username') then return new; end if;
  if not public.invito_valido(new.raw_user_meta_data->>'invito') then
    raise exception 'Codice invito non valido';
  end if;
  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

-- 5) Le schedine del test, dal documento di Max del 23 settembre.
--    Scadenza = primo calcio d'inizio (ora di Roma; +02 fino al 24/10, +01 dal 25/10).
--    ⚠️ 1/11 e 7/11: orari non ancora indicati. Scadenza provvisoria, da confermare
--    dal pannello admin (Gestione schedine) appena Max verifica i calendari.
--    Nomi squadra uniformati: "Forlì", "Atalanta U23", "Juve Stabia", "Carpi – Renate".

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Giornata del 17 ottobre', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-10-17 14:30:00+02',
  '[
    {"home":"Reggiana","away":"Torres","date":"2026-10-17","ora":"14:30","competizione":"Serie C"},
    {"home":"Vado","away":"Sanbenedettese","date":"2026-10-17","ora":"14:30","competizione":"Serie C"},
    {"home":"Pianese","away":"Pineto","date":"2026-10-17","ora":"14:30","competizione":"Serie C"},
    {"home":"Guidonia","away":"Forlì","date":"2026-10-17","ora":"14:30","competizione":"Serie C"},
    {"home":"Carpi","away":"Lumezzane","date":"2026-10-17","ora":"14:30","competizione":"Serie C"},
    {"home":"Ascoli","away":"Empoli","date":"2026-10-17","ora":"15:00","competizione":"Serie B"},
    {"home":"Carrarese","away":"Modena","date":"2026-10-17","ora":"15:00","competizione":"Serie B"},
    {"home":"Benevento","away":"LR Vicenza","date":"2026-10-17","ora":"15:00","competizione":"Serie B"},
    {"home":"Padova","away":"Entella","date":"2026-10-17","ora":"15:00","competizione":"Serie B"},
    {"home":"Venezia","away":"Napoli","date":"2026-10-17","ora":"15:00","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Giornata del 17 ottobre');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Giornata del 24 ottobre', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-10-24 14:30:00+02',
  '[
    {"home":"Cagliari","away":"Bologna","date":"2026-10-24","ora":"15:00","competizione":"Serie A"},
    {"home":"Como","away":"Sassuolo","date":"2026-10-24","ora":"15:00","competizione":"Serie A"},
    {"home":"Entella","away":"Mantova","date":"2026-10-24","ora":"15:00","competizione":"Serie B"},
    {"home":"Sudtirol","away":"Sampdoria","date":"2026-10-24","ora":"15:00","competizione":"Serie B"},
    {"home":"Avellino","away":"Padova","date":"2026-10-24","ora":"15:00","competizione":"Serie B"},
    {"home":"Modena","away":"Cesena","date":"2026-10-24","ora":"15:00","competizione":"Serie B"},
    {"home":"Cremonese","away":"Juve Stabia","date":"2026-10-24","ora":"15:00","competizione":"Serie B"},
    {"home":"Spezia","away":"Latina","date":"2026-10-24","ora":"14:30","competizione":"Serie C"},
    {"home":"Atalanta U23","away":"Campobasso","date":"2026-10-24","ora":"14:30","competizione":"Serie C"},
    {"home":"Treviso","away":"Dolomiti Bellunesi","date":"2026-10-24","ora":"14:30","competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Giornata del 24 ottobre');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Giornata del 1° novembre', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-01 12:30:00+01',   -- PROVVISORIA: orari Serie C da confermare
  '[
    {"home":"Folgore Caratese","away":"Union Brescia","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Cittadella","away":"Treviso","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Spezia","away":"Atalanta U23","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Ravenna","away":"Pineto","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Salernitana","away":"Savoia","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Dolomiti Bellunesi","away":"Lecco","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Carpi","away":"Renate","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Lumezzane","away":"Arzignano","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Livorno","away":"Ostiamare","date":"2026-11-01","ora":null,"competizione":"Serie C"},
    {"home":"Campobasso","away":"Forlì","date":"2026-11-01","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Giornata del 1° novembre');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Giornata del 7 novembre', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-07 14:30:00+01',   -- PROVVISORIA: orari da confermare
  '[
    {"home":"Torino","away":"Lecce","date":"2026-11-07","ora":null,"competizione":"Serie A"},
    {"home":"Cagliari","away":"Frosinone","date":"2026-11-07","ora":null,"competizione":"Serie A"},
    {"home":"Parma","away":"Bologna","date":"2026-11-07","ora":null,"competizione":"Serie A"},
    {"home":"Juve Stabia","away":"Arezzo","date":"2026-11-07","ora":null,"competizione":"Serie B"},
    {"home":"Cesena","away":"Catanzaro","date":"2026-11-07","ora":null,"competizione":"Serie B"},
    {"home":"Pisa","away":"Sudtirol","date":"2026-11-07","ora":null,"competizione":"Serie B"},
    {"home":"Padova","away":"Empoli","date":"2026-11-07","ora":null,"competizione":"Serie B"},
    {"home":"Mantova","away":"Verona","date":"2026-11-07","ora":null,"competizione":"Serie B"},
    {"home":"Crotone","away":"Giugliano","date":"2026-11-07","ora":null,"competizione":"Serie C"},
    {"home":"Casertana","away":"Casarano","date":"2026-11-07","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Giornata del 7 novembre');

-- ==================== push ====================
-- ============================================================
-- 90 & Goal — Notifiche push
-- Esegui DOPO migration_campionato.sql, una volta, nel SQL Editor di Supabase.
-- Idempotente: si può rilanciare senza danni.
-- ============================================================

-- Un'iscrizione = un dispositivo (browser o app installata) di un giocatore.
-- L'endpoint è l'indirizzo a cui il servizio push del telefono consegna i messaggi.
create table if not exists public.push_iscrizioni (
  endpoint   text primary key,
  user_id    uuid not null references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  preferenza text not null default 'tutti' check (preferenza in ('tutti', 'miei')),
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists push_iscrizioni_user_idx on public.push_iscrizioni (user_id);

-- Nessuna policy: dal browser la tabella non si legge né si scrive.
-- Si passa solo dalle funzioni qui sotto, che controllano chi sta chiamando.
alter table public.push_iscrizioni enable row level security;

-- Il giocatore iscrive il proprio dispositivo. Se il telefono passa a un altro account,
-- l'iscrizione segue l'account nuovo: un dispositivo, un destinatario.
create or replace function public.push_registra(
  p_endpoint text, p_p256dh text, p_auth text, p_preferenza text default 'tutti', p_user_agent text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non autenticato'; end if;
  insert into push_iscrizioni (endpoint, user_id, p256dh, auth, preferenza, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth,
          case when p_preferenza = 'miei' then 'miei' else 'tutti' end, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    preferenza = excluded.preferenza, user_agent = excluded.user_agent, updated_at = now();
end;
$$;

-- Il giocatore toglie il proprio dispositivo.
create or replace function public.push_cancella(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_iscrizioni where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- Stato del dispositivo corrente: la preferenza, o null se non è iscritto.
create or replace function public.push_mia_iscrizione(p_endpoint text)
returns text language sql stable security definer set search_path = public as $$
  select preferenza from push_iscrizioni where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- Solo admin: l'elenco dei destinatari, letto dalla funzione server che invia.
create or replace function public.push_destinatari()
returns table (user_id uuid, endpoint text, p256dh text, auth text, preferenza text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Solo admin';
  end if;
  return query select i.user_id, i.endpoint, i.p256dh, i.auth, i.preferenza from push_iscrizioni i;
end;
$$;

-- Solo admin: toglie un dispositivo che il servizio push dichiara non più valido.
create or replace function public.push_rimuovi(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Solo admin';
  end if;
  delete from push_iscrizioni where endpoint = p_endpoint;
end;
$$;

revoke execute on function public.push_registra(text, text, text, text, text) from anon;
revoke execute on function public.push_cancella(text) from anon;
revoke execute on function public.push_mia_iscrizione(text) from anon;
revoke execute on function public.push_destinatari() from anon;
revoke execute on function public.push_rimuovi(text) from anon;
grant execute on function public.push_registra(text, text, text, text, text) to authenticated;
grant execute on function public.push_cancella(text) to authenticated;
grant execute on function public.push_mia_iscrizione(text) to authenticated;
grant execute on function public.push_destinatari() to authenticated;
grant execute on function public.push_rimuovi(text) to authenticated;

-- ==================== timing ====================
-- ============================================================
-- 90 & Goal — Tracciamento tempi/comportamento utenti
-- Eventi con durata (ms) + viste aggregate per l'admin.
-- ============================================================

-- Tabella eventi: ogni tappa del percorso utente con il tempo impiegato
create table if not exists public.events (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  event text not null,        -- form_open | minutes_done | recupero_set | first_team_set | last_team_set | submit | register
  schedina_id int,
  ms int,                     -- durata in millisecondi (dall'apertura del form / inizio registrazione)
  created_at timestamptz default now()
);
create index if not exists events_event_idx on public.events (event);

alter table public.events enable row level security;

drop policy if exists "Utente registra i propri eventi" on public.events;
create policy "Utente registra i propri eventi"
  on public.events for insert with check (auth.uid() = user_id);

drop policy if exists "Admin legge tutti gli eventi" on public.events;
create policy "Admin legge tutti gli eventi"
  on public.events for select
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

grant insert, select on public.events to authenticated;
grant usage on sequence public.events_id_seq to authenticated;

-- Vista: tempi medi per tipo di tappa (solo admin, security_invoker)
create or replace view public.timing_summary with (security_invoker = true) as
select
  event,
  count(*)                                  as campioni,
  round(avg(ms)::numeric / 1000.0, 1)       as media_sec,
  round((percentile_cont(0.5) within group (order by ms))::numeric / 1000.0, 1) as mediana_sec,
  round(min(ms)::numeric / 1000.0, 1)       as min_sec,
  round(max(ms)::numeric / 1000.0, 1)       as max_sec
from public.events
where ms is not null and ms >= 0
group by event;
grant select on public.timing_summary to authenticated;

-- Vista: tempo di permanenza per sezione del sito (dai battiti activity.path)
create or replace view public.section_time with (security_invoker = true) as
select
  case
    when path like '/schedine/%' then 'Compilazione schedina'
    when path = '/schedine'      then 'Elenco schedine'
    when path = '/classifica'    then 'Classifica'
    when path = '/admin'         then 'Pannello admin'
    when path = '/'              then 'Home'
    when path like '/auth%'      then 'Login / Registrazione'
    else coalesce(path, '(altro)')
  end                       as sezione,
  count(*)                  as minuti_totali,   -- 1 battito ≈ 1 minuto
  count(distinct user_id)   as utenti
from public.activity
group by 1;
grant select on public.section_time to authenticated;

-- ==================== primo_ultimo ====================
-- ============================================================
-- 90 & Goal — Primo e ultimo gol dei tempi regolamentari valgono doppio
-- (regolamento di Max, ottobre 2026). Esegui UNA VOLTA nel SQL Editor.
-- Idempotente: si può rilanciare senza danni.
-- ============================================================

-- 1) Il risultato registra il minuto (1–90) del primo e dell'ultimo gol
--    in ordine di orario reale fra tutte le partite. Recupero escluso:
--    quei gol non hanno un minuto giocabile.
alter table public.risultati add column if not exists minuto_primo_gol integer;
alter table public.risultati add column if not exists minuto_ultimo_gol integer;

-- 2) Vista classifica: un minuto azzeccato vale 1, ma vale 2 se è quello
--    del primo o dell'ultimo gol. Se primo e ultimo coincidono (un solo
--    gol nei 90'), vale 2 una volta sola. Colonne invariate, in più
--    `punti_doppi` = quanti punti extra sono arrivati da questa regola.
create or replace view public.classifica as
select p.schedina_id,
    p.user_id,
    pr.username,
    pr.full_name,
    coalesce((( select count(*) as count
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)))::integer, 0)
      + (case when r.minuto_primo_gol = any (p.minuti) then 1 else 0 end)
      + (case when r.minuto_ultimo_gol = any (p.minuti) and r.minuto_ultimo_gol is distinct from r.minuto_primo_gol then 1 else 0 end)
      as punti_minuti,
        case
            when r.recupero = 'entrambi'::text and (p.recupero = any (array['primo'::text, 'secondo'::text])) then 1
            when r.recupero = p.recupero then 1
            else 0
        end as punti_recupero,
        (case
            when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
            when p.first_goal = r.first_goal_team then 3
            when p.last_goal = r.last_goal_team then 3
            else 0
        end
        + case when p.extra_time is not null and p.extra_time = r.extra_time then 5 else 0 end) as punti_bonus,
    coalesce((( select count(*) as count
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)))::integer, 0)
      + (case when r.minuto_primo_gol = any (p.minuti) then 1 else 0 end)
      + (case when r.minuto_ultimo_gol = any (p.minuti) and r.minuto_ultimo_gol is distinct from r.minuto_primo_gol then 1 else 0 end)
      +
        case
            when r.recupero = 'entrambi'::text and (p.recupero = any (array['primo'::text, 'secondo'::text])) then 1
            when r.recupero = p.recupero then 1
            else 0
        end +
        case
            when p.first_goal = r.first_goal_team and p.last_goal = r.last_goal_team then 10
            when p.first_goal = r.first_goal_team then 3
            when p.last_goal = r.last_goal_team then 3
            else 0
        end
        + case when p.extra_time is not null and p.extra_time = r.extra_time then 5 else 0 end as totale,
    coalesce(( select array_agg(m.m order by m.m) as array_agg
           from unnest(p.minuti) m(m)
          where m.m = any (r.minuti_gol)), '{}'::integer[]) as minuti_azzeccati,
    (case when r.minuto_primo_gol = any (p.minuti) then 1 else 0 end)
      + (case when r.minuto_ultimo_gol = any (p.minuti) and r.minuto_ultimo_gol is distinct from r.minuto_primo_gol then 1 else 0 end)
      as punti_doppi
   from pronostici p
     join risultati r on r.schedina_id = p.schedina_id
     join profiles pr on pr.id = p.user_id;

grant select on public.classifica to anon, authenticated;
