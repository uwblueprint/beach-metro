-- Beach Metro — sample seed (build plan Phase 2).
-- Fixed UUIDs so the curl smoke script and integration tests can reference rows
-- deterministically. Admin users are NOT seeded here — create them via
-- `pnpm tsx scripts/create-admin.ts <email> <password>` (Supabase Auth, service role).
--
-- Contents: 3 captains (one zero-rate) + their territories, 5 volunteers (one on
-- vacation, one retired, one unassigned), 8 routes (assigned / vacant / suspended-
-- by-vacation / soft-deleted), 1 commercial drop, 1 financial year. Issues are NOT
-- seeded — create them through the API so the auto-population logic is exercised.

-- Google Maps rows (fake but shaped like real data; place_ids are seed-stable).
insert into google_maps_locations (id, cached_latitude, cached_longitude, cached_formatted_address, cached_at, street_number, street_name, locality, sublocality, administrative_area, postal_code, country_code, location_type) values
  ('seed-place-vol-1',  43.6689, -79.3157, '12 Willow Ave, Toronto, ON M4E 3K1, Canada',      now(), '12',  'Willow Ave',    'Toronto', 'The Beaches', 'ON', 'M4E 3K1', 'CA', 'ROOFTOP'),
  ('seed-place-vol-2',  43.6712, -79.3021, '48 Beech Ave, Toronto, ON M4E 3H6, Canada',       now(), '48',  'Beech Ave',     'Toronto', 'The Beaches', 'ON', 'M4E 3H6', 'CA', 'ROOFTOP'),
  ('seed-place-vol-3',  43.6733, -79.3102, '155 Lee Ave, Toronto, ON M4E 2P2, Canada',        now(), '155', 'Lee Ave',       'Toronto', 'The Beaches', 'ON', 'M4E 2P2', 'CA', 'ROOFTOP'),
  ('seed-place-vol-4',  43.6664, -79.3204, '9 Kenilworth Ave, Toronto, ON M4L 3S4, Canada',   now(), '9',   'Kenilworth Ave','Toronto', 'The Beaches', 'ON', 'M4L 3S4', 'CA', 'ROOFTOP'),
  ('seed-place-vol-5',  43.6795, -79.2955, '221 Blantyre Ave, Toronto, ON M1N 2S6, Canada',   now(), '221', 'Blantyre Ave',  'Toronto', 'Birch Cliff', 'ON', 'M1N 2S6', 'CA', 'ROOFTOP'),
  ('seed-place-rt-1s',  43.6701, -79.3120, 'Queen St E & Willow Ave, Toronto, ON, Canada',    now(), null,  'Queen St E',    'Toronto', 'The Beaches', 'ON', null,      'CA', 'RANGE_INTERPOLATED'),
  ('seed-place-rt-1e',  43.6705, -79.3080, 'Queen St E & Beech Ave, Toronto, ON, Canada',     now(), null,  'Queen St E',    'Toronto', 'The Beaches', 'ON', null,      'CA', 'RANGE_INTERPOLATED'),
  ('seed-place-rt-2s',  43.6720, -79.3150, 'Kingston Rd & Lee Ave, Toronto, ON, Canada',      now(), null,  'Kingston Rd',   'Toronto', 'The Beaches', 'ON', null,      'CA', 'RANGE_INTERPOLATED'),
  ('seed-place-rt-2e',  43.6728, -79.3110, 'Kingston Rd & Glen Manor Dr, Toronto, ON, Canada',now(), null,  'Kingston Rd',   'Toronto', 'The Beaches', 'ON', null,      'CA', 'RANGE_INTERPOLATED'),
  ('seed-place-drop-1', 43.6710, -79.3011, '2075 Queen St E, Toronto, ON M4L 1J1, Canada',    now(), '2075','Queen St E',    'Toronto', 'The Beaches', 'ON', 'M4L 1J1', 'CA', 'ROOFTOP'),
  ('seed-place-drop-2', 43.6688, -79.2966, '1974 Queen St E, Toronto, ON M4L 1H8, Canada',    now(), '1974','Queen St E',    'Toronto', 'The Beaches', 'ON', 'M4L 1H8', 'CA', 'ROOFTOP');

