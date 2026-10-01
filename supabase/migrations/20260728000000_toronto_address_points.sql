-- Toronto Open Data address points — the reference set behind the suggested
-- house count (docs/open_items.md "House-count auto-calculation").
--
-- Reference data only: loaded by `pnpm load-addresses`
-- (scripts/load-toronto-addresses.ts) and never written to by the app. Dropping
-- and reloading the whole table is the supported refresh path.
--
-- Contains information licensed under the Open Government Licence – Toronto.
-- Source: City of Toronto, "Address Points (Municipal) – Toronto One Address
-- Repository", dataset abedd8bc-e3dd-4d45-8e69-79165a76e4fa.

create table toronto_address_points (
  address_point_id bigint primary key,          -- ADDRESS_POINT_ID (source PK)
  centreline_id    bigint,                      -- CENTRELINE_ID (street segment)
  centreline_side  text,                        -- CENTRELINE_SIDE: 'L' | 'R'
  -- ADDRESS_NUMBER is text in the source ('2962B', '107A'), so the numeric
  -- range key is LO_NUM; address_number is kept for display/audit only.
  address_number   text not null,
  street_number    integer not null,            -- LO_NUM
  linear_name_full text not null,               -- 'Queen St E' (already abbreviated)
  address_full     text not null,               -- '2 Wineva Ave'
  latitude         double precision not null,
  longitude        double precision not null,
  -- Match key against volunteer_routes.street_name. Toronto is already
  -- canonically abbreviated, so lowercasing is enough on this side; the app
  -- normalizer (lib/services/house-count.ts) expands 'Avenue' -> 'ave' so the
  -- two meet in the middle.
  linear_name_norm text generated always as (lower(btrim(linear_name_full))) stored
);

-- text_pattern_ops so the prefix match ('glen manor dr%', which must also catch
-- 'Glen Manor Dr W') can use the index despite the database's non-C collation.
create index toronto_ap_name_idx
  on toronto_address_points (linear_name_norm text_pattern_ops);

-- Deliberately omitted: CENTRELINE_MEASURE (resets per segment, and a route
-- spans several, so it can't order addresses along a route) and GENERAL_USE
-- (deprecated upstream in 2021 — reads 'Unknown' on effectively every row).

alter table toronto_address_points enable row level security;

-- New public tables are not reachable through the Data API roles without an
-- explicit grant (see supabase/config.toml `auto_expose_new_tables`). The
-- service-role client reads this table via PostgREST, so grant it read access.
grant select on table toronto_address_points to service_role;
