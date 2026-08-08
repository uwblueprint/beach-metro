-- captain_payouts.comment was added provisionally, pending design confirming that
-- a cell comment is a different thing from an override reason. It is: both show in
-- the cell popover, but a comment is a general heads-up about a payment rather than
-- a justification for changing a number.
--
-- Comment-only change; the column itself is unchanged. Kept as its own migration
-- rather than an edit to 20260803000000, which has already been applied.

comment on column captain_payouts.comment is
  'Free-standing note on a cell, independent of override_reason. Null = no comment. '
  'A general heads-up about the payment, not a justification for changing an amount.';
