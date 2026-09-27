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
