// Dummy member data for the members table (40 volunteers + 10 captains).
// Entity shapes follow docs/schema/data_model.md. Replace with the real data
// layer (Supabase) once it exists.

type UUID = string;
type DateOnly = string; // YYYY-MM-DD
type Email = string;
type Phone = string;

export type PayType = "bundle" | "paper" | "drop";
export type PayCadence = "weekly" | "biweekly";

export interface Volunteer {
  id: UUID;
  firstName: string;
  lastName: string;
  email: Email;
  phone: Phone;
  addressId: UUID;
  notes?: string | null;
  captainTerritoryId?: UUID | null;
  startDate: DateOnly;
  endDate?: DateOnly | null;
  vacationStart?: DateOnly | null;
  vacationEnd?: DateOnly | null;
  retiredAt?: DateOnly | null;
}

export interface Captain {
  id: UUID;
  firstName: string;
  lastName: string;
  email: Email;
  phone: Phone;
  payType: PayType;
  payRate: number;
  payCadence: PayCadence;
  startDate: DateOnly;
  endDate?: DateOnly | null;
  retiredAt?: DateOnly | null;
  notes?: string | null;
}

/** Flattened display shape consumed by the members table. */
export type MemberRole = "volunteer" | "captain";

export interface MemberRow {
  id: UUID;
  name: string;
  /** Route summary ("Queen St E · Woodbine → Coxwell", "2 Routes") or territory for captains. */
  routeInfo: string;
  /** Assigned captain (volunteers) or the captain themselves. */
  captainName: string;
  /** Preformatted display date, e.g. "Jun. 3, 2020". */
  startDate: string;
  role: MemberRole;
}

const fakeUuid = (group: number, n: number): UUID =>
  `00000000-0000-4000-8000-${group}${String(n).padStart(11, "0")}`;

const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];

function formatDate(iso: DateOnly): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function contact(first: string, last: string): { email: Email; phone: Phone } {
  const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
  return { email: `${slug}@example.com`, phone: "416-555-0100" };
}

// [firstName, lastName, payType, payRate, payCadence, startDate]
const captainSeeds: [string, string, PayType, number, PayCadence, DateOnly][] = [
  ["Walter", "Wren", "bundle", 12.5, "biweekly", "2018-04-02"],
  ["Raj", "Patel", "paper", 0.15, "biweekly", "2019-06-17"],
  ["Lena", "Morales", "drop", 22, "weekly", "2020-02-10"],
  ["Emily", "Chen", "bundle", 11, "biweekly", "2020-09-01"],
  ["Marcus", "Bell", "paper", 0.12, "weekly", "2021-03-22"],
  ["Priya", "Raman", "bundle", 13, "biweekly", "2021-11-08"],
  ["Diego", "Alvarez", "drop", 20, "weekly", "2022-05-16"],
  ["Hannah", "Fox", "paper", 0.18, "biweekly", "2023-01-30"],
  ["Tom", "Okafor", "bundle", 12, "weekly", "2023-08-14"],
  ["Grace", "Liu", "drop", 25, "biweekly", "2024-02-05"],
];

