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
  ('seed-place-drop-1', 43.6710, -79.3011, '2075 Queen St E, Toronto, ON M4L 1J1, Canada',    now(), '2075','Queen St E',    'Toronto', 'The Beaches', 'ON', 'M4L 1J1', 'CA', 'ROOFTOP');

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

insert into financial_years (id, name, archived) values
  ('f0000000-0000-4000-8000-000000000001', '2026–2027', false);
