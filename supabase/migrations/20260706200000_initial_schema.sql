-- Beach Metro — initial schema.
-- Mirrors docs/schema/data_model.md exactly: UUID PKs (except google_maps_locations,
-- keyed by Google place_id), one-to-many FKs on the child side, derived fields NOT
-- stored (volunteer status, route lifecycle/suspended, bundleCount, payout
-- calculation status), soft delete only on volunteer_routes.
--
-- Auth note: admin users live in Supabase Auth (auth.users); there is no
-- public.admin_users table (data model flags AdminUser as handled by Supabase Auth).

-- ---------------------------------------------------------------------------
-- Enums (match the status/value unions in the data model)
-- ---------------------------------------------------------------------------

create type route_side as enum ('NORTH', 'SOUTH', 'EAST', 'WEST', 'BOTH');
create type pay_type as enum ('bundle', 'paper', 'drop');
create type pay_cadence as enum ('weekly', 'biweekly'); -- informational; no disbursement aggregation
create type issue_status as enum ('open', 'closed');    -- no draft (locked decision)
create type address_type as enum ('residential', 'commercial');
create type location_type as enum ('ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE');

-- ---------------------------------------------------------------------------
-- External / Google shapes
-- ---------------------------------------------------------------------------

-- Cached geocoding result. id is the Google place_id (storable indefinitely per
-- Google ToS); cached_* lat/lng fields are a 30-day TTL cache (research doc §1.3).
create table google_maps_locations (
  id text primary key,
  cached_latitude double precision,
  cached_longitude double precision,
  cached_formatted_address text,
  cached_at timestamptz,
  street_number text,
  street_name text,
  locality text,
  sublocality text,
  administrative_area text,
  postal_code text,
  country_code text,
  location_type location_type
);

-- ---------------------------------------------------------------------------
-- People domain
-- ---------------------------------------------------------------------------

-- Captain's territory; 1:1 with a captain via assigned_captain_id (nullable during
-- handoffs). Volunteers and commercial drops attach via inverse FKs.
create table captain_territories (
  id uuid primary key default gen_random_uuid(),
  assigned_captain_id uuid unique, -- FK added below once captains exists
  color text
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  google_maps_id text not null references google_maps_locations (id),
  type address_type not null,
  -- Commercial drops belong to one territory; only set when type = 'commercial'.
  territory_id uuid references captain_territories (id) on delete set null,
  constraint commercial_only_territory check (type = 'commercial' or territory_id is null)
);

create table captains (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  -- Pay config lives on the captain (not the route/territory).
  pay_type pay_type not null,
  pay_rate numeric(10, 2) not null check (pay_rate >= 0), -- 0 valid (donate-back)
  pay_cadence pay_cadence not null,
  start_date date not null,
  end_date date,
  retired_at date, -- status Active/Retired is derived from this
  notes text
);

alter table captain_territories
  add constraint captain_territories_assigned_captain_fk
  foreign key (assigned_captain_id) references captains (id) on delete set null;

create table volunteers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  address_id uuid not null references addresses (id),
  captain_territory_id uuid references captain_territories (id) on delete set null,
  start_date date not null,
  end_date date, -- planning flag only; passing it never auto-retires
  -- Vacation window: the one date-driven automation (suspends routes, auto-resumes).
  vacation_start date,
  vacation_end date,
  retired_at date, -- soft retire; status is derived
  notes text,
  constraint vacation_window_pair check ((vacation_start is null) = (vacation_end is null)),
  constraint vacation_window_order check (vacation_start is null or vacation_start <= vacation_end)
);

-- ---------------------------------------------------------------------------
-- Routes domain
-- ---------------------------------------------------------------------------

create table volunteer_routes (
  id uuid primary key default gen_random_uuid(),
  start_address_id uuid not null references addresses (id),
  end_address_id uuid not null references addresses (id),
  street_name text not null,
  side route_side,
  -- Optional: a vacant route has no volunteer. Lifecycle is derived from this.
  assigned_volunteer_id uuid references volunteers (id) on delete set null,
  house_count integer not null check (house_count >= 0), -- manual entry for MVP
  house_count_override integer check (house_count_override >= 0), -- only relevant once auto-calc exists
  papers integer not null check (papers >= 0), -- standing paper count
  notes text,
  -- Soft delete: hidden from all views, row retained so past route_deliveries resolve.
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Finance domain
-- ---------------------------------------------------------------------------

create table financial_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- e.g. "2026–2027" (runs ~March–Feb)
  archived boolean not null default false
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  financial_year_id uuid not null references financial_years (id) on delete cascade,
  name text not null, -- manual label, e.g. "June 9" or "I01-26"
  date date not null, -- manual
  status issue_status not null default 'open' -- created Open; close/reopen via actions
);

