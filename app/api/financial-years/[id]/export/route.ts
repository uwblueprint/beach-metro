import { NextResponse } from "next/server";

import { route } from "@/lib/api/handler";
import { exportYearCsv } from "@/lib/services/financial-years";

// Read-only CSV export of the year table (or use ?format=csv for symmetry).
export const GET = route(async (_req, params) => {
  const { filename, csv } = await exportYearCsv(params.id);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
