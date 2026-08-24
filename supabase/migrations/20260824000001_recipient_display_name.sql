-- A third of the office's roster is not one person.
--
-- 122 of 462 rows on their LABELS sheet are organizations ("St. Aidan's Church",
-- "Henley Gardens IDA Pharmacy"), 40 are several people sharing one delivery
-- ("Liz Nadeau/Rich Eaton"), and 9 are a single word with no surname. Forcing
-- those into first_name + last_name mangles them, and a household that shares a
-- route is one delivery, not two volunteers.
-- See docs/reference/route_labels_spreadsheet.md §2.1.
--
-- So display_name becomes the authoritative name: it is what prints on a label,
-- what the lists show, and what search matches. first_name / last_name stay for
-- the individuals who have them, because surname sort and structured search are
-- worth keeping — they just stop being mandatory.

alter table volunteers add column display_name text;
alter table captains add column display_name text;

-- Backfill is exact: both columns were NOT NULL and validation required a
-- non-empty trimmed string, so no row can produce a blank display_name.
update volunteers set display_name = btrim(first_name || ' ' || last_name);
update captains set display_name = btrim(first_name || ' ' || last_name);

alter table volunteers alter column display_name set not null;
alter table captains alter column display_name set not null;

alter table volunteers add constraint volunteers_display_name_not_blank
  check (btrim(display_name) <> '');
alter table captains add constraint captains_display_name_not_blank
  check (btrim(display_name) <> '');

alter table volunteers alter column first_name drop not null;
alter table volunteers alter column last_name drop not null;
alter table captains alter column first_name drop not null;
alter table captains alter column last_name drop not null;

comment on column volunteers.display_name is
  'Authoritative name: what prints on a label and what search matches. '
  'first_name / last_name are populated only when the recipient is one person.';
comment on column captains.display_name is
  'Authoritative name: what prints on a label and what search matches. '
  'first_name / last_name are populated only when the recipient is one person.';
