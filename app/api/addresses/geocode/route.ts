import { z } from "zod";

import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { resolveAddress } from "@/lib/services/addresses";
import { addressInput } from "@/lib/validation/common";

const body = z.object({ address: addressInput });

// Geocoding wrapper: resolve to placeId + coords + parsed components.
export const POST = route(async (req) => {
  const { address } = await parseBody(req, body);
  const resolved = await resolveAddress(address);
  return ok(resolved);
});
