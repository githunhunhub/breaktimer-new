// EdgeOne Makers route: GET /api/report (SPEC-0018, ADR-0023).
import { reportRequest } from "../_lib/report.js";

export async function onRequest(context) {
  return reportRequest(context);
}