-- One cell per captain per issue. Effective amount = override_amount ?? calculated_amount,
-- frozen when the issue closes. paid locks the cell from edits.
create table captain_payouts (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id) on delete cascade,
  captain_id uuid not null references captains (id),
  calculated_amount numeric(10, 2) not null default 0,
  override_amount numeric(10, 2),
  override_reason text, -- required when overridden; no prior-value audit
  paid boolean not null default false,
  paid_at date,
  unique (issue_id, captain_id),
  constraint override_requires_reason check (override_amount is null or override_reason is not null)
);

-- ---------------------------------------------------------------------------
-- Delivery domain
-- ---------------------------------------------------------------------------

-- One record per route per issue; actuals only (no stored planned baseline).
-- bundles is the embedded per-bundle breakdown (source of truth); bundle count is
-- DERIVED (jsonb_array_length(bundles)) and never stored separately.
create table route_deliveries (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id) on delete cascade,
  route_id uuid not null references volunteer_routes (id),
  paper_count integer not null check (paper_count >= 0),
  bundles jsonb not null default '[]'::jsonb, -- [{ "papers": 50 }, ...]; sum must equal paper_count
  drop_count integer not null default 0 check (drop_count >= 0),
  missed_count integer not null default 0 check (missed_count >= 0), -- unit matches captain pay type
  unique (issue_id, route_id)
);

-- Invariant (data model): sum(bundles[].papers) === paper_count, every element a
-- positive integer. Enforced here as defense-in-depth; the service layer validates
-- first and returns 422.
create or replace function validate_route_delivery_bundles()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if jsonb_typeof(new.bundles) is distinct from 'array' then
    raise exception 'bundles must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.bundles) as b
    where jsonb_typeof(b) is distinct from 'object'
       or jsonb_typeof(b -> 'papers') is distinct from 'number'
       or (b ->> 'papers')::numeric <> floor((b ->> 'papers')::numeric)
       or (b ->> 'papers')::numeric <= 0
  ) then
    raise exception 'each bundle must be an object with a positive integer "papers"';
  end if;

  select coalesce(sum((b ->> 'papers')::integer), 0)
  into total
  from jsonb_array_elements(new.bundles) as b;

  if total <> new.paper_count then
    raise exception 'bundles must sum to paper_count (bundles sum %, paper_count %)', total, new.paper_count;
  end if;

  return new;
end;
$$;

create trigger route_deliveries_validate_bundles
  before insert or update on route_deliveries
  for each row
  execute function validate_route_delivery_bundles();

-- ---------------------------------------------------------------------------
-- Indexes (FK lookups + the hot filters from the API spec)
-- ---------------------------------------------------------------------------

create index volunteers_territory_idx on volunteers (captain_territory_id);
create index volunteers_retired_idx on volunteers (retired_at);
create index addresses_territory_idx on addresses (territory_id);
create index addresses_gml_idx on addresses (google_maps_id);
create index routes_volunteer_idx on volunteer_routes (assigned_volunteer_id);
create index routes_not_deleted_idx on volunteer_routes (deleted_at) where deleted_at is null;
create index issues_year_idx on issues (financial_year_id);
create index payouts_issue_idx on captain_payouts (issue_id);
create index payouts_captain_idx on captain_payouts (captain_id);
create index deliveries_issue_idx on route_deliveries (issue_id);
create index deliveries_route_idx on route_deliveries (route_id);

-- ---------------------------------------------------------------------------
-- RLS: lock every table. No policies on purpose — the browser never touches these;
-- all access goes through server-side route handlers using the service-role key,
-- which bypasses RLS (infra spec: RLS as defense-in-depth only).
-- ---------------------------------------------------------------------------

alter table google_maps_locations enable row level security;
alter table captain_territories enable row level security;
alter table addresses enable row level security;
alter table captains enable row level security;
alter table volunteers enable row level security;
alter table volunteer_routes enable row level security;
alter table financial_years enable row level security;
alter table issues enable row level security;
alter table captain_payouts enable row level security;
alter table route_deliveries enable row level security;
