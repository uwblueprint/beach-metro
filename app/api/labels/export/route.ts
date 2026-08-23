import { NextResponse, type NextRequest } from "next/server";

import { parseBody, route } from "@/lib/api/handler";
import { exportLabelSheet } from "@/lib/services/labels";
import { exportLabels } from "@/lib/validation/labels";

/**
 * Render the chosen bundles to a PDF label sheet.
 *
 * Returns the PDF bytes directly rather than the `{ data }` envelope every other
 * endpoint uses — the response IS the file, and the browser downloads it. Errors
 * still come back as the normal JSON envelope via the route wrapper, so the
 * client checks the content type before treating the body as a file.
 */
export const POST = route(async (req: NextRequest) => {
  const body = await parseBody(req, exportLabels);
  const { filename, bytes, labelCount } = await exportLabelSheet(body);

  return new NextResponse(bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "X-Label-Count": String(labelCount),
    },
  });
});
