-- ============================================================
-- 90 & Goal — Leghe tra amici
-- Una lega è un gruppo di giocatori con un codice d'invito. Le schedine
-- restano le stesse per tutti: la classifica della lega è la classifica
-- del torneo filtrata sui suoi membri.
-- Esegui UNA VOLTA nel SQL Editor. Idempotente: si può rilanciare.
-- ============================================================

create table if not exists public.leghe (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 40),
  codice text not null unique,
  creata_da uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.leghe_membri (
  lega_id uuid not null references public.leghe on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (lega_id, user_id)
);
create index if not exists leghe_membri_user_idx on public.leghe_membri (user_id);

alter table public.leghe enable row level security;
alter table public.leghe_membri enable row level security;

-- Chi è membro di una lega. Security definer: evita che le policy su
-- leghe_membri richiamino se stesse.
create or replace function public.sono_membro(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.leghe_membri where lega_id = l and user_id = auth.uid())
$$;

drop policy if exists "Leghe visibili ai membri" on public.leghe;
create policy "Leghe visibili ai membri" on public.leghe
  for select using (public.sono_membro(id) or creata_da = auth.uid());
drop policy if exists "Chi crea la lega la rinomina" on public.leghe;
create policy "Chi crea la lega la rinomina" on public.leghe
  for update using (creata_da = auth.uid()) with check (creata_da = auth.uid());
drop policy if exists "Chi crea la lega la elimina" on public.leghe;
create policy "Chi crea la lega la elimina" on public.leghe
  for delete using (creata_da = auth.uid());

drop policy if exists "Membri visibili ai membri" on public.leghe_membri;
create policy "Membri visibili ai membri" on public.leghe_membri
  for select using (public.sono_membro(lega_id));
-- Si esce da soli; chi ha creato la lega può togliere un membro.
drop policy if exists "Uscire o togliere un membro" on public.leghe_membri;
create policy "Uscire o togliere un membro" on public.leghe_membri
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.leghe l where l.id = lega_id and l.creata_da = auth.uid())
  );
-- Niente insert diretti: si crea e si entra solo con le funzioni qui sotto.

-- Crea una lega e ci mette dentro chi la crea. Codice di 6 caratteri
-- senza quelli che si confondono (0/O, 1/I/L).
create or replace function public.crea_lega(p_nome text)
returns public.leghe language plpgsql security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codice text;
  v_lega public.leghe;
begin
  if auth.uid() is null then raise exception 'accesso richiesto'; end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 40 then
    raise exception 'nome non valido';
  end if;
  if (select count(*) from public.leghe where creata_da = auth.uid()) >= 20 then
    raise exception 'troppe leghe';
  end if;
  loop
    v_codice := '';
    for i in 1..6 loop
      v_codice := v_codice || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leghe where codice = v_codice);
  end loop;
  insert into public.leghe (nome, codice, creata_da)
    values (btrim(p_nome), v_codice, auth.uid())
    returning * into v_lega;
  insert into public.leghe_membri (lega_id, user_id) values (v_lega.id, auth.uid());
  return v_lega;
end;
$$;

-- Entra in una lega con il codice. Rientrare non dà errore.
create or replace function public.unisciti_lega(p_codice text)
returns public.leghe language plpgsql security definer set search_path = public as $$
declare
  v_lega public.leghe;
begin
  if auth.uid() is null then raise exception 'accesso richiesto'; end if;
  select * into v_lega from public.leghe where codice = upper(btrim(coalesce(p_codice, '')));
  if v_lega.id is null then raise exception 'codice non trovato'; end if;
  if not exists (select 1 from public.leghe_membri where lega_id = v_lega.id and user_id = auth.uid())
     and (select count(*) from public.leghe_membri where lega_id = v_lega.id) >= 200 then
    raise exception 'lega piena';
  end if;
  insert into public.leghe_membri (lega_id, user_id) values (v_lega.id, auth.uid())
    on conflict do nothing;
  return v_lega;
end;
$$;

-- Anteprima per la pagina d'invito: nome, quanti membri e chi l'ha creata.
-- Basta il codice, anche senza account: è quello che si manda su WhatsApp.
create or replace function public.anteprima_lega(p_codice text)
returns table (nome text, membri integer, creatore text)
language sql stable security definer set search_path = public as $$
  select l.nome,
         (select count(*)::int from public.leghe_membri m where m.lega_id = l.id),
         (select p.username from public.profiles p where p.id = l.creata_da)
  from public.leghe l
  where l.codice = upper(btrim(coalesce(p_codice, '')))
$$;

revoke all on function public.sono_membro(uuid) from public;
revoke all on function public.crea_lega(text) from public;
revoke all on function public.unisciti_lega(text) from public;
revoke all on function public.anteprima_lega(text) from public;
grant execute on function public.sono_membro(uuid) to authenticated;
grant execute on function public.crea_lega(text) to authenticated;
grant execute on function public.unisciti_lega(text) to authenticated;
grant execute on function public.anteprima_lega(text) to anon, authenticated;
revoke update on public.leghe from authenticated;
grant select, delete on public.leghe to authenticated;
grant update (nome) on public.leghe to authenticated;  -- solo il nome, mai il codice
grant select, delete on public.leghe_membri to authenticated;
