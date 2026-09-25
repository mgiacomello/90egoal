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
