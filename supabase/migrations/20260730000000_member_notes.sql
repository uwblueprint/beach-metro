-- Notes become a real entity, per note, with their own timestamp.
--
-- This supersedes the pre-code reconciliation decision that removed the `Note`
-- entity in favour of a single free-form `notes` string ("author/timestamp
-- tracking was dropped as unneeded for MVP"). The members-page design that came
-- through Figma and review is a full multi-note UI: an add button, a date shown
-- per note, and per-note edit and delete. The office wants note history, so the
-- flattened field cannot back the screen. See docs/design_decisions.md.
--
-- Deliberately NOT touching volunteer_routes.notes, which stays a plain string.
-- The routes page (#17) edits it as one field and changing it here would conflict
-- for no gain. This table can take a route_id later if routes ever need history.

create table member_notes (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one parent. Two nullable FKs rather than a parent_type/parent_id
  -- pair so Postgres still enforces referential integrity and cascades on
  -- delete; a polymorphic pair would silently orphan rows.
  volunteer_id uuid references volunteers (id) on delete cascade,
  captain_id uuid references captains (id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint one_parent check (
    (volunteer_id is not null)::int + (captain_id is not null)::int = 1
  )
);

create index member_notes_volunteer_idx on member_notes (volunteer_id);
create index member_notes_captain_idx on member_notes (captain_id);

-- Backfill the flattened notes into the new table before dropping the columns.
-- One note per person, stamped now, since the old column carried no date.
insert into member_notes (volunteer_id, text)
select id, btrim(notes) from volunteers
where notes is not null and btrim(notes) <> '';

insert into member_notes (captain_id, text)
select id, btrim(notes) from captains
where notes is not null and btrim(notes) <> '';

alter table volunteers drop column notes;
alter table captains drop column notes;

alter table member_notes enable row level security;

-- New public tables are not reachable through the Data API roles without an
-- explicit grant (see supabase/config.toml `auto_expose_new_tables`). The
-- service-role client reads and writes this table via PostgREST.
grant select, insert, update, delete on table member_notes to service_role;
