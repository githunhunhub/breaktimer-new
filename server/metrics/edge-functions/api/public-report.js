// EdgeOne Makers route: GET /api/public-report (SPEC-0022, ADR-0029).
import { publicReportRequest } from "../_lib/public-report.js";

export async function onRequest(context) {
  return publicReportRequest(context);
}
