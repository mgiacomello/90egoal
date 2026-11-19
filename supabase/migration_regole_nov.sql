-- ============================================================
-- 90 & Goal — Regole di novembre 2026 (le stesse della demo per gli investitori)
--   · vale doppio solo il minuto del PRIMO gol dei 90' (non più anche l'ultimo);
--   · prima squadra a segnare +1, ultima squadra a segnare +1 (prima: +3, entrambe +10);
--   · per prima e ultima squadra contano solo i gol dall'1' al 90': lo calcola l'app
--     quando l'admin inserisce i gol, questa migrazione cambia solo i punti.
-- Valgono per le schedine di campionato (fase = 'campionato'), comprese le giornate
-- già giocate di questo torneo. I Mondiali, finiti, restano con i punti di allora.
-- Esegui UNA VOLTA nel SQL Editor di Supabase. Idempotente: si può rilanciare.
-- ============================================================

create or replace view public.classifica as
with base as (
  select p.schedina_id, p.user_id, pr.username, pr.full_name,
    s.fase = 'campionato' as nuove,
    coalesce((select count(*) from unnest(p.minuti) m(m) where m.m = any (r.minuti_gol))::integer, 0) as presi,
    (case when r.minuto_primo_gol = any (p.minuti) then 1 else 0 end) as doppio_primo,
    (case when r.minuto_ultimo_gol = any (p.minuti) and r.minuto_ultimo_gol is distinct from r.minuto_primo_gol then 1 else 0 end) as doppio_ultimo,
    (case
       when r.recupero = 'entrambi' and p.recupero in ('primo', 'secondo') then 1
       when r.recupero = p.recupero then 1
       else 0
     end) as rec,
    (p.first_goal is not null and p.first_goal = r.first_goal_team) as prima_ok,
    (p.last_goal is not null and p.last_goal = r.last_goal_team) as ultima_ok,
    (case when p.extra_time is not null and p.extra_time = r.extra_time then 5 else 0 end) as supplementari,
    coalesce((select array_agg(m.m order by m.m) from unnest(p.minuti) m(m) where m.m = any (r.minuti_gol)), '{}'::integer[]) as minuti_azzeccati
  from pronostici p
    join risultati r on r.schedina_id = p.schedina_id
    join schedine s on s.id = p.schedina_id
    join profiles pr on pr.id = p.user_id
), punti as (
  select b.*,
    b.doppio_primo + (case when b.nuove then 0 else b.doppio_ultimo end) as doppi,
    (case
       when b.nuove then (b.prima_ok::int + b.ultima_ok::int)
       when b.prima_ok and b.ultima_ok then 10
       when b.prima_ok or b.ultima_ok then 3
       else 0
     end) + b.supplementari as bonus
  from base b
)
select schedina_id, user_id, username, full_name,
  presi + doppi as punti_minuti,
  rec as punti_recupero,
  bonus as punti_bonus,
  presi + doppi + rec + bonus as totale,
  minuti_azzeccati,
  doppi as punti_doppi
from punti;

grant select on public.classifica to anon, authenticated;
