-- ============================================================
-- 90 & Goal — Risultati automatici anche con l'app chiusa (FACOLTATIVO)
-- I risultati si aggiornano da soli quando qualcuno ha l'app aperta. Con questo
-- script è il database a chiedere l'aggiornamento ogni minuto: così le notifiche
-- dei gol partono anche se in quel momento nessuno sta guardando.
-- Esegui UNA VOLTA nel SQL Editor di Supabase. Idempotente: si può rilanciare.
-- Per spegnerlo: select cron.unschedule('risultati-auto');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'risultati-auto';

select cron.schedule(
  'risultati-auto',
  '* * * * *',
  $$ select net.http_get('https://90egoal.vercel.app/api/risultati/sync') $$
);
