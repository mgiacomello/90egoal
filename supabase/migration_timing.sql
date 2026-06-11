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
