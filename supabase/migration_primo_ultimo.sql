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
