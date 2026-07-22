-- Beach Metro — sample seed (build plan Phase 2).
-- Fixed UUIDs so the curl smoke script and integration tests can reference rows
-- deterministically. Admin users are NOT seeded here — create them via
-- `pnpm tsx scripts/create-admin.ts <email> <password>` (Supabase Auth, service role).
--
-- Contents: 3 captains (one zero-rate) + their territories, 5 volunteers (one on
-- vacation, one retired, one unassigned), 8 routes (assigned / vacant / suspended-
-- by-vacation / soft-deleted), 1 commercial drop, 1 financial year. Issues are NOT
-- seeded — create them through the API so the auto-population logic is exercised.
--
-- Geography: coordinates are hand-placed in the Beaches so each route is a short,
-- coherent segment ALONG its named street (start and end on the same street, a few
-- hundred metres apart). This is what makes the route lines on the map read as real
-- street segments rather than crossing between shared points. Real addresses added
-- through the app are geocoded live by Google; these are seed-stable stand-ins.

-- Google Maps rows (seed-stable stand-ins for geocoded locations).
insert into google_maps_locations (id, cached_latitude, cached_longitude, cached_formatted_address, cached_at, street_number, street_name, locality, sublocality, administrative_area, postal_code, country_code, location_type) values
  -- Volunteer homes (clustered near their routes in the Beaches).
  ('seed-place-vol-1',  43.6696, -79.2946, '12 Willow Ave, Toronto, ON M4E 3K1, Canada',      now(), '12',  'Willow Ave',    'Toronto', 'The Beaches', 'ON', 'M4E 3K1', 'CA', 'ROOFTOP'),
  ('seed-place-vol-2',  43.6699, -79.2936, '48 Beech Ave, Toronto, ON M4E 3H6, Canada',       now(), '48',  'Beech Ave',     'Toronto', 'The Beaches', 'ON', 'M4E 3H6', 'CA', 'ROOFTOP'),
  ('seed-place-vol-3',  43.6701, -79.2955, '155 Lee Ave, Toronto, ON M4E 2P2, Canada',        now(), '155', 'Lee Ave',       'Toronto', 'The Beaches', 'ON', 'M4E 2P2', 'CA', 'ROOFTOP'),
  ('seed-place-vol-4',  43.6690, -79.2915, '9 Kenilworth Ave, Toronto, ON M4L 3S4, Canada',   now(), '9',   'Kenilworth Ave','Toronto', 'The Beaches', 'ON', 'M4L 3S4', 'CA', 'ROOFTOP'),
  ('seed-place-vol-5',  43.6815, -79.2790, '221 Blantyre Ave, Toronto, ON M1N 2S6, Canada',   now(), '221', 'Blantyre Ave',  'Toronto', 'Birch Cliff', 'ON', 'M1N 2S6', 'CA', 'ROOFTOP'),
  -- Route endpoints: each route's start (…s) and end (…e), both on the same street.
  ('seed-rt1s', 43.6683, -79.2975, 'Queen St E & Woodbine Ave, Toronto, ON, Canada',   now(), null, 'Queen St E',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt1e', 43.6690, -79.2905, 'Queen St E & Kenilworth Ave, Toronto, ON, Canada', now(), null, 'Queen St E',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt2s', 43.6802, -79.2905, 'Kingston Rd & Bingham Ave, Toronto, ON, Canada',   now(), null, 'Kingston Rd',   'Toronto', 'Birch Cliff', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt2e', 43.6828, -79.2852, 'Kingston Rd & Victoria Park Ave, Toronto, ON, Canada', now(), null, 'Kingston Rd', 'Toronto', 'Birch Cliff', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt3s', 43.6668, -79.2958, 'Lee Ave & Queen St E, Toronto, ON, Canada',        now(), null, 'Lee Ave',       'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt3e', 43.6712, -79.2953, 'Lee Ave & Gerrard St E, Toronto, ON, Canada',      now(), null, 'Lee Ave',       'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt4s', 43.6668, -79.2938, 'Beech Ave & Queen St E, Toronto, ON, Canada',      now(), null, 'Beech Ave',     'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt4e', 43.6712, -79.2933, 'Beech Ave & Kingston Rd, Toronto, ON, Canada',     now(), null, 'Beech Ave',     'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt5s', 43.6668, -79.2948, 'Willow Ave & Queen St E, Toronto, ON, Canada',     now(), null, 'Willow Ave',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt5e', 43.6714, -79.2944, 'Willow Ave & Gerrard St E, Toronto, ON, Canada',   now(), null, 'Willow Ave',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt6s', 43.6692, -79.2900, 'Glen Manor Dr & Queen St E, Toronto, ON, Canada',  now(), null, 'Glen Manor Dr', 'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt6e', 43.6742, -79.2896, 'Glen Manor Dr W & Kingston Rd, Toronto, ON, Canada', now(), null, 'Glen Manor Dr','Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt7s', 43.6800, -79.2792, 'Blantyre Ave & Kingston Rd, Toronto, ON, Canada',  now(), null, 'Blantyre Ave',  'Toronto', 'Birch Cliff', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt7e', 43.6842, -79.2788, 'Blantyre Ave & Gerrard St E, Toronto, ON, Canada', now(), null, 'Blantyre Ave',  'Toronto', 'Birch Cliff', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt8s', 43.6668, -79.2925, 'Balsam Ave & Queen St E, Toronto, ON, Canada',     now(), null, 'Balsam Ave',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  ('seed-rt8e', 43.6712, -79.2921, 'Balsam Ave & Kingston Rd, Toronto, ON, Canada',    now(), null, 'Balsam Ave',    'Toronto', 'The Beaches', 'ON', null, 'CA', 'RANGE_INTERPOLATED'),
  -- Commercial drop.
  ('seed-place-drop-1', 43.6688, -79.2895, '2075 Queen St E, Toronto, ON M4L 1J1, Canada', now(), '2075','Queen St E','Toronto', 'The Beaches', 'ON', 'M4L 1J1', 'CA', 'ROOFTOP');

-- Territories first (captain FK attached after captains insert).
insert into captain_territories (id, assigned_captain_id, color) values
  ('a0000000-0000-4000-8000-000000000001', null, '#e11d48'),
  ('a0000000-0000-4000-8000-000000000002', null, '#2563eb'),
  ('a0000000-0000-4000-8000-000000000003', null, '#16a34a');

insert into captains (id, first_name, last_name, email, phone, pay_type, pay_rate, pay_cadence, start_date, end_date, retired_at, notes) values
  ('c0000000-0000-4000-8000-000000000001', 'Emily',  'Chen',     'emily.chen@example.com',  '416-555-0101', 'bundle', 1.25, 'weekly',   '2023-11-20', null, null, null),
  ('c0000000-0000-4000-8000-000000000002', 'Oliver', 'Martinez', 'oliver.m@example.com',    '416-555-0102', 'drop',   2.00, 'biweekly', '2024-08-30', null, null, 'Prefers Tuesday pickups'),
  ('c0000000-0000-4000-8000-000000000003', 'Maya',   'Singh',    'maya.singh@example.com',  '416-555-0103', 'paper',  0.00, 'weekly',   '2024-07-27', null, null, 'Declines reimbursement (donate-back)');

update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000001';
update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000002' where id = 'a0000000-0000-4000-8000-000000000002';
update captain_territories set assigned_captain_id = 'c0000000-0000-4000-8000-000000000003' where id = 'a0000000-0000-4000-8000-000000000003';

-- Volunteer home + route-endpoint + commercial-drop addresses.
insert into addresses (id, google_maps_id, type, territory_id) values
  ('b0000000-0000-4000-8000-000000000001', 'seed-place-vol-1', 'residential', null),
  ('b0000000-0000-4000-8000-000000000002', 'seed-place-vol-2', 'residential', null),
  ('b0000000-0000-4000-8000-000000000003', 'seed-place-vol-3', 'residential', null),
  ('b0000000-0000-4000-8000-000000000004', 'seed-place-vol-4', 'residential', null),
  ('b0000000-0000-4000-8000-000000000005', 'seed-place-vol-5', 'residential', null),
  -- Route endpoints (start/end per route, distinct so lines don't cross).
  ('b0000000-0000-4000-8000-000000000101', 'seed-rt1s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000102', 'seed-rt1e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000103', 'seed-rt2s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000104', 'seed-rt2e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000105', 'seed-rt3s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000106', 'seed-rt3e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000107', 'seed-rt4s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000108', 'seed-rt4e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000109', 'seed-rt5s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000110', 'seed-rt5e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000111', 'seed-rt6s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000112', 'seed-rt6e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000113', 'seed-rt7s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000114', 'seed-rt7e', 'residential', null),
  ('b0000000-0000-4000-8000-000000000115', 'seed-rt8s', 'residential', null),
  ('b0000000-0000-4000-8000-000000000116', 'seed-rt8e', 'residential', null),
  -- One commercial drop in Emily's territory.
  ('b0000000-0000-4000-8000-000000000021', 'seed-place-drop-1', 'commercial', 'a0000000-0000-4000-8000-000000000001');

insert into volunteers (id, first_name, last_name, email, phone, address_id, captain_territory_id, start_date, end_date, vacation_start, vacation_end, retired_at, notes) values
  -- Active, assigned to Emily's territory, carries route 1.
  ('d0000000-0000-4000-8000-000000000001', 'Marcus', 'Smart',    'marcus.smart@example.com', '416-555-0201', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2020-06-03', null, null, null, null, null),
  -- Active, Oliver's territory, carries route 2.
  ('d0000000-0000-4000-8000-000000000002', 'Sofia',  'Gomez',    'sofia.gomez@example.com',  '416-555-0202', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '2024-03-03', null, null, null, null, null),
  -- ON VACATION (window straddles today): their route 3 is suspended (derived).
  ('d0000000-0000-4000-8000-000000000003', 'Aisha',  'Patel',    'aisha.patel@example.com',  '416-555-0203', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', '2024-01-10', null, (current_date - 7), (current_date + 7), null, 'Away — back next week'),
  -- RETIRED (soft): no routes.
  ('d0000000-0000-4000-8000-000000000004', 'Chloe',  'Wilson',   'chloe.wilson@example.com', '416-555-0204', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', '2024-09-14', '2025-12-31', null, null, '2026-01-15', null),
  -- Active but UNASSIGNED (no captain/territory) and end date passed -> needs attention.
  ('d0000000-0000-4000-8000-000000000005', 'Liam',   'O''Sullivan', 'liam.os@example.com',   '416-555-0205', 'b0000000-0000-4000-8000-000000000005', null, '2024-02-22', (current_date - 30), null, null, null, 'End date passed; retire or extend?');

insert into volunteer_routes (id, start_address_id, end_address_id, street_name, side, assigned_volunteer_id, house_count, house_count_override, papers, notes, deleted_at) values
  -- Assigned to Marcus (Emily's territory via Marcus).
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000102', 'Queen St E',   'NORTH', 'd0000000-0000-4000-8000-000000000001', 62, null, 70,  null, null),
  -- Assigned to Sofia (Oliver's territory via Sofia).
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000104', 'Kingston Rd',  'SOUTH', 'd0000000-0000-4000-8000-000000000002', 55, null, 55,  null, null),
  -- Assigned to Aisha, who is on vacation -> derived "suspended".
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000105', 'b0000000-0000-4000-8000-000000000106', 'Lee Ave',      'EAST',  'd0000000-0000-4000-8000-000000000003', 40, null, 40,  null, null),
  -- Vacant (no volunteer).
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000107', 'b0000000-0000-4000-8000-000000000108', 'Beech Ave',    'WEST',  null,                                     48, null, 50,  'Longtime carrier moved away', null),
  -- Vacant, BOTH sides.
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000109', 'b0000000-0000-4000-8000-000000000110', 'Willow Ave',   'BOTH',  null,                                     130, null, 130, null, null),
  -- Assigned to Marcus (second route).
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000111', 'b0000000-0000-4000-8000-000000000112', 'Glen Manor Dr','NORTH', 'd0000000-0000-4000-8000-000000000001', 25, null, 25,  null, null),
  -- Vacant with a house-count override on file.
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000113', 'b0000000-0000-4000-8000-000000000114', 'Blantyre Ave', 'SOUTH', null,                                     0,  35,   35,  'Open Data returned 0; manual count 35', null),
  -- SOFT-DELETED: must be hidden from all views but keep resolving historically.
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000115', 'b0000000-0000-4000-8000-000000000116', 'Balsam Ave',   'NORTH', null,                                     30, null, 30,  null, now());

insert into financial_years (id, name, archived) values
  ('f0000000-0000-4000-8000-000000000001', '2026–2027', false);
