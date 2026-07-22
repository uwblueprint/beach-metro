// Database row shapes (snake_case), mirroring supabase/migrations exactly.
// Replaced by generated types (`pnpm db:types` → types/database.ts) once the
// schema is pushed; services cast PostgREST results to these at the boundary.

export type RouteSide = "NORTH" | "SOUTH" | "EAST" | "WEST" | "BOTH";
export type PayType = "bundle" | "paper" | "drop";
export type PayCadence = "weekly" | "biweekly";
export type IssueStatus = "open" | "closed";
export type AddressType = "residential" | "commercial";
export type LocationType = "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE";

export interface GoogleMapsLocationRow {
  id: string; // Google place_id
  cached_latitude: number | null;
  cached_longitude: number | null;
  cached_formatted_address: string | null;
  cached_at: string | null;
  street_number: string | null;
  street_name: string | null;
  locality: string | null;
  sublocality: string | null;
  administrative_area: string | null;
  postal_code: string | null;
  country_code: string | null;
  location_type: LocationType | null;
}

export interface CaptainTerritoryRow {
  id: string;
  assigned_captain_id: string | null;
  color: string | null;
}

export interface AddressRow {
  id: string;
  google_maps_id: string;
  type: AddressType;
  territory_id: string | null;
}

export interface CaptainRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  pay_type: PayType;
  pay_rate: number;
  pay_cadence: PayCadence;
  start_date: string;
  end_date: string | null;
  retired_at: string | null;
  notes: string | null;
}

export interface VolunteerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_id: string;
  captain_territory_id: string | null;
  start_date: string;
  end_date: string | null;
  vacation_start: string | null;
  vacation_end: string | null;
  retired_at: string | null;
  notes: string | null;
}

export interface VolunteerRouteRow {
  id: string;
  start_address_id: string;
  end_address_id: string;
  street_name: string;
  side: RouteSide | null;
  assigned_volunteer_id: string | null;
  house_count: number;
  house_count_override: number | null;
  papers: number;
  notes: string | null;
  deleted_at: string | null;
}

export interface FinancialYearRow {
  id: string;
  name: string;
  archived: boolean;
}

export interface IssueRow {
  id: string;
  financial_year_id: string;
  name: string;
  date: string;
  status: IssueStatus;
}

export interface CaptainPayoutRow {
  id: string;
  issue_id: string;
  captain_id: string;
  calculated_amount: number;
  override_amount: number | null;
  override_reason: string | null;
  paid: boolean;
  paid_at: string | null;
}

export interface RouteBundle {
  papers: number;
}

export interface RouteDeliveryRow {
  id: string;
  issue_id: string;
  route_id: string;
  paper_count: number;
  bundles: RouteBundle[];
  drop_count: number;
  missed_count: number;
}
