-- Drops on the routes page are point deliveries assigned to a captain directly
-- (not via a volunteer). Routes keep deriving captain from the carrier.
alter table volunteer_routes
  add column assigned_captain_id uuid references captains (id) on delete set null;

create index routes_captain_idx on volunteer_routes (assigned_captain_id);

alter table volunteer_routes
  add constraint route_carrier_xor check (
    assigned_volunteer_id is null or assigned_captain_id is null
  );