-- Territories first (captain FK attached after captains insert).
insert into captain_territories (id, assigned_captain_id, color) values
  ('a0000000-0000-4000-8000-000000000001', null, '#e11d48'),
  ('a0000000-0000-4000-8000-000000000002', null, '#2563eb'),
  ('a0000000-0000-4000-8000-000000000003', null, '#16a34a');

insert into captains (id, first_name, last_name, email, phone, pay_type, pay_rate, pay_cadence, start_date, end_date, retired_at) values
  ('c0000000-0000-4000-8000-000000000001', 'Emily',  'Chen',     'emily.chen@example.com',  '416-555-0101', 'bundle', 1.25, 'monthly',    '2023-11-20', null, null),
  ('c0000000-0000-4000-8000-000000000002', 'Oliver', 'Martinez', 'oliver.m@example.com',    '416-555-0102', 'drop',   2.00, 'biweekly', '2024-08-30', null, null),
  ('c0000000-0000-4000-8000-000000000003', 'Maya',   'Singh',    'maya.singh@example.com',  '416-555-0103', 'paper',  0.00, 'monthly',   '2024-07-27', null, null);

update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000001';
update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000002' where id = 'a0000000-0000-4000-8000-000000000002';
update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000003' where id = 'a0000000-0000-4000-8000-000000000003';

