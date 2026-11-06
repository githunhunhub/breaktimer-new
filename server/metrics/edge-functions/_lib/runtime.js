// EdgeOne Pages runtime helpers (SPEC-0018, ADR-0023).

export const NO_STORE = { "Cache-Control": "no-store" };

export function response(status, body = null, headers = NO_STORE) {
  return new Response(body, { status, headers });
}

export function envOf(context) {
  return context?.env || {};
}

/**
 * Official examples expose bound KV namespaces as a global variable; tests and
 * some projects use context.env. Resolve all documented/tested forms without
 * ever exposing KV to the client.
 */
export function getKv(context, name = "METRICS_KV") {
  const candidates = [context?.env?.[name], context?.[name], globalThis[name]];
  return (
    candidates.find(
      (candidate) => candidate && typeof candidate.get === "function",
    ) || null
  );
}

export function serverDayOf(now = Date.now) {
  return new Date(now()).toISOString().slice(0, 10);
}
