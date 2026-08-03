import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listCaptainPayoutHistory } from "@/lib/services/payouts";

// This captain's payout across every issue, newest first. Read-only: the member
// panel shows reimbursement history, while editing a cell stays on /api/payouts.
export const GET = route(async (_req, params) => {
  return ok(await listCaptainPayoutHistory(params.id));
});
