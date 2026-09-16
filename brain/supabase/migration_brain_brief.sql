-- ============================================================
-- BRAIN — i punti aperti
--
-- Delta da eseguire dopo `migration_brain.sql`.
--
-- Un punto aperto è un impegno preso o una domanda ricevuta che non è
-- ancora stata chiusa. La regola che lo rende utile è una sola, ed è
-- anche l'unica che un assistente qualsiasi non rispetta:
--
--   **un punto si chiude solo quando lo chiudi tu.**
--
-- Il brief del giorno dopo non lo dimentica perché nessuno l'ha più
-- nominato. Se ne parla, aggiorna `last_seen_at`; se non ne parla, il
-- punto resta lì e invecchia — ed è proprio l'invecchiare che lo rende
-- una cosa da guardare.
-- ============================================================

create table if not exists public.brain_open_points (
  id            uuid primary key default gen_random_uuid(),
  text          text not null,
  -- Impronta normalizzata: impedisce il doppione identico. Il
  -- riconoscimento del punto *riformulato* è in lib/brain/openpoints.ts,
  -- perché richiede un confronto che il database non sa fare.
  fingerprint   text not null unique,
  -- Le fonti da cui il punto viene, nella stessa forma che la console
  -- usa per le risposte: canale, data, titolo, link.
  citations     jsonb not null default '[]'::jsonb,
  opened_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  closed_at     timestamptz,
  closed_note   text
);

create index if not exists brain_open_points_open_idx
  on public.brain_open_points (closed_at, opened_at desc);

-- Stessa serratura di tutto il resto: RLS attiva, nessuna policy,
-- quindi si passa solo dalla service role key, lato server.
alter table public.brain_open_points enable row level security;
revoke all on public.brain_open_points from anon, authenticated;
