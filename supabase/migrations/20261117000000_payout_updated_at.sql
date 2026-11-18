-- When a payout cell last changed, shown on the cell in the finances grid. A
-- change is anything stored on the row: the calculated amount, an override, a
-- freeze, a substitute, the comment or the paid mark.
--
-- A trigger stamps it because many paths write to this table, the live
-- recalculation and every cell action among them, and a column each writer had
-- to remember would drift. An update that changes nothing leaves it alone.
--
-- Existing rows take the time this runs, the earliest moment they are known to
-- hold their current values.

alter table captain_payouts add column updated_at timestamptz not null default now();

create or replace function stamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger captain_payouts_stamp_updated_at
  before update on captain_payouts
  for each row
  when (old is distinct from new)
  execute function stamp_updated_at();
