import { parseQuery, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { listMembers } from "@/lib/services/members";
import { membersQuery } from "@/lib/validation/people";

// The members table's list: volunteers and captains merged into one row shape.
// Detail views stay on /api/volunteers/{id} and /api/captains/{id}, whose shapes
// genuinely differ. Filters are applied server-side so the page's "Showing X of Y"
// reflects a real query rather than client-side slicing.
export const GET = route(async (req) => {
  return ok(await listMembers(parseQuery(req, membersQuery)));
});