-- Volunteer home addresses.
insert into addresses (id, google_maps_id, type, territory_id) values
  ('b0000000-0000-4000-8000-000000000001', 'seed-place-vol-1', 'residential', null),
  ('b0000000-0000-4000-8000-000000000002', 'seed-place-vol-2', 'residential', null),
  ('b0000000-0000-4000-8000-000000000003', 'seed-place-vol-3', 'residential', null),
  ('b0000000-0000-4000-8000-000000000004', 'seed-place-vol-4', 'residential', null),
  ('b0000000-0000-4000-8000-000000000005', 'seed-place-vol-5', 'residential', null),
  -- Route endpoint addresses (intersections).
  ('b0000000-0000-4000-8000-000000000011', 'seed-place-rt-1s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000012', 'seed-place-rt-1e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000013', 'seed-place-rt-2s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000014', 'seed-place-rt-2e', 'residential', null),
  -- One commercial drop in Emily's territory, with a standing bundle count, plus
  -- one with an UNKNOWN count so the panel's empty state is exercised too.
  ('b0000000-0000-4000-8000-000000000021', 'seed-place-drop-1', 'commercial', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000022', 'seed-place-drop-2', 'commercial', 'a0000000-0000-4000-8000-000000000001');

-- Standing bundle counts: one known, one deliberately left null (unknown).
update addresses set standing_bundles = 4 where id = 'b0000000-0000-4000-8000-000000000021';

insert into volunteers (id, first_name, last_name, email, phone, address_id, captain_territory_id, start_date, end_date, vacation_start, vacation_end, retired_at) values
  -- Active, assigned to Emily's territory, carries route 1.
  ('d0000000-0000-4000-8000-000000000001', 'Marcus', 'Smart',    'marcus.smart@example.com', '416-555-0201', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2020-06-03', null, null, null, null),
  -- Active, Oliver's territory, carries route 2.
  ('d0000000-0000-4000-8000-000000000002', 'Sofia',  'Gomez',    'sofia.gomez@example.com',  '416-555-0202', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '2024-03-03', null, null, null, null),
  -- ON VACATION (window straddles today): their route 3 is suspended (derived).
  ('d0000000-0000-4000-8000-000000000003', 'Aisha',  'Patel',    'aisha.patel@example.com',  '416-555-0203', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', '2024-01-10', null, (current_date - 7), (current_date + 7), null),
  -- RETIRED (soft): no routes.
  ('d0000000-0000-4000-8000-000000000004', 'Chloe',  'Wilson',   'chloe.wilson@example.com', '416-555-0204', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', '2024-09-14', '2025-12-31', null, null, '2026-01-15'),
  -- Active but UNASSIGNED (no captain/territory) and end date passed -> needs attention.
  ('d0000000-0000-4000-8000-000000000005', 'Liam',   'O''Sullivan', 'liam.os@example.com',   '416-555-0205', 'b0000000-0000-4000-8000-000000000005', null, '2024-02-22', (current_date - 30), null, null, null);

insert into volunteer_routes (id, start_address_id, end_address_id, street_name, side, assigned_volunteer_id, house_count, house_count_override, papers, notes, deleted_at) values
  -- Assigned to Marcus (Emily's territory via Marcus).
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000012', 'Queen St E',  'NORTH', 'd0000000-0000-4000-8000-000000000001', 62, null, 70,  null, null),
  -- Assigned to Sofia (Oliver's territory via Sofia).
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000014', 'Kingston Rd', 'SOUTH', 'd0000000-0000-4000-8000-000000000002', 55, null, 55,  null, null),
  -- Assigned to Aisha, who is on vacation -> derived "suspended".
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000014', 'Lee Ave',     'EAST',  'd0000000-0000-4000-8000-000000000003', 40, null, 40,  null, null),
  -- Vacant (no volunteer).
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000013', 'Beech Ave',   'WEST',  null,                                     48, null, 50,  'Longtime carrier moved away', null),
  -- Vacant, BOTH sides.
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000013', 'Willow Ave',  'BOTH',  null,                                     130, null, 130, null, null),
  -- Assigned to Marcus (second route).
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000014', 'Glen Manor Dr','NORTH','d0000000-0000-4000-8000-000000000001', 25, null, 25,  null, null),
  -- Vacant with a house-count override on file.
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000012', 'Blantyre Ave','SOUTH', null,                                     0,  35,   35,  'Open Data returned 0; manual count 35', null),
  -- SOFT-DELETED: must be hidden from all views but keep resolving historically.
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000012', 'Balsam Ave',  'NORTH', null,                                     30, null, 30,  null, now());

-- Member notes. Multiple notes on one person, each with its own timestamp, so the
-- side panel has real history to render (and to prove ordering is newest-first).
insert into member_notes (id, volunteer_id, captain_id, text, created_at) values
  ('9a000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', null, 'Away — back next week', (current_date - 7)),
  ('9a000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', null, 'Prefers morning deliveries', '2024-03-15 12:00:00-04'),
  ('9a000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', null, 'End date passed; retire or extend?', (current_date - 30)),
  ('9a000000-0000-4000-8000-000000000004', null, 'c0000000-0000-4000-8000-000000000002', 'Prefers Tuesday pickups', '2024-08-30 12:00:00-04'),
  ('9a000000-0000-4000-8000-000000000005', null, 'c0000000-0000-4000-8000-000000000003', 'Declines reimbursement (donate-back)', '2024-07-27 12:00:00-04');

insert into financial_years (id, name, archived, start_date) values
  ('f0000000-0000-4000-8000-000000000001', '2026–2027', false, '2026-03-01');

-- ---------------------------------------------------------------------------
-- Issues, delivery actuals and payout cells.
--
-- Previously the seed stopped at the financial year, on the grounds that issues
-- should be created through the API so the auto-population logic gets exercised.
-- That left the finances grid and the overview chart rendering empty on a fresh
-- database, which made both screens impossible to check by looking at them.
--
-- These rows mirror exactly what POST /api/financial-years/{id}/issues would
-- produce, then add the delivery actuals the office would type in afterwards.
-- Amounts below are the real output of the payout formula for these inputs, not
-- decoration: scripts verify them against a live recalculate, so if the maths
-- ever changes the seed fails rather than quietly lying.
--
-- Rollup for reference: delivery -> route -> volunteer -> territory -> captain.
--   route 1 (70p) + route 6 (25p) are Marcus's  -> Emily's territory
--   route 2 (55p)                 is Sofia's    -> Oliver's territory
--   route 3 is Aisha's, who is on vacation, so it is never carried (no rows)
--   Maya has no volunteers, so her cells are always zero
-- Emily is paid per bundle at $1.25, Oliver per drop at $2.00, Maya per paper at $0.
-- ---------------------------------------------------------------------------

insert into issues (id, financial_year_id, name, date, status) values
  ('11000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Issue 01, March 10th', '2026-03-10', 'closed'),
  ('11000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Issue 02, April 7th',  '2026-04-07', 'closed'),
  ('11000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'Issue 03, May 5th',    '2026-05-05', 'open'),
  ('11000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'Issue 04, June 2nd',   '2026-06-02', 'open');

-- Delivery actuals. `bundles` is the greedy split of paper_count (50s, then 25s,
-- then the remainder), which is what the auto-calc seeds and the office edits.
insert into route_deliveries (issue_id, route_id, paper_count, bundles, drop_count, missed_count) values
  -- I01: a clean run.
  ('11000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 70, '[{"papers":50},{"papers":20}]', 1, 0),
  ('11000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 55, '[{"papers":50},{"papers":5}]',  1, 0),
  ('11000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 25, '[{"papers":25}]',               1, 0),
  -- I02: heavier run, and one missed bundle on route 1 so the deduction is visible.
  ('11000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 80, '[{"papers":50},{"papers":25},{"papers":5}]', 1, 1),
  ('11000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 60, '[{"papers":50},{"papers":10}]', 1, 0),
  ('11000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000006', 30, '[{"papers":25},{"papers":5}]',  1, 0),
  -- I03: same shape as I01; this issue is LOCKED (every cell frozen).
  ('11000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 70, '[{"papers":50},{"papers":20}]', 1, 0),
  ('11000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', 55, '[{"papers":50},{"papers":5}]',  1, 0),
  ('11000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000006', 25, '[{"papers":25}]',               1, 0),
  -- I04: the live one, still tracking the formula.
  ('11000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 90, '[{"papers":50},{"papers":25},{"papers":15}]', 1, 0),
  ('11000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 40, '[{"papers":25},{"papers":15}]', 1, 0),
  ('11000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000006', 50, '[{"papers":50}]',               1, 0);

-- Payout cells: one per captain per issue, exactly as issue creation makes them.
-- Between them they cover every state the finances grid can render: paid, unpaid,
-- frozen (locked), overridden with a reason, substituted, and commented.
insert into captain_payouts
  (issue_id, captain_id, calculated_amount, override_amount, override_reason, frozen_amount, frozen_at, substitute_captain_id, comment, paid, paid_at) values
  -- I01 closed, everyone paid. Emily: (2+1) bundles x $1.25. Oliver: 1 drop x $2.
  ('11000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 3.75, null, null, null, null, null, null, true,  '2026-03-14'),
  ('11000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 2.00, null, null, null, null, null, null, true,  '2026-03-14'),
  ('11000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 0.00, null, null, null, null, null, null, true,  '2026-03-14'),
  -- I02 closed, only Emily paid. Emily: route 1 is 3 bundles less 1 missed = 2,
  -- plus route 6's 2 bundles, so 4 x $1.25.
  ('11000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 5.00, null, null, null, null, null, null, true,  '2026-04-11'),
  ('11000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 2.00, null, null, null, null, null, null, false, null),
  ('11000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 0.00, null, null, null, null, null, null, false, null),
  -- I03 open but LOCKED: every cell frozen, so route edits no longer move them.
  ('11000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 3.75, null, null, 3.75, '2026-05-09', null, null, false, null),
  ('11000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 2.00, null, null, 2.00, '2026-05-09', null, null, false, null),
  ('11000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 0.00, null, null, 0.00, '2026-05-09', null, null, false, null),
  -- I04 open and live. Emily: (3+1) bundles x $1.25. Oliver is overridden with a
  -- reason. Maya was covered by Emily and carries a standalone comment.
  ('11000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 5.00, null, null, null, null, null, null, false, null),
  ('11000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 2.00, 12.50, 'Invoiced separately for the school run', null, null, null, null, false, null),
  ('11000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 0.00, null, null, null, null, 'c0000000-0000-4000-8000-000000000001', 'Captain switching to monthly', false, null);
