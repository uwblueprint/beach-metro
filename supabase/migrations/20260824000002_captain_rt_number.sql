-- The RT number: the code printed largest on every label.
--
-- It is a designation carried by the captain, not by a territory or a route.
-- When one captain absorbs another's area the absorbed number retires, which is
-- why the office's sheet runs 01, 02, 03, 04, 06, 07 … with gaps at 05, 11, 13,
-- 16, 19, 21 and 27-29. See docs/reference/route_labels_spreadsheet.md §7.
--
-- Text, not an integer: the office's live values include '01' (the leading zero
-- is printed) and '31-71' for a captain covering a span of driven routes.
--
-- Nullable, because a captain can exist before they are given a number — their
-- labels print RTXX until one is set, which is the pre-existing behaviour.

alter table captains add column rt_number text;

alter table captains add constraint captains_rt_number_not_blank
  check (rt_number is null or btrim(rt_number) <> '');

-- One captain per number, so a label's RT is never ambiguous. Partial, since any
-- number of captains may be waiting for one.
create unique index captains_rt_number_key
  on captains (rt_number)
  where rt_number is not null;

comment on column captains.rt_number is
  'Territory code printed on the label chip as RT<value>. Belongs to the captain: '
  'absorbing another captain''s area retires the absorbed number.';
