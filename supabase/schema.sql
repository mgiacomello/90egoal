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

-- Inserimento dati iniziali: Schedina 1
insert into public.schedine (nome, deadline, partite) values (
  'Schedina 1 — Mondiali FIFA 2026',
  '2026-06-10 22:00:00+00',  -- mezzanotte italiana = 22:00 UTC
  '[
    {"home":"Messico","away":"Sudafrica","date":"2026-06-11","venue":"Stadio Azteca, Città del Messico"},
    {"home":"Stati Uniti","away":"Paraguay","date":"2026-06-12","venue":"SoFi Stadium, Los Angeles"},
    {"home":"Brasile","away":"Marocco","date":"2026-06-13","venue":"MetLife Stadium, New York"},
    {"home":"Germania","away":"Curaçao","date":"2026-06-14","venue":"NRG Stadium, Houston"},
    {"home":"Paesi Bassi","away":"Giappone","date":"2026-06-14","venue":"AT&T Stadium, Dallas"},
    {"home":"Spagna","away":"Capo Verde","date":"2026-06-15","venue":"Mercedes-Benz Stadium, Atlanta"},
    {"home":"Belgio","away":"Egitto","date":"2026-06-15","venue":"Lumen Field, Seattle"},
    {"home":"Francia","away":"Senegal","date":"2026-06-16","venue":"MetLife Stadium, New York"},
    {"home":"Iraq","away":"Norvegia","date":"2026-06-16","venue":"Gillette Stadium, Boston"},
    {"home":"Argentina","away":"Algeria","date":"2026-06-17","venue":"Arrowhead Stadium, Kansas City"}
  ]'::jsonb
);

-- Inserimento dati iniziali: Schedina 2
insert into public.schedine (nome, deadline, partite) values (
  'Schedina 2 — Mondiali FIFA 2026',
  '2026-06-16 22:00:00+00',  -- mezzanotte italiana = 22:00 UTC
  '[
    {"home":"Uzbekistan","away":"Colombia","date":"2026-06-17","venue":"Stadio Azteca, Città del Messico"},
    {"home":"Stati Uniti","away":"Australia","date":"2026-06-19","venue":"Lumen Field, Seattle"},
    {"home":"Brasile","away":"Haiti","date":"2026-06-19","venue":"Lincoln Financial Field, Philadelphia"},
    {"home":"Germania","away":"Costa d''Avorio","date":"2026-06-20","venue":"BMO Field, Toronto"},
    {"home":"Ecuador","away":"Curaçao","date":"2026-06-20","venue":"Arrowhead Stadium, Kansas City"},
    {"home":"Spagna","away":"Arabia Saudita","date":"2026-06-21","venue":"Mercedes-Benz Stadium, Atlanta"},
    {"home":"Norvegia","away":"Senegal","date":"2026-06-22","venue":"Gillette Stadium, Boston"},
    {"home":"Ecuador","away":"Germania","date":"2026-06-25","venue":"MetLife Stadium, New York"},
    {"home":"Uruguay","away":"Spagna","date":"2026-06-26","venue":"Estadio Guadalajara, Zapopan"},
    {"home":"Panama","away":"Inghilterra","date":"2026-06-27","venue":"MetLife Stadium, New York"}
  ]'::jsonb
);

-- ============================================================
-- DOPO esserti registrato dall'app, rendi admin il tuo account
-- (sostituisci il nickname) eseguendo questa riga:
--
--   update public.profiles set is_admin = true where username = 'iltuonickname';
--
-- Così potrai accedere a /admin e inserire i risultati.
-- ============================================================
