-- ============================================================
-- BRAIN — i mandati
--
-- Delta da eseguire dopo `migration_brain.sql` e `migration_brain_brief.sql`.
--
-- Un mandato è una cosa che BRAIN si è preso in carico di fare, o di
-- ricordarti di fare, in un momento che non è adesso: il check-in di
-- un volo che apre fra dodici giorni, un bollo da pagare entro fine
-- mese, un invito a cui rispondere di no, un "ricordami domani alle 9".
--
-- La regola che lo rende diverso da un punto aperto è che ha **uno
-- stato e un orologio**: sa in che fase è e quando deve farsi vivo. E
-- la regola che lo rende sicuro è che **non parte niente senza il tuo
-- codice**: ogni mandato ne ha uno, breve, da citare ("ok 7F2A",
-- "fatto 7F2A", "no 7F2A"), così un "ok" detto alla cosa sbagliata non
-- diventa un'azione sbagliata.
-- ============================================================

create table if not exists public.brain_mandates (
  id            uuid primary key default gen_random_uuid(),
  -- Stabile: la stessa cosa (lo stesso volo, lo stesso avviso) ha
  -- sempre la stessa chiave, e non si duplica a ogni polso.
  key           text not null unique,
  kind          text not null,      -- checkin | payment | invite | remind | buy | pay | errand
  status        text not null,      -- proposed | waiting | approved | done | declined | expired
  -- Il codice breve da citare su WhatsApp.
  code          text not null,
  title         text not null,
  -- Il messaggio, già scritto per il telefono.
  text          text not null,
  payload       jsonb not null default '{}'::jsonb,
  citations     jsonb not null default '[]'::jsonb,
  -- Entro quando conta (la partenza, la scadenza del pagamento).
  due_at        timestamptz,
  -- Quando il polso deve riprenderlo in mano. Null: aspetta te.
  wake_at       timestamptz,
  -- L'approvazione in attesa, se il mandato ne chiede una.
  approval      jsonb,
  -- Il primo messaggio è già partito?
  announced_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz,
  note          text
);

create index if not exists brain_mandates_open_idx
  on public.brain_mandates (status, wake_at);

-- Stessa serratura di tutto il resto: RLS attiva, nessuna policy,
-- quindi si passa solo dalla service role key, lato server.
alter table public.brain_mandates enable row level security;
revoke all on public.brain_mandates from anon, authenticated;
