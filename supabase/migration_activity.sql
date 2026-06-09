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
