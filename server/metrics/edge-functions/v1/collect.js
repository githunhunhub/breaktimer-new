// EdgeOne Makers route: POST /v1/collect (SPEC-0018, ADR-0023).
import { collectRequest } from "../_lib/collect.js";

export async function onRequest(context) {
  return collectRequest(context);
}
