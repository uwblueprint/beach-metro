-- What kind of building a bulk drop serves, and what it is called.
--
-- A drop is already a route whose two endpoints share one address row, carried
-- by a captain rather than a volunteer. That gives it a per-issue delivery, a
-- bundle split and a payout without any new machinery. Two things were missing
-- before it could stand in for the office's driven routes.
--
-- First, the kind. The labels screen sorts by Carrier, Commercial and
-- Residential, where Commercial is a bulk drop at a business and Residential a
-- bulk drop at an apartment or condo (docs/design_decisions.md). A street route
-- is always Carrier, so only a drop carries this.
--
-- Second, the name. The office's own sheet for the driven commercial route
-- keeps a business name against 297 of its stops, and the printed label shows
-- it where a street route shows the volunteer's name. Nullable, because their
-- other driven route records an address and nothing else.
--
-- Both fields are confined to drops by a constraint rather than by convention,
-- so a street route cannot acquire a kind by a stray write.

create type drop_kind as enum ('commercial', 'residential');

alter table volunteer_routes add column drop_kind drop_kind;
alter table volunteer_routes add column drop_name text;

-- Every existing drop becomes Commercial. It is where the office's records
-- start from, and the apartment and condo drops are told apart by hand later;
-- guessing per row would bury a wrong answer in a record nobody re-reads.
update volunteer_routes
  set drop_kind = 'commercial'
  where start_address_id = end_address_id;

alter table volunteer_routes add constraint volunteer_routes_drop_fields_only_on_drops
  check (start_address_id = end_address_id or (drop_kind is null and drop_name is null));

alter table volunteer_routes add constraint volunteer_routes_drop_name_not_blank
  check (drop_name is null or btrim(drop_name) <> '');

comment on column volunteer_routes.drop_kind is
  'Commercial or residential, for a drop only. Null on a street route, which is '
  'always Carrier on the labels screen.';
comment on column volunteer_routes.drop_name is
  'What a drop is called, such as the business at the address. Printed on the '
  'label where a street route prints the volunteer name.';
