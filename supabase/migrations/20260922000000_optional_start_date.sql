-- Start date becomes optional on volunteers and captains.
--
-- The office's live roster carries one for 203 of 468 rows (43%) — see
-- docs/reference/route_labels_spreadsheet.md §2.2. It is missing in two
-- predictable places: people who joined before the office began recording it
-- (85 of the 203 dates fall in 2023-2026, and years before 2020 hold a handful
-- each), and rows that are not a person at all, where 64% of individuals carry
-- one against 13% of churches, buildings and businesses.
--
-- Nothing derives from it. Status comes from retired_at and the vacation window,
-- needs-attention comes from end_date, and no payout calculation reads it; the
-- member side panel displays it and nothing else. Requiring it blocked 265 rows
-- for a field that only renders as text.
--
-- Existing rows need no backfill. The column was NOT NULL, so there are no
-- placeholder dates to clean up.

alter table volunteers alter column start_date drop not null;
alter table captains alter column start_date drop not null;
