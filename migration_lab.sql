-- Habeas Mentem Lab: archivio delle sessioni e modelli appresi.
-- Eseguire una volta nell'editor SQL di Supabase (progetto già usato dal sito).

create table if not exists public.lab_sessions (
  id             text primary key,                    -- identificativo della sessione (hm-…)
  document_id    text not null,
  document_title text,
  created_at     timestamptz not null,                -- quando la sessione è stata letta
  inserted_at    timestamptz not null default now(),  -- quando è arrivata in archivio
  simulated      boolean not null default false,      -- fascia simulata
  with_signal    boolean not null default false,      -- almeno un campione della fascia
  reading_mode   text,
  clauses        integer,
  payload        jsonb not null                       -- l'esportazione senza tracciato, senza pseudonimo
);
create index if not exists lab_sessions_document_idx on public.lab_sessions (document_id, created_at);
create index if not exists lab_sessions_inserted_idx on public.lab_sessions (inserted_at);

create table if not exists public.lab_models (
  id          bigserial primary key,
  computed_at timestamptz not null default now(),
  sessions    integer not null default 0,
  model       jsonb not null
);
create index if not exists lab_models_computed_idx on public.lab_models (computed_at desc);

alter table public.lab_sessions enable row level security;
alter table public.lab_models   enable row level security;

-- Con SUPABASE_SERVICE_ROLE_KEY impostata su Vercel le policy qui sotto non
-- servono (il service role le ignora) e possono essere omesse: le tabelle
-- restano chiuse a chiunque non passi dalle API del sito.
-- Senza service role il sito usa la chiave anon: servono queste policy.
drop policy if exists "lab_sessions anon insert" on public.lab_sessions;
drop policy if exists "lab_sessions anon select" on public.lab_sessions;
drop policy if exists "lab_sessions anon update" on public.lab_sessions;
drop policy if exists "lab_models anon insert"   on public.lab_models;
drop policy if exists "lab_models anon select"   on public.lab_models;
drop policy if exists "lab_models anon delete"   on public.lab_models;
create policy "lab_sessions anon insert" on public.lab_sessions for insert to anon, authenticated with check (true);
create policy "lab_sessions anon select" on public.lab_sessions for select to anon, authenticated using (true);
create policy "lab_sessions anon update" on public.lab_sessions for update to anon, authenticated using (true) with check (true);
create policy "lab_models anon insert"   on public.lab_models   for insert to anon, authenticated with check (true);
create policy "lab_models anon select"   on public.lab_models   for select to anon, authenticated using (true);
create policy "lab_models anon delete"   on public.lab_models   for delete to anon, authenticated using (true);
