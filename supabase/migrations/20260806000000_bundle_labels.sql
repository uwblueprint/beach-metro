-- Per-bundle, per-issue label state (PRD Flow 6).
--
-- A label is printed for ONE BUNDLE, not one route: the office picks the subset
-- of bundles that need labelling each issue, and a route with three bundles can
-- have one labelled and two not. So the unit of record is a bundle.
--
-- Bundles have no id. They live as a JSONB array on route_deliveries.bundles,
-- so a bundle is addressed positionally: (delivery_id, bundle_index).
--
-- KNOWN LIMITATION of the positional key: re-splitting a delivery's bundles
-- shifts the indices, and the labelled flags shift with them. Accepted for MVP
-- because a re-split means the physical bundles changed anyway and the old
-- labels are stale. If this bites, bundles gain a stable id and this table
-- points at it instead.
--
-- Presence of a row means labelled; there is no `labelled boolean`. Unlabelling
-- is a delete, which keeps "never labelled" and "un-labelled again" the same
-- state — the office only cares whether a label exists.
--
-- Scoped per issue for free: delivery_id already belongs to exactly one issue,
-- so a new issue starts with every bundle unlabelled without any reset step.

create table bundle_labels (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references route_deliveries (id) on delete cascade,
  bundle_index integer not null check (bundle_index >= 0),
  labelled_at timestamptz not null default now(),
  unique (delivery_id, bundle_index)
);

create index bundle_labels_delivery_idx on bundle_labels (delivery_id);

comment on table bundle_labels is
  'One row per labelled bundle. Presence = labelled; unlabelling deletes the row. '
  'Keyed positionally into route_deliveries.bundles, so a re-split shifts indices.';

-- RLS as defense-in-depth only, matching every other table: no policies, all
-- access is server-side via the service-role key.
alter table bundle_labels enable row level security;

-- New tables are not auto-exposed to PostgREST (supabase/config.toml
-- `auto_expose_new_tables`), so the service role needs an explicit grant.
grant select, insert, update, delete on table bundle_labels to service_role;
