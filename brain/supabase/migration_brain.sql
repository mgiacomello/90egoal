-- ============================================================
-- BRAIN — la memoria e gli agenti
--
-- Tutto quello che entra (mail, eventi, file, transazioni, salute, note)
-- diventa un documento con una fonte, una data e un canale.
-- Nessuna riga è leggibile dal client: RLS attiva e nessuna policy,
-- quindi solo la service role key (lato server) può entrare.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) I documenti: l'unità di memoria. Un documento è sempre
--    riconducibile a una fonte esterna e a un momento nel tempo.
create table if not exists public.brain_documents (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,                       -- gmail | gcal | gdrive | qonto | oura | manual
  kind         text not null,                       -- email | event | file | transaction | health | note
  external_id  text not null,                       -- id stabile nel sistema di origine
  title        text not null default '',
  body         text not null default '',
  occurred_at  timestamptz not null,                -- quando è successo, non quando l'abbiamo letto
  url          text,
  participants text[] not null default '{}',
  metadata     jsonb not null default '{}'::jsonb,
  ingested_at  timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists brain_documents_occurred_idx
  on public.brain_documents (occurred_at desc);
create index if not exists brain_documents_source_idx
  on public.brain_documents (source, occurred_at desc);
create index if not exists brain_documents_participants_idx
  on public.brain_documents using gin (participants);

-- 2) I pezzi: un documento lungo si cerca male, i suoi pezzi bene.
--    La ricerca full-text vive qui; il ranking finale è in TypeScript.
create table if not exists public.brain_chunks (
  id          bigserial primary key,
  document_id uuid not null references public.brain_documents (id) on delete cascade,
  idx         int not null,
  content     text not null,
  fts         tsvector generated always as (to_tsvector('italian', content)) stored,
  unique (document_id, idx)
);

create index if not exists brain_chunks_fts_idx on public.brain_chunks using gin (fts);
create index if not exists brain_chunks_document_idx on public.brain_chunks (document_id);

-- 3) Le credenziali dei connettori (refresh token OAuth, cursori di sync).
--    Non escono mai dal server: nessuna policy, solo service role.
create table if not exists public.brain_credentials (
  connector   text primary key,                     -- google | qonto | oura
  data        jsonb not null default '{}'::jsonb,
  synced_at   timestamptz,
  updated_at  timestamptz not null default now()
);

-- 4) Il registro delle esecuzioni: ogni risposta di un agente lascia
--    traccia di modello usato, fonti lette e tempo impiegato.
create table if not exists public.brain_runs (
  id            bigserial primary key,
  agent         text not null,
  question      text not null default '',
  answer        jsonb not null default '{}'::jsonb,
  model         text,
  hits          int not null default 0,
  latency_ms    int,
  created_at    timestamptz not null default now()
);

create index if not exists brain_runs_created_idx on public.brain_runs (created_at desc);

-- 5) Ricerca full-text sui pezzi, con i dati del documento già attaccati.
--    Restituisce più candidati del necessario: a scegliere è il ranking
--    deterministico lato applicazione (lib/brain/rank.ts).
create or replace function public.brain_search(
  q         text,
  max_hits  int default 60,
  in_sources text[] default null,
  since     timestamptz default null
)
returns table (
  chunk_id     bigint,
  document_id  uuid,
  idx          int,
  content      text,
  rank         real,
  source       text,
  kind         text,
  title        text,
  occurred_at  timestamptz,
  url          text,
  participants text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    d.id,
    c.idx,
    c.content,
    ts_rank_cd(c.fts, websearch_to_tsquery('italian', q)) as rank,
    d.source,
    d.kind,
    d.title,
    d.occurred_at,
    d.url,
    d.participants
  from public.brain_chunks c
  join public.brain_documents d on d.id = c.document_id
  where c.fts @@ websearch_to_tsquery('italian', q)
    and (in_sources is null or d.source = any (in_sources))
    and (since is null or d.occurred_at >= since)
  order by rank desc, d.occurred_at desc
  limit greatest(1, least(max_hits, 200));
$$;

-- 6) Serrata. RLS attiva senza policy = nessun accesso da anon/authenticated.
--    La service role key bypassa le policy: è l'unica via d'ingresso.
alter table public.brain_documents   enable row level security;
alter table public.brain_chunks      enable row level security;
alter table public.brain_credentials enable row level security;
alter table public.brain_runs        enable row level security;

revoke all on public.brain_documents   from anon, authenticated;
revoke all on public.brain_chunks      from anon, authenticated;
revoke all on public.brain_credentials from anon, authenticated;
revoke all on public.brain_runs        from anon, authenticated;
revoke all on function public.brain_search(text, int, text[], timestamptz) from anon, authenticated;
