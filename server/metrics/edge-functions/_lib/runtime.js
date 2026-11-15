// EdgeOne Pages runtime helpers (SPEC-0018, ADR-0023).

export const NO_STORE = { "Cache-Control": "no-store" };

export function response(status, body = null, headers = NO_STORE) {
  return new Response(body, { status, headers });
}

export function envOf(context) {
  return context?.env || {};
}

/**
 * A console-bound namespace is a **global variable** named at binding time —
 * it is not part of `context.env` (the platform guidance is explicitly
 * "Do NOT use context.env.KV"). The global therefore comes first; `context.env`
 * and `context` stay as fallbacks for the in-memory KV used by `node --test`
 * and for other hosts. The value is only ever read server-side.
 */
export function getKv(context, name = "METRICS_KV") {
  const candidates = [globalThis[name], context?.[name], context?.env?.[name]];
  return (
    candidates.find(
      (candidate) => candidate && typeof candidate.get === "function",
    ) || null
  );
}

export function serverDayOf(now = Date.now) {
  return new Date(now()).toISOString().slice(0, 10);
}
