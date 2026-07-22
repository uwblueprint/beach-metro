import { z } from "zod";

import { parseBody, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { resolveAddress } from "@/lib/services/addresses";
import { addressInput } from "@/lib/validation/common";

const body = z.object({ address: addressInput });

// Address Validation wrapper (server-side; keys never reach the client).
export const POST = route(async (req) => {
  const { address } = await parseBody(req, body);
  const resolved = await resolveAddress(address);
  return ok({
    addressComplete: resolved.addressComplete,
    needsConfirmation: resolved.needsConfirmation,
    formattedAddress: resolved.formattedAddress,
    placeId: resolved.placeId,
    type: resolved.residential === false ? "commercial" : "residential",
  });
});