// [firstName, lastName, routes, captainIndex (into captainSeeds), startDate]
const volunteerSeeds: [string, string, string[], number, DateOnly][] = [
  ["Ajayveer", "Sandhu", ["Queen St E · Woodbine → Coxwell"], 0, "2020-06-03"],
  ["Marcus", "Smart", ["Queen St E · Coxwell → Greenwood"], 0, "2020-06-03"],
  [
    "Steven",
    "Gerrard",
    ["Kingston Rd · Victoria Park → Warden", "Blantyre Ave · Kingston → Gerrard"],
    2,
    "2021-01-12",
  ],
  ["Nadia", "Haddad", ["Gerrard St E · Main → Victoria Park"], 1, "2022-03-15"],
  ["Emma", "Clarke", ["Woodbine Ave · Danforth → Gerrard"], 3, "2023-11-20"],
  ["Marcus", "Lee", ["Bloor St W · Dufferin → Lansdowne"], 1, "2023-12-05"],
  ["Aisha", "Patel", ["King St W · Spadina → Bathurst"], 0, "2024-01-10"],
  ["Liam", "O'Sullivan", ["Danforth Ave · Donlands → Greenwood"], 0, "2024-02-22"],
  ["Sofia", "Gomez", ["College St · Ossington → Dovercourt"], 0, "2024-03-03"],
  ["Noah", "Kim", ["Yonge St · Eglinton → Lawrence"], 0, "2024-04-15"],
  ["Isabella", "Rossi", ["Queen St W · Bathurst → Dufferin"], 1, "2024-05-09"],
  ["Ethan", "Brown", ["St. Clair Ave W · Oakwood → Christie"], 1, "2024-06-18"],
  ["Maya", "Singh", ["Front St E · Jarvis → Parliament"], 1, "2024-07-27"],
  ["Oliver", "Martinez", ["Dundas St W · Lansdowne → Keele"], 2, "2024-08-30"],
  ["Chloe", "Wilson", ["King St E · Broadview → Pape"], 2, "2024-09-14"],
  ["Jack", "Nguyen", ["Spadina Ave · Queen → King"], 2, "2024-10-07"],
  ["Amara", "Johnson", ["Bathurst St · Dupont → Bloor"], 2, "2024-11-12"],
  ["Lucas", "Thompson", ["Roncesvalles Ave · Dundas → Queen"], 3, "2024-12-01"],
  ["Fatima", "Ali", ["Queen St E · Beech → Neville Park"], 3, "2025-01-06"],
  ["Henry", "Adams", ["Lee Ave · Queen → Kingston"], 3, "2025-01-20"],
  ["Zoe", "Baker", ["Waverley Rd · Queen → Kingston"], 4, "2025-02-03"],
  ["Daniel", "Cohen", ["Glen Manor Dr · Queen → Kingston"], 4, "2025-02-17"],
  ["Ivy", "Zhang", ["Balsam Ave · Queen → Pine Cres"], 4, "2025-03-02"],
  ["Omar", "Farouk", ["Silver Birch Ave · Queen → Kingston"], 4, "2025-03-16"],
  ["Ruby", "Doyle", ["Scarborough Rd · Gerrard → Kingston"], 5, "2025-03-30"],
  ["Felix", "Wagner", ["Fallingbrook Rd · Kingston → Queen"], 5, "2025-04-12"],
  ["Nina", "Petrov", ["Courcelette Rd · Kingston → Gerrard"], 5, "2025-04-26"],
  [
    "Sam",
    "Whitfield",
    ["Main St · Danforth → Gerrard", "Stephenson Ave · Main → Barrington"],
    5,
    "2025-05-10",
  ],
  ["Layla", "Hassan", ["Victoria Park Ave · Kingston → Danforth"], 6, "2025-05-24"],
  ["Theo", "Marchetti", ["Beech Ave · Queen → Kingston"], 6, "2025-06-07"],
  ["Priya", "Nair", ["Willow Ave · Queen → Kingston"], 6, "2025-06-21"],
  ["Caleb", "Fisher", ["Kenilworth Ave · Queen → Kingston"], 6, "2025-07-05"],
  ["Alice", "Moreau", ["Wineva Ave · Queen → Kingston"], 7, "2025-07-19"],
  ["Jonas", "Berg", ["Hammersmith Ave · Queen → Kingston"], 7, "2025-08-02"],
  ["Mei", "Tanaka", ["Bellefair Ave · Queen → Kingston"], 7, "2025-08-16"],
  ["Arjun", "Mehta", ["Wheeler Ave · Queen → Kingston"], 8, "2025-08-30"],
  ["Sadie", "Kowalski", ["Elmer Ave · Queen → Kingston"], 8, "2025-09-13"],
  ["Leo", "Fontaine", ["Waverley Rd · Kingston → Danforth"], 8, "2025-09-27"],
  ["Hana", "Yusuf", ["Kippendavie Ave · Queen → Eastern"], 9, "2025-10-11"],
  ["George", "Papadopoulos", ["Woodward Ave · Queen → Kingston"], 9, "2025-10-25"],
];

const territoryId = (captainIndex: number): UUID => fakeUuid(3, captainIndex);

export const captains: Captain[] = captainSeeds.map(
  ([firstName, lastName, payType, payRate, payCadence, startDate], i) => ({
    id: fakeUuid(1, i),
    firstName,
    lastName,
    ...contact(firstName, lastName),
    payType,
    payRate,
    payCadence,
    startDate,
  }),
);

export const volunteers: Volunteer[] = volunteerSeeds.map(
  ([firstName, lastName, , captainIndex, startDate], i) => ({
    id: fakeUuid(2, i),
    firstName,
    lastName,
    ...contact(firstName, lastName),
    addressId: fakeUuid(4, i),
    captainTerritoryId: territoryId(captainIndex),
    startDate,
  }),
);

// Routes aren't stored on the volunteer (see VolunteerRoute in the data model),
// so keep the display strings alongside the seeds.
const routesByVolunteerId = new Map<UUID, string[]>(
  volunteerSeeds.map(([, , routes], i) => [fakeUuid(2, i), routes]),
);

const captainNameByTerritoryId = new Map<UUID, string>(
  captainSeeds.map(([firstName, lastName], i) => [territoryId(i), `${firstName} ${lastName}`]),
);

const volunteerRows: { sortKey: DateOnly; row: MemberRow }[] = volunteers.map((v) => {
  const routes = routesByVolunteerId.get(v.id) ?? [];
  return {
    sortKey: v.startDate,
    row: {
      id: v.id,
      name: `${v.firstName} ${v.lastName}`,
      routeInfo: routes.length === 1 ? routes[0] : `${routes.length} Routes`,
      captainName: v.captainTerritoryId
        ? (captainNameByTerritoryId.get(v.captainTerritoryId) ?? "—")
        : "—",
      startDate: formatDate(v.startDate),
      role: "volunteer" as const,
    },
  };
});

const captainRows: { sortKey: DateOnly; row: MemberRow }[] = captains.map((c, i) => ({
  sortKey: c.startDate,
  row: {
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    routeInfo: `Territory ${i + 1}`,
    captainName: `${c.firstName} ${c.lastName}`,
    startDate: formatDate(c.startDate),
    role: "captain" as const,
  },
}));

export const memberRows: MemberRow[] = [...volunteerRows, ...captainRows]
  .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  .map((entry) => entry.row);
