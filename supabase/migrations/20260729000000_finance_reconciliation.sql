-- Reconciliation with the design review and the client meetings (July 2026).
-- Four changes, each superseding an earlier locked decision. See
-- docs/design_decisions.md for the reasoning and what they replace.

-- ---------------------------------------------------------------------------
-- 1. Pay cadence: weekly|biweekly -> biweekly|monthly.
--    The original enum guessed wrong; the client confirmed captains are paid
--    biweekly or monthly, and nobody is on a weekly cadence. Postgres cannot
--    drop an enum value in place, so swap the type and remap existing rows.
-- ---------------------------------------------------------------------------
create type pay_cadence_new as enum ('biweekly', 'monthly');

alter table captains
  alter column pay_cadence type pay_cadence_new
  using (case when pay_cadence::text = 'weekly' then 'biweekly' else pay_cadence::text end)::pay_cadence_new;

drop type pay_cadence;
alter type pay_cadence_new rename to pay_cadence;

-- ---------------------------------------------------------------------------
-- 2. Financial years get an explicit start date.
--    The year runs from whenever the office starts it (not January), and the
--    overview's quarter filters are relative to that month — Q1 of a year
--    starting in March is Mar-May. Without this the quarters are unknowable.
-- ---------------------------------------------------------------------------
alter table financial_years add column start_date date;

-- Backfill: derive from the leading year in the name ("2026–2027" -> 2026-03-01),
-- falling back to March of the current year. March is the historical start month.
update financial_years
set start_date = make_date(
  coalesce(nullif(substring(name from '^\d{4}'), '')::int, extract(year from current_date)::int),
  3,
  1
)
where start_date is null;

alter table financial_years alter column start_date set not null;

-- ---------------------------------------------------------------------------
-- 3. Substitute captains, per issue.
--    Supersedes the "no captain substitutes, use transfer instead" decision.
--    Transfer moved money between two cells and recorded the reason as free
--    text, which made substitute pay impossible to total or filter on. The
--    substitute is a real captain who covered this issue for this captain, and
--    the payment is theirs — the cell still belongs to the original captain so
--    the (issue, captain) grid stays intact.
-- ---------------------------------------------------------------------------
alter table captain_payouts
  add column substitute_captain_id uuid references captains (id),
  add constraint substitute_is_not_self check (substitute_captain_id is null or substitute_captain_id <> captain_id);

create index payouts_substitute_idx on captain_payouts (substitute_captain_id);

-- ---------------------------------------------------------------------------
-- 4. Freeze, separate from paid.
--    Bundling day locks a captain's calculated amount so later route or carrier
--    edits can't move it, but that is NOT the same as having paid them. A null
--    frozen_amount means the payout still tracks the live calculation.
--    Precedence is override -> frozen -> calculated (lib/services/derive.ts).
-- ---------------------------------------------------------------------------
alter table captain_payouts
  add column frozen_amount numeric(10, 2) check (frozen_amount is null or frozen_amount >= 0),
  add column frozen_at date,
  add constraint frozen_amount_requires_date check ((frozen_amount is null) = (frozen_at is null));
