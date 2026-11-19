-- ============================================================
-- 90 & Goal — Giornate da novembre 2026 a gennaio 2027
-- Una schedina per serie a ogni giornata: Serie A 12ª–21ª, Serie B 12ª–21ª,
-- Serie C 15ª–24ª (le dieci partite a giornata indicate nel documento ricevuto).
-- Date e orari presi dai comunicati ufficiali delle leghe (19 novembre 2026).
-- Scadenza = primo calcio d'inizio della giornata, in UTC.
-- Esegui UNA VOLTA nel SQL Editor di Supabase. Idempotente: si può rilanciare.
--
-- ⚠️ Scadenze da confermare dal pannello admin (Gestione schedine), insieme a date e
--    orari delle partite senza ora:
--    · Serie A 20ª e 21ª e Serie C 21ª–24ª: orari non ancora pubblicati, scadenza
--      provvisoria il venerdì prima alle 18:30.
--    · Serie C 17ª–20ª: orario presente solo per alcune partite; la scadenza è il
--      primo calcio d'inizio fra quelle.
--    · Serie B 15ª: il documento aveva 12 righe con squadre ripetute; qui ci sono le
--      dieci partite del calendario ufficiale.
-- ============================================================

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 12ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-20 19:30:00+00',
  '[
    {"home":"Hellas Verona","away":"Cesena","date":"2026-11-20","ora":"20:30","competizione":"Serie B"},
    {"home":"Ascoli","away":"L.R. Vicenza","date":"2026-11-21","ora":"15:00","competizione":"Serie B"},
    {"home":"Carrarese","away":"Virtus Entella","date":"2026-11-21","ora":"15:00","competizione":"Serie B"},
    {"home":"Modena","away":"Juve Stabia","date":"2026-11-21","ora":"15:00","competizione":"Serie B"},
    {"home":"Sampdoria","away":"Benevento","date":"2026-11-21","ora":"15:00","competizione":"Serie B"},
    {"home":"Südtirol","away":"Cremonese","date":"2026-11-21","ora":"15:00","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Palermo","date":"2026-11-21","ora":"17:15","competizione":"Serie B"},
    {"home":"Empoli","away":"Pisa","date":"2026-11-21","ora":"19:30","competizione":"Serie B"},
    {"home":"Avellino","away":"Mantova","date":"2026-11-22","ora":"15:00","competizione":"Serie B"},
    {"home":"Arezzo","away":"Padova","date":"2026-11-22","ora":"17:15","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 12ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 15ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-21 13:30:00+00',
  '[
    {"home":"Inter U23","away":"Potenza","date":"2026-11-21","ora":"14:30","competizione":"Serie C"},
    {"home":"Campobasso","away":"Vis Pesaro","date":"2026-11-21","ora":"17:30","competizione":"Serie C"},
    {"home":"Union Brescia","away":"Renate","date":"2026-11-22","ora":"12:30","competizione":"Serie C"},
    {"home":"Scafatese","away":"Foggia","date":"2026-11-22","ora":"12:30","competizione":"Serie C"},
    {"home":"Alcione Milano","away":"Ospitaletto Franciacorta","date":"2026-11-22","ora":"14:30","competizione":"Serie C"},
    {"home":"Picerno","away":"Giugliano","date":"2026-11-22","ora":"17:30","competizione":"Serie C"},
    {"home":"Sambenedettese","away":"Perugia","date":"2026-11-22","ora":"17:30","competizione":"Serie C"},
    {"home":"Dolomiti Bellunesi","away":"Carpi","date":"2026-11-22","ora":"17:30","competizione":"Serie C"},
    {"home":"Forlì","away":"Reggiana","date":"2026-11-22","ora":"17:30","competizione":"Serie C"},
    {"home":"Grosseto","away":"Guidonia Montecelio","date":"2026-11-23","ora":"20:30","competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 15ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 12ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-21 14:00:00+00',
  '[
    {"home":"Como","away":"Cagliari","date":"2026-11-21","ora":"15:00","competizione":"Serie A"},
    {"home":"Lazio","away":"Lecce","date":"2026-11-21","ora":"15:00","competizione":"Serie A"},
    {"home":"Parma","away":"Roma","date":"2026-11-21","ora":"18:00","competizione":"Serie A"},
    {"home":"Napoli","away":"Torino","date":"2026-11-21","ora":"20:45","competizione":"Serie A"},
    {"home":"Juventus","away":"Venezia","date":"2026-11-22","ora":"12:30","competizione":"Serie A"},
    {"home":"Bologna","away":"Udinese","date":"2026-11-22","ora":"15:00","competizione":"Serie A"},
    {"home":"Sassuolo","away":"Genoa","date":"2026-11-22","ora":"15:00","competizione":"Serie A"},
    {"home":"Milan","away":"Frosinone","date":"2026-11-22","ora":"18:00","competizione":"Serie A"},
    {"home":"Atalanta","away":"Inter","date":"2026-11-22","ora":"20:45","competizione":"Serie A"},
    {"home":"Monza","away":"Fiorentina","date":"2026-11-23","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 12ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 13ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-24 18:00:00+00',
  '[
    {"home":"Juve Stabia","away":"Catanzaro","date":"2026-11-24","ora":"19:00","competizione":"Serie B"},
    {"home":"Benevento","away":"Empoli","date":"2026-11-24","ora":"20:00","competizione":"Serie B"},
    {"home":"Cesena","away":"Ascoli","date":"2026-11-24","ora":"20:00","competizione":"Serie B"},
    {"home":"L.R. Vicenza","away":"Carrarese","date":"2026-11-24","ora":"20:00","competizione":"Serie B"},
    {"home":"Palermo","away":"Südtirol","date":"2026-11-24","ora":"20:00","competizione":"Serie B"},
    {"home":"Virtus Entella","away":"Hellas Verona","date":"2026-11-24","ora":"20:00","competizione":"Serie B"},
    {"home":"Cremonese","away":"Avellino","date":"2026-11-25","ora":"19:00","competizione":"Serie B"},
    {"home":"Mantova","away":"Arezzo","date":"2026-11-25","ora":"20:00","competizione":"Serie B"},
    {"home":"Padova","away":"Sampdoria","date":"2026-11-25","ora":"20:00","competizione":"Serie B"},
    {"home":"Pisa","away":"Modena","date":"2026-11-25","ora":"20:00","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 13ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 16ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-27 19:30:00+00',
  '[
    {"home":"Cavese","away":"Scafatese","date":"2026-11-27","ora":"20:30","competizione":"Serie C"},
    {"home":"Giugliano","away":"Altamura","date":"2026-11-28","ora":"14:30","competizione":"Serie C"},
    {"home":"Carpi","away":"Lecco","date":"2026-11-28","ora":"14:30","competizione":"Serie C"},
    {"home":"Barletta","away":"Inter U23","date":"2026-11-29","ora":"12:30","competizione":"Serie C"},
    {"home":"Potenza","away":"Audace Cerignola","date":"2026-11-29","ora":"14:30","competizione":"Serie C"},
    {"home":"Casarano","away":"Catania","date":"2026-11-29","ora":"14:30","competizione":"Serie C"},
    {"home":"Perugia","away":"Livorno","date":"2026-11-29","ora":"14:30","competizione":"Serie C"},
    {"home":"Vis Pesaro","away":"Sambenedettese","date":"2026-11-29","ora":"17:30","competizione":"Serie C"},
    {"home":"Crotone","away":"Picerno","date":"2026-11-29","ora":"17:30","competizione":"Serie C"},
    {"home":"Atalanta U23","away":"Forlì","date":"2026-11-29","ora":"17:30","competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 16ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 13ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-27 19:45:00+00',
  '[
    {"home":"Venezia","away":"Bologna","date":"2026-11-27","ora":"20:45","competizione":"Serie A"},
    {"home":"Frosinone","away":"Parma","date":"2026-11-28","ora":"15:00","competizione":"Serie A"},
    {"home":"Torino","away":"Lazio","date":"2026-11-28","ora":"18:00","competizione":"Serie A"},
    {"home":"Inter","away":"Genoa","date":"2026-11-28","ora":"20:45","competizione":"Serie A"},
    {"home":"Udinese","away":"Fiorentina","date":"2026-11-29","ora":"12:30","competizione":"Serie A"},
    {"home":"Sassuolo","away":"Napoli","date":"2026-11-29","ora":"15:00","competizione":"Serie A"},
    {"home":"Roma","away":"Monza","date":"2026-11-29","ora":"18:00","competizione":"Serie A"},
    {"home":"Como","away":"Juventus","date":"2026-11-29","ora":"20:45","competizione":"Serie A"},
    {"home":"Lecce","away":"Atalanta","date":"2026-11-30","ora":"18:30","competizione":"Serie A"},
    {"home":"Cagliari","away":"Milan","date":"2026-11-30","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 13ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 14ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-11-28 14:00:00+00',
  '[
    {"home":"Ascoli","away":"Virtus Entella","date":"2026-11-28","ora":"15:00","competizione":"Serie B"},
    {"home":"Carrarese","away":"Juve Stabia","date":"2026-11-28","ora":"15:00","competizione":"Serie B"},
    {"home":"Empoli","away":"Hellas Verona","date":"2026-11-28","ora":"15:00","competizione":"Serie B"},
    {"home":"L.R. Vicenza","away":"Cesena","date":"2026-11-28","ora":"17:15","competizione":"Serie B"},
    {"home":"Palermo","away":"Benevento","date":"2026-11-28","ora":"19:30","competizione":"Serie B"},
    {"home":"Modena","away":"Padova","date":"2026-11-29","ora":"15:00","competizione":"Serie B"},
    {"home":"Südtirol","away":"Mantova","date":"2026-11-29","ora":"15:00","competizione":"Serie B"},
    {"home":"Sampdoria","away":"Cremonese","date":"2026-11-29","ora":"17:15","competizione":"Serie B"},
    {"home":"Arezzo","away":"Pisa","date":"2026-11-29","ora":"19:30","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Avellino","date":"2026-11-30","ora":"20:30","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 14ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 15ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-04 19:30:00+00',
  '[
    {"home":"Pisa","away":"Sampdoria","date":"2026-12-04","ora":"20:30","competizione":"Serie B"},
    {"home":"Cesena","away":"Carrarese","date":"2026-12-05","ora":"15:00","competizione":"Serie B"},
    {"home":"Mantova","away":"Ascoli","date":"2026-12-05","ora":"15:00","competizione":"Serie B"},
    {"home":"Modena","away":"Arezzo","date":"2026-12-05","ora":"15:00","competizione":"Serie B"},
    {"home":"Padova","away":"L.R. Vicenza","date":"2026-12-05","ora":"17:15","competizione":"Serie B"},
    {"home":"Juve Stabia","away":"Benevento","date":"2026-12-05","ora":"19:30","competizione":"Serie B"},
    {"home":"Avellino","away":"Südtirol","date":"2026-12-06","ora":"15:00","competizione":"Serie B"},
    {"home":"Cremonese","away":"Catanzaro","date":"2026-12-06","ora":"15:00","competizione":"Serie B"},
    {"home":"Hellas Verona","away":"Palermo","date":"2026-12-06","ora":"17:15","competizione":"Serie B"},
    {"home":"Virtus Entella","away":"Empoli","date":"2026-12-06","ora":"19:30","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 15ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 17ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-04 19:30:00+00',   -- primo calcio d'inizio fra le partite con orario: da confermare
  '[
    {"home":"Livorno","away":"Vis Pesaro","date":"2026-12-04","ora":"20:30","competizione":"Serie C"},
    {"home":"Casertana","away":"Potenza","date":"2026-12-05","ora":"17:30","competizione":"Serie C"},
    {"home":"Catania","away":"Cavese","date":"2026-12-06","ora":"12:30","competizione":"Serie C"},
    {"home":"Union Brescia","away":"Juventus Next Gen","date":"2026-12-06","ora":"14:30","competizione":"Serie C"},
    {"home":"Grosseto","away":"Atalanta U23","date":"2026-12-06","ora":"17:30","competizione":"Serie C"},
    {"home":"Picerno","away":"Barletta","date":"2026-12-06","ora":null,"competizione":"Serie C"},
    {"home":"Carpi","away":"Trento","date":"2026-12-06","ora":null,"competizione":"Serie C"},
    {"home":"Giugliano","away":"Foggia","date":"2026-12-06","ora":null,"competizione":"Serie C"},
    {"home":"Inter U23","away":"Sorrento","date":"2026-12-06","ora":null,"competizione":"Serie C"},
    {"home":"Perugia","away":"Campobasso","date":"2026-12-06","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 17ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 14ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-04 19:45:00+00',
  '[
    {"home":"Bologna","away":"Roma","date":"2026-12-04","ora":"20:45","competizione":"Serie A"},
    {"home":"Monza","away":"Como","date":"2026-12-05","ora":"15:00","competizione":"Serie A"},
    {"home":"Frosinone","away":"Inter","date":"2026-12-05","ora":"18:00","competizione":"Serie A"},
    {"home":"Napoli","away":"Lecce","date":"2026-12-05","ora":"20:45","competizione":"Serie A"},
    {"home":"Genoa","away":"Torino","date":"2026-12-06","ora":"12:30","competizione":"Serie A"},
    {"home":"Lazio","away":"Atalanta","date":"2026-12-06","ora":"15:00","competizione":"Serie A"},
    {"home":"Juventus","away":"Udinese","date":"2026-12-06","ora":"18:00","competizione":"Serie A"},
    {"home":"Milan","away":"Parma","date":"2026-12-06","ora":"20:45","competizione":"Serie A"},
    {"home":"Venezia","away":"Sassuolo","date":"2026-12-07","ora":"18:30","competizione":"Serie A"},
    {"home":"Fiorentina","away":"Cagliari","date":"2026-12-07","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 14ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 16ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-08 11:30:00+00',
  '[
    {"home":"Benevento","away":"Padova","date":"2026-12-08","ora":"12:30","competizione":"Serie B"},
    {"home":"Carrarese","away":"Pisa","date":"2026-12-08","ora":"15:00","competizione":"Serie B"},
    {"home":"L.R. Vicenza","away":"Mantova","date":"2026-12-08","ora":"15:00","competizione":"Serie B"},
    {"home":"Ascoli","away":"Juve Stabia","date":"2026-12-08","ora":"17:15","competizione":"Serie B"},
    {"home":"Sampdoria","away":"Modena","date":"2026-12-08","ora":"19:30","competizione":"Serie B"},
    {"home":"Hellas Verona","away":"Avellino","date":"2026-12-09","ora":"19:00","competizione":"Serie B"},
    {"home":"Arezzo","away":"Cesena","date":"2026-12-09","ora":"20:00","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Virtus Entella","date":"2026-12-09","ora":"20:00","competizione":"Serie B"},
    {"home":"Empoli","away":"Südtirol","date":"2026-12-09","ora":"20:00","competizione":"Serie B"},
    {"home":"Palermo","away":"Cremonese","date":"2026-12-09","ora":"20:00","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 16ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 15ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-11 19:45:00+00',
  '[
    {"home":"Udinese","away":"Frosinone","date":"2026-12-11","ora":"20:45","competizione":"Serie A"},
    {"home":"Cagliari","away":"Venezia","date":"2026-12-12","ora":"15:00","competizione":"Serie A"},
    {"home":"Lecce","away":"Sassuolo","date":"2026-12-12","ora":"18:00","competizione":"Serie A"},
    {"home":"Como","away":"Bologna","date":"2026-12-12","ora":"20:45","competizione":"Serie A"},
    {"home":"Lazio","away":"Roma","date":"2026-12-13","ora":"12:30","competizione":"Serie A"},
    {"home":"Inter","away":"Torino","date":"2026-12-13","ora":"15:00","competizione":"Serie A"},
    {"home":"Parma","away":"Fiorentina","date":"2026-12-13","ora":"18:00","competizione":"Serie A"},
    {"home":"Napoli","away":"Milan","date":"2026-12-13","ora":"20:45","competizione":"Serie A"},
    {"home":"Atalanta","away":"Genoa","date":"2026-12-14","ora":"18:30","competizione":"Serie A"},
    {"home":"Juventus","away":"Monza","date":"2026-12-14","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 15ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 18ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-12 13:30:00+00',   -- primo calcio d'inizio fra le partite con orario: da confermare
  '[
    {"home":"Cavese","away":"Inter U23","date":"2026-12-12","ora":"14:30","competizione":"Serie C"},
    {"home":"Potenza","away":"Giugliano","date":"2026-12-13","ora":"14:30","competizione":"Serie C"},
    {"home":"Ravenna","away":"Grosseto","date":"2026-12-13","ora":"17:30","competizione":"Serie C"},
    {"home":"Vis Pesaro","away":"Perugia","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Novara","away":"Carpi","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Scafatese","away":"Casarano","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Sambenedettese","away":"Forlì","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Alcione Milano","away":"Union Brescia","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Altamura","away":"Picerno","date":"2026-12-13","ora":null,"competizione":"Serie C"},
    {"home":"Pescara","away":"Ternana","date":"2026-12-13","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 18ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 17ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-12 14:00:00+00',
  '[
    {"home":"Juve Stabia","away":"Padova","date":"2026-12-12","ora":"15:00","competizione":"Serie B"},
    {"home":"Mantova","away":"Benevento","date":"2026-12-12","ora":"15:00","competizione":"Serie B"},
    {"home":"Pisa","away":"Ascoli","date":"2026-12-12","ora":"15:00","competizione":"Serie B"},
    {"home":"Cesena","away":"Palermo","date":"2026-12-12","ora":"17:15","competizione":"Serie B"},
    {"home":"Sampdoria","away":"L.R. Vicenza","date":"2026-12-12","ora":"19:30","competizione":"Serie B"},
    {"home":"Cremonese","away":"Carrarese","date":"2026-12-13","ora":"15:00","competizione":"Serie B"},
    {"home":"Südtirol","away":"Hellas Verona","date":"2026-12-13","ora":"15:00","competizione":"Serie B"},
    {"home":"Virtus Entella","away":"Arezzo","date":"2026-12-13","ora":"15:00","competizione":"Serie B"},
    {"home":"Avellino","away":"Empoli","date":"2026-12-13","ora":"17:15","competizione":"Serie B"},
    {"home":"Modena","away":"Catanzaro","date":"2026-12-13","ora":"19:30","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 17ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 16ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-18 17:30:00+00',
  '[
    {"home":"Frosinone","away":"Lazio","date":"2026-12-18","ora":"18:30","competizione":"Serie A"},
    {"home":"Lecce","away":"Inter","date":"2026-12-18","ora":"20:45","competizione":"Serie A"},
    {"home":"Sassuolo","away":"Parma","date":"2026-12-19","ora":"15:00","competizione":"Serie A"},
    {"home":"Milan","away":"Como","date":"2026-12-19","ora":"18:00","competizione":"Serie A"},
    {"home":"Roma","away":"Juventus","date":"2026-12-19","ora":"20:45","competizione":"Serie A"},
    {"home":"Fiorentina","away":"Bologna","date":"2026-12-20","ora":"12:30","competizione":"Serie A"},
    {"home":"Torino","away":"Cagliari","date":"2026-12-20","ora":"15:00","competizione":"Serie A"},
    {"home":"Venezia","away":"Monza","date":"2026-12-20","ora":"15:00","competizione":"Serie A"},
    {"home":"Genoa","away":"Udinese","date":"2026-12-20","ora":"18:00","competizione":"Serie A"},
    {"home":"Atalanta","away":"Napoli","date":"2026-12-20","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 16ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 18ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-18 19:30:00+00',
  '[
    {"home":"Hellas Verona","away":"Cremonese","date":"2026-12-18","ora":"20:30","competizione":"Serie B"},
    {"home":"Benevento","away":"Pisa","date":"2026-12-19","ora":"15:00","competizione":"Serie B"},
    {"home":"Carrarese","away":"Avellino","date":"2026-12-19","ora":"15:00","competizione":"Serie B"},
    {"home":"Juve Stabia","away":"Mantova","date":"2026-12-19","ora":"15:00","competizione":"Serie B"},
    {"home":"L.R. Vicenza","away":"Südtirol","date":"2026-12-19","ora":"15:00","competizione":"Serie B"},
    {"home":"Padova","away":"Cesena","date":"2026-12-19","ora":"15:00","competizione":"Serie B"},
    {"home":"Empoli","away":"Sampdoria","date":"2026-12-19","ora":"17:15","competizione":"Serie B"},
    {"home":"Ascoli","away":"Modena","date":"2026-12-19","ora":"19:30","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Arezzo","date":"2026-12-20","ora":"15:00","competizione":"Serie B"},
    {"home":"Palermo","away":"Virtus Entella","date":"2026-12-20","ora":"17:15","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 18ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 19ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-19 13:30:00+00',   -- primo calcio d'inizio fra le partite con orario: da confermare
  '[
    {"home":"Sorrento","away":"Potenza","date":"2026-12-19","ora":"14:30","competizione":"Serie C"},
    {"home":"Catania","away":"Foggia","date":"2026-12-20","ora":"14:30","competizione":"Serie C"},
    {"home":"Giugliano","away":"Cavese","date":"2026-12-20","ora":"17:30","competizione":"Serie C"},
    {"home":"Grosseto","away":"Pianese","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Carpi","away":"Pro Vercelli","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Picerno","away":"Audace Cerignola","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Inter U23","away":"Casertana","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Campobasso","away":"Sambenedettese","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Union Brescia","away":"Pergolettese","date":"2026-12-20","ora":null,"competizione":"Serie C"},
    {"home":"Arezzo","away":"Vis Pesaro","date":"2026-12-20","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 19ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 19ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2026-12-26 16:15:00+00',
  '[
    {"home":"Avellino","away":"Juve Stabia","date":"2026-12-26","ora":"17:15","competizione":"Serie B"},
    {"home":"Modena","away":"Palermo","date":"2026-12-27","ora":"12:30","competizione":"Serie B"},
    {"home":"Arezzo","away":"L.R. Vicenza","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Empoli","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Cremonese","away":"Ascoli","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Mantova","away":"Padova","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Südtirol","away":"Carrarese","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Virtus Entella","away":"Benevento","date":"2026-12-27","ora":"15:00","competizione":"Serie B"},
    {"home":"Cesena","away":"Pisa","date":"2026-12-27","ora":"17:15","competizione":"Serie B"},
    {"home":"Sampdoria","away":"Hellas Verona","date":"2026-12-27","ora":"19:30","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 19ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 17ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-02 11:30:00+00',
  '[
    {"home":"Cagliari","away":"Genoa","date":"2027-01-02","ora":"12:30","competizione":"Serie A"},
    {"home":"Fiorentina","away":"Lazio","date":"2027-01-02","ora":"15:00","competizione":"Serie A"},
    {"home":"Torino","away":"Venezia","date":"2027-01-02","ora":"15:00","competizione":"Serie A"},
    {"home":"Roma","away":"Frosinone","date":"2027-01-02","ora":"18:00","competizione":"Serie A"},
    {"home":"Monza","away":"Milan","date":"2027-01-02","ora":"20:45","competizione":"Serie A"},
    {"home":"Inter","away":"Sassuolo","date":"2027-01-03","ora":"12:30","competizione":"Serie A"},
    {"home":"Como","away":"Lecce","date":"2027-01-03","ora":"15:00","competizione":"Serie A"},
    {"home":"Udinese","away":"Atalanta","date":"2027-01-03","ora":"15:00","competizione":"Serie A"},
    {"home":"Parma","away":"Napoli","date":"2027-01-03","ora":"18:00","competizione":"Serie A"},
    {"home":"Bologna","away":"Juventus","date":"2027-01-03","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 17ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 20ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-02 13:30:00+00',   -- primo calcio d'inizio fra le partite con orario: da confermare
  '[
    {"home":"Spezia","away":"Grosseto","date":"2027-01-02","ora":"14:30","competizione":"Serie C"},
    {"home":"Carpi","away":"Union Brescia","date":"2027-01-03","ora":"17:30","competizione":"Serie C"},
    {"home":"Cavese","away":"Picerno","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Savoia","away":"Giugliano","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Inter U23","away":"Audace Cerignola","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Perugia","away":"Sambenedettese","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Vis Pesaro","away":"Campobasso","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Giana Erminio","away":"AlbinoLeffe","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Catania","away":"Salernitana","date":"2027-01-03","ora":null,"competizione":"Serie C"},
    {"home":"Casarano","away":"Potenza","date":"2027-01-04","ora":"20:30","competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 20ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 18ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-05 17:30:00+00',
  '[
    {"home":"Genoa","away":"Monza","date":"2027-01-05","ora":"18:30","competizione":"Serie A"},
    {"home":"Venezia","away":"Roma","date":"2027-01-05","ora":"18:30","competizione":"Serie A"},
    {"home":"Milan","away":"Fiorentina","date":"2027-01-05","ora":"20:45","competizione":"Serie A"},
    {"home":"Juventus","away":"Torino","date":"2027-01-06","ora":"12:30","competizione":"Serie A"},
    {"home":"Frosinone","away":"Bologna","date":"2027-01-06","ora":"15:00","competizione":"Serie A"},
    {"home":"Lecce","away":"Parma","date":"2027-01-06","ora":"15:00","competizione":"Serie A"},
    {"home":"Atalanta","away":"Como","date":"2027-01-06","ora":"18:00","competizione":"Serie A"},
    {"home":"Lazio","away":"Inter","date":"2027-01-06","ora":"20:45","competizione":"Serie A"},
    {"home":"Sassuolo","away":"Udinese","date":"2027-01-07","ora":"18:30","competizione":"Serie A"},
    {"home":"Napoli","away":"Cagliari","date":"2027-01-07","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 18ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 21ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-08 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Potenza","away":"Cosenza","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Picerno","away":"Scafatese","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Juventus Next Gen","away":"Carpi","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Giugliano","away":"Barletta","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Grosseto","away":"Gubbio","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Crotone","away":"Cavese","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Union Brescia","away":"AlbinoLeffe","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Foggia","away":"Inter U23","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Forlì","away":"Vis Pesaro","date":"2027-01-10","ora":null,"competizione":"Serie C"},
    {"home":"Guidonia Montecelio","away":"Perugia","date":"2027-01-10","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 21ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 19ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-09 14:00:00+00',
  '[
    {"home":"Monza","away":"Frosinone","date":"2027-01-09","ora":"15:00","competizione":"Serie A"},
    {"home":"Roma","away":"Milan","date":"2027-01-09","ora":"18:00","competizione":"Serie A"},
    {"home":"Bologna","away":"Genoa","date":"2027-01-09","ora":"20:45","competizione":"Serie A"},
    {"home":"Como","away":"Lazio","date":"2027-01-10","ora":"12:30","competizione":"Serie A"},
    {"home":"Fiorentina","away":"Lecce","date":"2027-01-10","ora":"15:00","competizione":"Serie A"},
    {"home":"Parma","away":"Venezia","date":"2027-01-10","ora":"15:00","competizione":"Serie A"},
    {"home":"Torino","away":"Atalanta","date":"2027-01-10","ora":"18:00","competizione":"Serie A"},
    {"home":"Inter","away":"Juventus","date":"2027-01-10","ora":"20:45","competizione":"Serie A"},
    {"home":"Cagliari","away":"Sassuolo","date":"2027-01-11","ora":"18:30","competizione":"Serie A"},
    {"home":"Udinese","away":"Napoli","date":"2027-01-11","ora":"20:45","competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 19ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 20ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-09 14:00:00+00',
  '[
    {"home":"Cesena","away":"Modena","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"Juve Stabia","away":"Sampdoria","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"L.R. Vicenza","away":"Virtus Entella","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"Mantova","away":"Carrarese","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"Padova","away":"Cremonese","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"Südtirol","away":"Benevento","date":"2027-01-09","ora":"15:00","competizione":"Serie B"},
    {"home":"Palermo","away":"Empoli","date":"2027-01-09","ora":"17:15","competizione":"Serie B"},
    {"home":"Arezzo","away":"Hellas Verona","date":"2027-01-09","ora":"19:30","competizione":"Serie B"},
    {"home":"Ascoli","away":"Catanzaro","date":"2027-01-10","ora":"15:00","competizione":"Serie B"},
    {"home":"Pisa","away":"Avellino","date":"2027-01-10","ora":"17:15","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 20ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 20ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-15 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Lecce","away":"Udinese","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Juventus","away":"Genoa","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Milan","away":"Torino","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Parma","away":"Inter","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Napoli","away":"Fiorentina","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Cagliari","away":"Como","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Lazio","away":"Bologna","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Atalanta","away":"Roma","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Venezia","away":"Frosinone","date":"2027-01-16","ora":null,"competizione":"Serie A"},
    {"home":"Sassuolo","away":"Monza","date":"2027-01-16","ora":null,"competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 20ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 22ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-15 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Inter U23","away":"Picerno","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Cavese","away":"Salernitana","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Carpi","away":"AlbinoLeffe","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Potenza","away":"Bari","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Giugliano","away":"Casertana","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Vis Pesaro","away":"Grosseto","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Renate","away":"Union Brescia","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Sambenedettese","away":"Campobasso","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Catania","away":"Casarano","date":"2027-01-17","ora":null,"competizione":"Serie C"},
    {"home":"Ospitaletto Franciacorta","away":"Alcione Milano","date":"2027-01-17","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 22ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie B · 21ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-15 19:30:00+00',
  '[
    {"home":"Sampdoria","away":"Mantova","date":"2027-01-15","ora":"20:30","competizione":"Serie B"},
    {"home":"Ascoli","away":"Südtirol","date":"2027-01-16","ora":"15:00","competizione":"Serie B"},
    {"home":"Avellino","away":"Virtus Entella","date":"2027-01-16","ora":"15:00","competizione":"Serie B"},
    {"home":"Benevento","away":"Arezzo","date":"2027-01-16","ora":"15:00","competizione":"Serie B"},
    {"home":"Carrarese","away":"Padova","date":"2027-01-16","ora":"15:00","competizione":"Serie B"},
    {"home":"Empoli","away":"Modena","date":"2027-01-16","ora":"15:00","competizione":"Serie B"},
    {"home":"Catanzaro","away":"Cesena","date":"2027-01-16","ora":"17:15","competizione":"Serie B"},
    {"home":"Palermo","away":"Pisa","date":"2027-01-16","ora":"19:30","competizione":"Serie B"},
    {"home":"Hellas Verona","away":"Juve Stabia","date":"2027-01-17","ora":"15:00","competizione":"Serie B"},
    {"home":"Cremonese","away":"L.R. Vicenza","date":"2027-01-17","ora":"17:15","competizione":"Serie B"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie B · 21ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie A · 21ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-22 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Bologna","away":"Atalanta","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Como","away":"Napoli","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Fiorentina","away":"Sassuolo","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Frosinone","away":"Milan","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Genoa","away":"Parma","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Inter","away":"Venezia","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Juventus","away":"Cagliari","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Lecce","away":"Torino","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Monza","away":"Lazio","date":"2027-01-24","ora":null,"competizione":"Serie A"},
    {"home":"Roma","away":"Udinese","date":"2027-01-24","ora":null,"competizione":"Serie A"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie A · 21ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 23ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-22 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Potenza","away":"Salernitana","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Scafatese","away":"Catania","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Cavese","away":"Cosenza","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Picerno","away":"Giugliano","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Grosseto","away":"Livorno","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Lecco","away":"Carpi","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Inter U23","away":"Barletta","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Forlì","away":"Atalanta U23","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Sambenedettese","away":"Vis Pesaro","date":"2027-01-24","ora":null,"competizione":"Serie C"},
    {"home":"Union Brescia","away":"Trento","date":"2027-01-24","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 23ª giornata');

insert into public.schedine (nome, torneo, fase, attiva, deadline, partite)
select 'Serie C · 24ª giornata', 'Campionati italiani 2026/27', 'campionato', true,
  '2027-01-29 17:30:00+00',   -- PROVVISORIA: orari non ancora pubblicati
  '[
    {"home":"Campobasso","away":"Grosseto","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Potenza","away":"Audace Cerignola","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Inter U23","away":"Crotone","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Altamura","away":"Giugliano","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Scafatese","away":"Cavese","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Carpi","away":"Dolomiti Bellunesi","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Picerno","away":"Cosenza","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Livorno","away":"Perugia","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Vis Pesaro","away":"Ravenna","date":"2027-01-31","ora":null,"competizione":"Serie C"},
    {"home":"Alcione Milano","away":"Arzignano Valchiampo","date":"2027-01-31","ora":null,"competizione":"Serie C"}
  ]'::jsonb
where not exists (select 1 from public.schedine where nome = 'Serie C · 24ª giornata');
