# Google Maps Platform Research

**Context:** what the Beach Metro app can pull from Google Maps, what we are allowed to keep, what the responses look like, what it will cost, and how this shapes our `GoogleMapsLocation` schema.

**As of:** June 2026. Google Maps pricing and product structure shifted significantly in March 2025 (per-SKU free tier replaced the old universal $200 credit), and the legacy Places, Directions, and Distance Matrix APIs are being phased out in favour of the "New" Places API and Routes API. Anything in this doc that touches pricing or product status should be verified against [the official pricing page](https://mapsplatform.google.com/pricing/) before launch.

**How to read this doc:** [Section 1](#1-beach-metro-integration-decisions) records the integration **decisions** we are making for Beach Metro. Everything after it is **research** — facts about the platform as documented by Google, with sources linked in-text where each claim is made.

---

## 1. Beach Metro integration decisions

### 1.1 Strategy in one line

Keep everything inside the free tiers: geocode the ~200 routes/addresses once, store the durable `place_id`, and refresh the cached lat/lng on a ~30-day cycle to satisfy the caching policy. Addresses change rarely, so steady-state API volume is tiny.

### 1.2 APIs we use

- **Geocoding API** turns a volunteer address into a `place_id` plus latitude and longitude. This is the primary integration. ([Section 2](#2-research-geocoding-api))
- **Address Validation API** standardizes and corrects user-entered Canadian addresses at signup. Optional but useful. ([Section 3](#3-research-address-validation-api))
- **Maps JavaScript API** renders the interactive map of territories and routes (the nice-to-have feature replacing Melinda's three colour-coded Google MyMaps). ([Section 4](#4-research-maps-javascript-api))
- **Maps Static API** can render small thumbnail maps cheaply (for example, a preview on a volunteer's profile). ([Section 5](#5-research-maps-static-api-and-routes-api))
- **Routes API: Compute Route Matrix** is the right tool for the "recommend nearby vacant routes by proximity to volunteer home" feature. ([Section 5.2](#52-routes-api-compute-route-matrix))
- We almost certainly do **not** need the [Places API](https://developers.google.com/maps/documentation/places/web-service/op-overview) (Search/Details/Autocomplete) because we are not letting users look up businesses or POIs. The exception is if we use Places Autocomplete in address input fields, which has its own session billing model.

| Beach Metro feature                                                     | API to use                                    | Notes                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Convert volunteer address to coordinates for map display                | Geocoding API                                 | Store the returned `place_id`; re-resolve coordinates on demand or cache up to 30 days |
| Validate and standardize a Canadian address at signup                   | Address Validation API                        | Returns formatted postal address, granularity, and a geocode in one call               |
| Render interactive map with territories, routes, vacant routes          | Maps JavaScript API                           | Polygons for territories, polylines for route segments, markers for endpoints          |
| Render small static map (e.g. profile thumbnail or printable run sheet) | Maps Static API                               | Cheaper per call than dynamic maps                                                     |
| Recommend the closest vacant routes to a new volunteer                  | Routes API: Compute Route Matrix              | One call returns N origins by M destinations of duration/distance                      |
| Autocomplete address typing in forms (nice-to-have)                     | Places Autocomplete (New)                     | Session-based billing; pairs with Place Details or Address Validation                  |
| Drag-and-drop route editing on the map                                  | Custom polygon editing on Maps JavaScript API | The bundled Drawing Library is deprecated; see [1.6](#16-map-rendering-and-editing)    |

What we are **not** using:

- Directions API and Distance Matrix API (legacy as of March 2025; replaced by Routes API).
- Roads API (snap-to-road etc. is unnecessary; our routes are street segments described by intersections).
- Street View, Aerial View, Elevation, Pollen, Weather, Solar APIs.

### 1.3 Data retention: `place_id` is durable, lat/lng is a 30-day cache

The single most important non-obvious constraint. From the [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms):

> Customer may temporarily cache latitude and longitude values from the Geocoding API for up to 30 consecutive calendar days, after which Customer must delete the cached latitude and longitude values.

And from the [Geocoding API policies page](https://developers.google.com/maps/documentation/geocoding/policies):

> Note that the place ID, used to uniquely identify a place, is exempt from the caching restrictions. You can therefore store place ID values indefinitely.

Net effect — our decision: **`place_id` is our durable identifier; lat/lng is a refreshable cache with a 30-day TTL.** A background refresh updates any record older than ~25 days; anything past 30 days must be evicted.

### 1.4 Our `GoogleMapsLocation` shape

The shape in [`docs/schema/data_model.md`](../schema/data_model.md), driven by the retention rule above:

```ts
export interface GoogleMapsLocation {
  // The Google Place ID. Storable indefinitely per Google ToS.
  // This is our durable foreign-key target from Address.googleMapsId.
  id: string;
  // Short-term cache fields. Must be refreshed within 30 days of fetch.
  // Treat them as nullable and re-resolve via the Geocoding API when stale or missing.
  cachedLatitude?: number | null;
  cachedLongitude?: number | null;
  cachedFormattedAddress?: string | null;
  cachedAt?: Timestamp | null; // when these cache fields were last fetched
  // Optional structured fields we extract from address_components at fetch time.
  // These are derived and similarly refreshable, but practically very stable.
  streetNumber?: string | null;
  streetName?: string | null; // the "route" component
  locality?: string | null; // city
  sublocality?: string | null; // neighbourhood
  administrativeArea?: string | null; // province
  postalCode?: string | null;
  countryCode?: string | null;
  // Confidence indicator from geometry.location_type.
  // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
  locationType?:
    | "ROOFTOP"
    | "RANGE_INTERPOLATED"
    | "GEOMETRIC_CENTER"
    | "APPROXIMATE"
    | null;
}
```

Notes on this shape:

- The `id` field is the Google `place_id` string (something like `ChIJRxcAvRO7j4AR6hm6tys8yA8`), not a UUID we generate. This is a deliberate departure from our usual UUID convention because the place_id is Google's identifier and we want to use it directly as the join key.
- All the `cached*` fields are denormalized for query speed and to avoid hitting the API for every map render.
- The structured address components (`streetNumber`, `streetName`, etc.) are extracted at the time of geocoding so we can query and display them without re-parsing the `address_components[]` array.
- `locationType` lets the UI flag low-confidence geocodes so an admin can review.

**Knock-on effect on `Address`:** `Address.googleMapsId` is typed as `GoogleMapsLocation["id"]`. With the shape above that resolves to `string` (a Google place_id), which is exactly what we want. No change required to `Address`.

One potential future enhancement: pull `Address.type` (residential vs commercial) from `AddressValidation.metadata.residential` at validation time, rather than asking the user to pick it (see [3.3](#33-what-we-get-that-geocoding-alone-does-not)).

### 1.5 Address entry and validation at volunteer signup

1. User types address into the form (optionally with Places Autocomplete suggestions to reduce typos).
2. On submit, call Address Validation ([Section 3](#3-research-address-validation-api)).
3. If `verdict.addressComplete === true` and no replaced or unconfirmed components, save the `place_id`, the canonical `formattedAddress` for short-term cache (refreshed at most every 30 days), and `metadata.residential` into our `Address` record.
4. If validation flags inferred or replaced components, present the corrected version to the user for confirmation before saving.

### 1.6 Map rendering and editing

- Render maps with the **Maps JavaScript API**, loaded via the [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/) wrapper rather than hand-rolling the script loader.
- MVP map features are **read-only display** (territory polygons, route polylines, markers), which is unaffected by the Drawing Library deprecation.
- If we ever build drag-and-drop route/territory editing, plan to integrate **Terra Draw** rather than `google.maps.drawing` (deprecated; see [4.2](#42-drawing-libraries)).

### 1.7 Proximity recommendations

Use **Compute Route Matrix** ([Section 5.2](#52-routes-api-compute-route-matrix)) for "closest vacant routes to this volunteer": one origin (the volunteer's home), N destinations (vacant route endpoints), sort by `duration` or `distanceMeters`, and present the top few. `travelMode: "DRIVE"` matches how the captains and most volunteers get around.

### 1.8 API keys and cost guardrails

All API keys are restricted both by referrer (frontend keys, restricted to our domain) and by enabled API (backend keys, restricted to only the APIs we actually use), per [Google's API security best practices](https://developers.google.com/maps/api-security-best-practices). Quotas are also capped per-day in the Cloud Console to prevent runaway billing from key leakage. Keys live server-side; the app proxies Google calls through our own API (see the API spec §6).

### 1.9 Expected cost: $0/month at our volume

Back-of-envelope against the pricing facts in [Section 6](#6-research-pricing). Assume ~200 volunteers, 4 captains, monthly turnover of a handful of people, daily admin use of the map by Melinda and Hope:

- Geocoding: maybe 50 calls/month (new signups, address edits). Free tier easily.
- Address Validation: similar. Within free or just over.
- Maps JS dynamic map loads: assume Melinda and Hope each load the map page 5x/day, plus volunteers/captains view it a few times per cycle. Order of 500 to 2,000 loads/month. Free tier easily.
- Compute Route Matrix: only triggered when assigning vacant routes, maybe 20 per month. Free tier easily.
- Static Maps: if used on run sheets, scale with number of issues per month. Probably a few hundred per month. Free tier easily.

Expected monthly cost: **\$0** under expected volume, assuming we keep field masks tight and do not request expensive Places SKUs. This is the whole strategy: the data set is ~200 addresses that rarely change, so a one-time geocode plus a ~30-day refresh cycle stays comfortably inside every free tier.

**Subscriptions:** there are now Essentials/Pro/Enterprise [subscription plans](https://developers.google.com/maps/billing-and-pricing/overview) that bundle predictable monthly call counts at a fixed price, sitting alongside pay-as-you-go. Almost certainly not worth it for Beach Metro at the volumes above; pay-as-you-go with free tiers will be cheaper and simpler. Worth revisiting only if the app ever scales beyond the current operation.

---

## 2. Research: Geocoding API

Primary API used by the application. Converts a free-text address into a structured response containing the canonical address, latitude and longitude, a `place_id`, and a confidence indicator.

**Reference:** [Geocoding API request and response](https://developers.google.com/maps/documentation/geocoding/requests-geocoding)

### 2.1 Request

```
GET https://maps.googleapis.com/maps/api/geocode/json
  ?address=24+Sussex+Drive+Ottawa+ON
  &components=country:CA
  &key=YOUR_API_KEY
```

Required: `key`, plus either `address` or `components` (or both). Useful optional parameters:

- `components=country:CA` restricts results to Canada. Strongly recommended for Beach Metro.
- `bounds` biases (does not restrict) results to a viewport; useful for "prefer addresses near Beach Metro's coverage area."
- `region=ca` is a softer bias.
- `language=en` for English-language results.

There is also a newer **Geocoding API v4** with a slightly different shape (uses `X-Goog-FieldMask` headers and `https://geocode.googleapis.com/v4/...`). The v3 endpoint above is still fully supported and is the one almost all documentation and examples use; v4 is opt-in.

### 2.2 Response (v3, JSON)

```json
{
  "results": [
    {
      "address_components": [
        {
          "long_name": "1600",
          "short_name": "1600",
          "types": ["street_number"]
        },
        {
          "long_name": "Amphitheatre Parkway",
          "short_name": "Amphitheatre Pkwy",
          "types": ["route"]
        },
        {
          "long_name": "Mountain View",
          "short_name": "Mountain View",
          "types": ["locality", "political"]
        },
        {
          "long_name": "Santa Clara County",
          "short_name": "Santa Clara County",
          "types": ["administrative_area_level_2", "political"]
        },
        {
          "long_name": "California",
          "short_name": "CA",
          "types": ["administrative_area_level_1", "political"]
        },
        {
          "long_name": "United States",
          "short_name": "US",
          "types": ["country", "political"]
        },
        {
          "long_name": "94043",
          "short_name": "94043",
          "types": ["postal_code"]
        }
      ],
      "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "geometry": {
        "location": { "lat": 37.4222804, "lng": -122.0843428 },
        "location_type": "ROOFTOP",
        "viewport": {
          "northeast": { "lat": 37.4237349802915, "lng": -122.083183169709 },
          "southwest": { "lat": 37.4210370197085, "lng": -122.085881130292 }
        }
      },
      "place_id": "ChIJRxcAvRO7j4AR6hm6tys8yA8",
      "plus_code": {
        "compound_code": "CWC8+W7 Mountain View, CA",
        "global_code": "849VCWC8+W7"
      },
      "types": ["street_address"]
    }
  ],
  "status": "OK"
}
```

### 2.3 Field-by-field, what we can derive and use

| Field                           | What it is                                                                | Useful to Beach Metro for                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `place_id`                      | Stable, opaque, globally unique identifier for the location               | **The only field we are allowed to store indefinitely.** Use this as the `id` on our `GoogleMapsLocation` table ([1.4](#14-our-googlemapslocation-shape)).                                                                       |
| `formatted_address`             | Postal-style human-readable address                                       | Display on volunteer profile, printable run sheets. **Subject to caching restrictions: not storable beyond 30 days.**                                                                                                            |
| `address_components[]`          | Structured pieces with `types[]` tags                                     | Pulling out street number, street name, postal code, locality (city), administrative_area_level_1 (province). For route definitions, the `route` component is the street name.                                                   |
| `geometry.location.lat` / `lng` | Decimal degrees, WGS84                                                    | Map pin placement, distance computations. **Cache for up to 30 days only.**                                                                                                                                                      |
| `geometry.location_type`        | One of `ROOFTOP`, `RANGE_INTERPOLATED`, `GEOMETRIC_CENTER`, `APPROXIMATE` | Confidence indicator. `ROOFTOP` means precise rooftop coordinate; `RANGE_INTERPOLATED` means interpolated between two precise points (acceptable for routes but flag it); `APPROXIMATE` should probably trigger a manual review. |
| `geometry.viewport`             | Bounding box suggested for displaying this result                         | Use directly when zooming the map to a single result.                                                                                                                                                                            |
| `geometry.bounds`               | Optional full bounding box                                                | Present when result is a region (street segment, neighbourhood). For route endpoint intersections we will usually only see `viewport`.                                                                                           |
| `plus_code`                     | Open Location Code (e.g. `849VCWC8+W7`)                                   | Useful in rural areas where addresses are unreliable; probably irrelevant for Beach Metro's urban coverage.                                                                                                                      |
| `partial_match: true`           | Set when the geocoder fuzzy-matched                                       | Treat as a warning; flag to an admin for manual review.                                                                                                                                                                          |
| `types[]`                       | Categorization of the result                                              | `street_address`, `route`, `intersection`, `premise`, `subpremise`, `locality`, etc. For Beach Metro, route start/end points should be `intersection` results when possible.                                                     |

### 2.4 `address_components[]` types worth pulling out

The full reference is at [Address types and address component types](https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Types). The ones we will care about:

- `street_number`: house number
- `route`: street name
- `intersection`: a major intersection (perfect for route endpoints)
- `subpremise`: apartment, unit, suite
- `locality`: city (Toronto)
- `sublocality_level_1`: neighbourhood (the Beach, East York)
- `administrative_area_level_1`: province (Ontario)
- `postal_code`: full Canadian postal code

### 2.5 Status codes

`status` is one of:

- `OK`: at least one result
- `ZERO_RESULTS`: address could not be matched
- `OVER_QUERY_LIMIT`: over quota
- `OVER_DAILY_LIMIT`: missing or invalid key, billing not enabled, or self-imposed cap exceeded
- `REQUEST_DENIED`, `INVALID_REQUEST`, `UNKNOWN_ERROR`

A non-OK status may also include `error_message` with diagnostic detail.

### 2.6 Reverse geocoding

Same API, different parameter. Pass `latlng=43.6532,-79.3832&key=...` instead of `address=...`. Returns the same response shape but resolving a coordinate to its nearest address. Probably not needed for Beach Metro day-to-day, but useful if we ever let admins drop a pin on the map to define a route endpoint.

**Reference:** [Reverse geocoding request and response](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding)

---

## 3. Research: Address Validation API

A separate, more thorough endpoint than Geocoding. Designed for checkout flows and address-collection forms. Worth using on volunteer signup because Beach Metro's data is collected from many people over time and address typos are common.

**References:** [Address Validation API overview](https://developers.google.com/maps/documentation/address-validation/overview), [validateAddress reference](https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress), [understand the response](https://developers.google.com/maps/documentation/address-validation/understand-response)

### 3.1 Request

```
POST https://addressvalidation.googleapis.com/v1:validateAddress?key=YOUR_API_KEY
Content-Type: application/json

{
  "address": {
    "regionCode": "CA",
    "addressLines": ["1201 Ave Van Horne"],
    "locality": "Outremont",
    "administrativeArea": "QC",
    "postalCode": "H2V 1K4"
  }
}
```

`enableUspsCass` is for US addresses only; do not set it for Canadian addresses.

### 3.2 Response (shape)

```json
{
  "result": {
    "verdict": {
      "inputGranularity": "PREMISE",
      "validationGranularity": "PREMISE",
      "geocodeGranularity": "PREMISE",
      "addressComplete": true,
      "hasInferredComponents": true,
      "hasUnconfirmedComponents": false,
      "hasReplacedComponents": false
    },
    "address": {
      "formattedAddress": "1201 Avenue Van Horne, Outremont, QC H2V 1K4, Canada",
      "postalAddress": {
        "regionCode": "CA",
        "languageCode": "en",
        "postalCode": "H2V 1K4",
        "administrativeArea": "QC",
        "locality": "Outremont",
        "addressLines": ["1201 Avenue Van Horne"]
      },
      "addressComponents": [
        {
          "componentName": { "text": "1201" },
          "componentType": "street_number",
          "confirmationLevel": "CONFIRMED"
        }
      ],
      "missingComponentTypes": [],
      "unconfirmedComponentTypes": []
    },
    "geocode": {
      "location": { "latitude": 45.516, "longitude": -73.6082 },
      "plusCode": { "globalCode": "...", "compoundCode": "..." },
      "bounds": {},
      "placeId": "ChIJ..."
    },
    "metadata": {
      "business": false,
      "poBox": false,
      "residential": true
    }
  },
  "responseId": "..."
}
```

### 3.3 What we get that Geocoding alone does not

- `verdict.addressComplete`: a boolean. Quick yes/no for "is this address good to ship to."
- `verdict.has*Components`: tells us if the API inferred, replaced, or could not confirm parts of the address.
- `metadata.residential` vs `metadata.business` vs `metadata.poBox`: useful for our `Address.type` field (the schema currently has `"residential" | "commercial"`). Verified June 2026: residential/commercial metadata is only populated for six countries — **Canada is one of them** (alongside AU, MX, NZ, ES, US) — so deriving `Address.type` from validation works for our coverage area. Pass `regionCode: "CA"`.
- `geocode.placeId`: same `place_id` you would get from Geocoding. Storable indefinitely.

---

## 4. Research: Maps JavaScript API

The runtime that renders the interactive map. This is what powers the nice-to-have feature of showing territories, routes, and vacant routes on a single colour-coded map (replacing Melinda's three Google MyMaps).

**Reference:** [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)

### 4.1 What it gives us

- Base map tiles (streets, satellite, hybrid) with pan, zoom, and rotation.
- **Markers** for point features (route endpoints, volunteer homes).
- **Polylines** for line features (a route as a street segment) — see [shapes and lines](https://developers.google.com/maps/documentation/javascript/shapes).
- **Polygons** with fill colour and stroke for area features (a captain's territory) — see [drawing on the map](https://developers.google.com/maps/documentation/javascript/overlays).
- **Data layer** for GeoJSON, which is the cleanest way to load and style many features at once — see [the Data layer](https://developers.google.com/maps/documentation/javascript/datalayer).
- Click and hover handlers on every feature, so clicking a route can open a side panel with the assigned volunteer, bundle count, etc.
- A built-in `LatLngBounds` helper to auto-fit the viewport to a set of features.

### 4.2 Drawing libraries

We had originally considered drag-and-drop route editing. Note: **the bundled `google.maps.drawing` Drawing Library was deprecated in August 2025 and is scheduled for removal in May 2026** (per Spatialized's [Drawing Library guide](https://spatialized.io/insights/google-maps/interactivity-and-events/drawing)). For any feature requiring users to draw or edit polygons/polylines on the map directly, the recommended replacement is **Terra Draw**, an open-source library that runs on top of the Maps JS API.

For Beach Metro this matters only if we build drag-and-drop route editing (see [1.6](#16-map-rendering-and-editing)). Read-only display of existing routes is unaffected.

### 4.3 Billing trigger

Each successful map load triggers the **Dynamic Maps** SKU. User interactions (pan, zoom, layer switch) do **not** generate additional map loads. Loading the same page twice does generate two map loads.

---

## 5. Research: Maps Static API and Routes API

### 5.1 Maps Static API

Returns a PNG of a map at the requested centre/zoom/size, with optional markers and paths drawn on it. No JavaScript, no interactivity. Roughly one-third the cost of a Dynamic Maps load.

Useful for:

- Email run sheets with a small thumbnail of the route
- Profile preview thumbnails
- Anywhere we want a map image and do not need pan/zoom

**Reference:** [Maps Static API](https://developers.google.com/maps/documentation/maps-static)

### 5.2 Routes API: Compute Route Matrix

The proximity-recommendation feature wants something like: "given this new volunteer's home address, what are the closest vacant routes?" That is a many-to-many problem (one origin, N possible destinations) that Compute Route Matrix solves in one call.

**Reference:** [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix)

#### Request shape (REST)

```
POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix
X-Goog-Api-Key: YOUR_API_KEY
X-Goog-FieldMask: originIndex,destinationIndex,duration,distanceMeters,status,condition
Content-Type: application/json

{
  "origins": [
    { "waypoint": { "location": { "latLng": { "latitude": 43.66, "longitude": -79.30 } } } }
  ],
  "destinations": [
    { "waypoint": { "location": { "latLng": { "latitude": 43.67, "longitude": -79.29 } } } },
    { "waypoint": { "location": { "latLng": { "latitude": 43.68, "longitude": -79.31 } } } }
  ],
  "travelMode": "DRIVE"
}
```

The field mask is **required**; you have to opt in to every field you want back, which keeps both latency and cost down (see [choose fields](https://developers.google.com/maps/documentation/routes/choose_fields)).

#### Response (one element per origin-destination pair)

```json
[
  {
    "originIndex": 0,
    "destinationIndex": 0,
    "status": { "code": 0 },
    "condition": "ROUTE_EXISTS",
    "distanceMeters": 1200,
    "duration": "240s"
  },
  {
    "originIndex": 0,
    "destinationIndex": 1,
    "status": { "code": 0 },
    "condition": "ROUTE_EXISTS",
    "distanceMeters": 3400,
    "duration": "560s"
  }
]
```

`travelMode` can be `DRIVE`, `WALK`, `BICYCLE`, or `TRANSIT`. Request limits: the number of origins times the number of destinations cannot exceed 625 in a single call when using address or place ID waypoints. For Beach Metro that ceiling is comfortably high.

---

## 6. Research: Pricing

**Caveat:** Google's pricing structure changed substantially in March 2025 and continues to evolve. Treat the numbers below as ballpark. Always re-check at [https://mapsplatform.google.com/pricing/](https://mapsplatform.google.com/pricing/) before any go-live decision. (Useful third-party breakdowns: [MapAtlas](https://mapatlas.eu/blog/google-maps-api-pricing-2026), [Nicola Lazzari](https://nicolalazzari.ai/articles/understanding-google-maps-apis-a-comprehensive-guide-to-uses-and-costs), [Woosmap](https://www.woosmap.com/blog/google-maps-api-pricing-breakdown), [Coordable](https://coordable.co/provider/google-maps-geocoding-api/).)

### 6.1 How billing works in 2026

Per the [pricing overview](https://developers.google.com/maps/billing-and-pricing/overview) and the [March 2025 changes FAQ](https://developers.google.com/maps/billing-and-pricing/faq):

- Pricing is per-SKU; each API call maps to one or more SKUs.
- Each SKU has its own per-month free tier (no longer pooled across SKUs as it was under the old $200 credit model).
- SKUs are grouped into tiers:
  - **Essentials**: 10,000 free events/month per SKU
  - **Pro**: 5,000 free events/month per SKU
  - **Enterprise**: 1,000 free events/month per SKU
- Above the free tier, per-1000-event prices step down by volume.
- Maps Embed API and Maps SDKs for Android and iOS are completely free with unlimited usage.

### 6.2 SKUs relevant to Beach Metro (USD, per 1,000 billable events)

From the [pricing list](https://developers.google.com/maps/billing-and-pricing/pricing):

| SKU                                     | Tier       | Free per month | Price after free (cap to 100K) | Notes                                           |
| --------------------------------------- | ---------- | -------------- | ------------------------------ | ----------------------------------------------- |
| Dynamic Maps (Maps JS API map load)     | Essentials | 10,000         | $7.00                          | Pan/zoom does not add charges                   |
| Static Maps                             | Essentials | 10,000         | $2.00                          | Cheapest map render                             |
| Geocoding                               | Essentials | 10,000         | $5.00                          | One call per address resolve                    |
| Address Validation                      | Essentials | varies         | ~$17.00                        | Higher cost reflects the richer response        |
| Place Details Essentials (IDs Only)     | Essentials | 10,000         | $5.00                          | If we ever use Places                           |
| Place Details Pro                       | Pro        | 5,000          | $17.00                         | Atmosphere fields trigger Pro/Enterprise        |
| Place Details Enterprise + Atmosphere   | Enterprise | 1,000          | $20.00                         | Most expensive Places tier                      |
| Autocomplete Session                    | Essentials | 10,000         | ~$17.00 per session            | Session bundles many keystrokes into one charge |
| Routes: Compute Routes Essentials       | Essentials | 10,000         | $5.00                          |                                                 |
| Routes: Compute Route Matrix Essentials | Essentials | 10,000         | $5.00                          | One event per origin-destination pair           |
| Roads: Snap to Roads / Nearest Road     | Pro        | 5,000          | $10.00                         | Not needed for Beach Metro                      |

Volume discounts kick in above 100K monthly events, dropping to roughly 20% to 70% of the cap rate at 5M+ events. Beach Metro's expected volume is far below any of those tiers (see [1.9](#19-expected-cost-0month-at-our-volume)).

---

## 7. Research: Terms of Service, attribution, and other constraints

Beyond the 30-day caching rule covered in [1.3](#13-data-retention-place_id-is-durable-latlng-is-a-30-day-cache), a few other items from the [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms) and [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) to track.

### 7.1 No use with a non-Google map

From the [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms):

> Customer must not use Google Maps Content from the Geocoding API in conjunction with a non-Google map.

In practice: if we display Geocoding results visually on a map, that map must be a Google Map (rendered via Maps JS or Maps Static). We cannot use Geocoding output to plot points on Leaflet or Mapbox. This is fine for us; we are using Google end-to-end.

### 7.2 No scraping or bulk export

Google explicitly prohibits pre-fetching, indexing, storing, resharing, or rehosting Google Maps content outside the service. Pulling all of the Beach territory's addresses ahead of time and saving them locally is not allowed; we have to geocode at the point of use.

### 7.3 Attribution

When showing Google Maps content (including embedded maps and Place data), we must show the Google logo and any third-party attributions returned in the response. The Maps JS API does this automatically; for any custom display we need to render it ourselves.

### 7.4 PII and privacy

We will be sending volunteer addresses to Google. This is third-party data processing and should be disclosed in our privacy policy. Beach Metro's SOW already lists PII protection as a non-functional requirement; we should make sure the privacy notice covers Google Maps as a processor.

### 7.5 Restricted API keys

Google's [API security best practices](https://developers.google.com/maps/api-security-best-practices) recommend restricting keys by referrer and by enabled API, and capping quotas per-day in the Cloud Console. (Our stance: [1.8](#18-api-keys-and-cost-guardrails).)

---

## 8. Open questions and follow-ups

1. **Refresh strategy for cached lat/lng.** Do we refresh lazily (on read, if older than 25 days) or proactively (a nightly batch)? Lazy is simpler; proactive is more predictable. Given the data set is ~200 stable addresses, either is cheap.
2. **Do we need Places Autocomplete?** It improves data quality at input but adds a billed SKU. Decision could go either way; Melinda probably enters most addresses, and she is unlikely to make many typos for streets she knows.
3. **Route endpoint storage.** Routes are described by intersections. Geocoding intersections sometimes returns `RANGE_INTERPOLATED` rather than `ROOFTOP`. Acceptable for display, but worth flagging in the UI when route endpoints are interpolated.
4. **Drawing Library deprecation.** If we build drag-and-drop route editing, plan to integrate Terra Draw rather than `google.maps.drawing` ([4.2](#42-drawing-libraries)).
5. **Confirm Beach Metro is okay with Google as a sub-processor.** Susan and Melinda may want a line in the privacy policy and/or volunteer-facing comms about this ([7.4](#74-pii-and-privacy)).
6. **Map embedding option.** For purely read-only maps (e.g. a public "see our coverage area" page), the Maps **Embed** API is completely free with unlimited usage. Worth considering for any non-admin views.
