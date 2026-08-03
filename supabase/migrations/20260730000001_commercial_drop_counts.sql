-- Standing bundle count for a commercial drop.
--
-- The member side panel's Territory Drops section shows a bundle count per drop.
-- Nothing modelled it: routes carry a standing `papers` count but commercial
-- drops carried nothing, which docs/open_items.md tracked as an open question
-- ("Commercial-drop standing counts").
--
-- NOT YET CONFIRMED WITH THE CLIENT. Built as the smallest correctable guess:
--   * nullable, so "nobody has told us" stays distinguishable from "zero", and
--     the UI can render an empty state rather than a misleading 0
--   * on addresses rather than a new table, because a drop IS an address; if
--     drops ever need per-issue actuals that becomes a delivery-style table
--     instead, and this column retires
--
-- The panel also wants a DATE per drop. There is deliberately no column for it:
-- a commercial drop is an address, not an event, so a date would have to come
-- from per-issue drop deliveries, which do not exist. See open_items.md.

alter table addresses
  add column standing_bundles integer
    check (standing_bundles is null or standing_bundles >= 0);

comment on column addresses.standing_bundles is
  'Expected bundles per issue for a commercial drop. Null = unknown. Residential '
  'addresses leave this null. Provisional: pending client confirmation.';
