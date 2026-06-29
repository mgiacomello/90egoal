-- ============================================================
-- 90 & Goal — Fase a eliminazione diretta
-- Esegui questo blocco UNA VOLTA nel SQL editor di Supabase.
-- (Tutte le istruzioni sono idempotenti: si può rilanciare senza danni.)
-- ============================================================

-- 1) Fase delle schedine: 'gironi' (vecchie) | 'eliminazione' (knockout)
alter table public.schedine add column if not exists fase text not null default 'eliminazione';

-- Le schedine 1 e 2 sono gironi e vanno archiviate (restano consultabili, sola lettura)
update public.schedine set fase = 'gironi', attiva = false where id in (1, 2);

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
