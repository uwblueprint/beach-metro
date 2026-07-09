import { parseBody, parseQuery, route } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createYear, listYears } from "@/lib/services/financial-years";
import { createFinancialYear, yearsQuery } from "@/lib/validation/finance";

export const GET = route(async (req) => {
  return ok(await listYears(parseQuery(req, yearsQuery)));
});

export const POST = route(async (req) => {
  return created(await createYear(await parseBody(req, createFinancialYear)));
});
