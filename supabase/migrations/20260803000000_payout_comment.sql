-- A standalone comment on a payout cell, separate from the override reason.
--
-- PENDING(Q4). The finances design has two distinct things on a cell:
--   * the reason you type when you change an amount (already modelled as
--     captain_payouts.override_reason, required whenever an override is set)
--   * a free-standing comment like "Captain switching to monthly", which is not
--     attached to changing the number at all and reads more like a sticky note
--
-- Only the first existed. This adds the second rather than overloading
-- override_reason, because a comment has to survive on a cell that was never
-- overridden, and clearing an override must not silently delete a note the
-- office left for themselves.
--
-- If design confirms these are really one thing (Q4 answer b), drop this column
-- and point the UI's comment field at override_reason instead. See
-- docs/finances_pending_decisions.md.

alter table captain_payouts
  add column comment text check (comment is null or length(btrim(comment)) > 0);

comment on column captain_payouts.comment is
  'Free-standing note on a cell, independent of override_reason. Null = no comment. '
  'PROVISIONAL: pending design confirmation that this is distinct from the override reason.';
