-- Contact details become optional on volunteers and captains.
--
-- The office's live roster has a phone for 91 of 462 people (19%) and an email
-- for 193 (42%) — see docs/reference/route_labels_spreadsheet.md §2.2. Requiring
-- both means four in five of their existing volunteers cannot be entered at all.
-- Confirmed with the office 2026-08-24: optional for everyone, not just imports.
--
-- Existing rows need no backfill. The columns were NOT NULL and validation
-- required a non-empty trimmed string, so there are no '' values to normalise.

alter table volunteers alter column email drop not null;
alter table volunteers alter column phone drop not null;

alter table captains alter column email drop not null;
alter table captains alter column phone drop not null;
