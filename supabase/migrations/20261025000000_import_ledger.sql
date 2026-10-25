-- What the legacy importer remembers between runs.
--
-- The office's workbook has no identifiers. A person is a name, an RT code and
-- an address, and nothing in it survives being retyped. So the importer records
-- which spreadsheet row produced which record, and a hash of the fields it read
-- from that row.
--
-- A later run compares hashes. An unchanged row is skipped entirely, with no
-- write and no geocode. A changed row patches only the fields that moved. A row
-- that has vanished from the workbook is reported and left alone, because a row
-- can disappear because the office reorganised the sheet rather than because
-- the person left.
--
-- The address hash is kept apart from the rest because resolving an address
-- costs a billed call, so a corrected phone number must not trigger one.
--
-- This also makes the import's own work reversible. Linking people to a captain
-- territory can be undone for exactly the records the importer linked, rather
-- than for every volunteer who happens to have one.

create table import_rows (
  source       text not null,
  source_key   text not null,
  entity_type  text not null,
  entity_id    uuid not null,
  row_hash     text not null,
  address_hash text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (source, source_key)
);

alter table import_rows add constraint import_rows_entity_type_known
  check (entity_type in ('volunteer', 'captain', 'route', 'drop'));

-- One record is produced by one spreadsheet row. Without this a bug that
-- re-created a person under a second key would leave two ledger rows pointing
-- at one record, and the next run would update it twice.
create unique index import_rows_entity_key on import_rows (entity_type, entity_id);

create index import_rows_last_seen on import_rows (last_seen);

comment on table import_rows is
  'Maps a row of the office workbook to the record it produced. Written only by '
  'the legacy importer; the app never reads it.';
comment on column import_rows.source_key is
  'Natural key within the sheet, normalised. For the roster it is name, RT and '
  'address together, which separates all 338 recipients.';
comment on column import_rows.row_hash is
  'Hash of the fields the importer reads. An equal hash means skip the row.';
comment on column import_rows.address_hash is
  'Hash of the address alone, so a change elsewhere does not re-bill a geocode.';
