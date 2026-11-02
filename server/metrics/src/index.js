// Anonymous installation metrics endpoint (SPEC-0018, ADR-0019).
//
// Privacy rules enforced here:
//   * only the documented allowlist fields are accepted (see validate.js);
//   * the client IP is never read, logged or stored;
//   * no request bodies are written to logs.

import { isRecentDay, validateEvent } from "./validate.js";

const MAX_BODY_BYTES = 2048;
const RETENTION_DAYS = 180;
const NO_STORE = { "Cache-Control": "no-store" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/v1/collect") {
      return new Response(null, { status: 404, headers: NO_STORE });
    }
    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: { ...NO_STORE, Allow: "POST" },
      });
    }

    // Remote kill switch: flip DISABLED to "1" and redeploy the Worker.
    if (env.DISABLED === "1") {
      return new Response(null, { status: 410, headers: NO_STORE });
    }

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return new Response(null, { status: 413, headers: NO_STORE });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(null, { status: 400, headers: NO_STORE });
    }

    const invalid = validateEvent(payload);
    if (invalid) {
      return new Response(invalid, { status: 400, headers: NO_STORE });
    }

    const serverDay = new Date().toISOString().slice(0, 10);
    if (!isRecentDay(payload.day, serverDay)) {
      return new Response("day out of range", { status: 400, headers: NO_STORE });
    }

    const firstSeenDay =
      payload.event === "install" ? payload.firstLaunchDay : payload.day;

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO installs
             (install_id, first_seen_day, last_seen_day, first_version, os, arch, locale, channel)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(install_id) DO UPDATE SET
             first_seen_day = MIN(first_seen_day, excluded.first_seen_day),
             last_seen_day = MAX(last_seen_day, excluded.last_seen_day),
             updated_at = datetime('now')`,
        ).bind(
          payload.installId,
          firstSeenDay,
          payload.day,
          payload.version,
          payload.os,
          payload.arch,
          payload.locale,
          payload.channel,
        ),
        env.DB.prepare(
          `INSERT INTO daily_active (install_id, day, version, channel)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(install_id, day) DO UPDATE SET
             version = excluded.version,
             channel = excluded.channel`,
        ).bind(
          payload.installId,
          payload.day,
          payload.version,
          payload.channel,
        ),
      ]);
    } catch {
      return new Response(null, { status: 500, headers: NO_STORE });
    }

    return new Response(null, { status: 204, headers: NO_STORE });
  },

  // Daily retention job: raw per-install rows age out, aggregates stay.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      env.DB.prepare(
        "DELETE FROM daily_active WHERE day < date('now', ?)",
      )
        .bind(`-${RETENTION_DAYS} day`)
        .run(),
    );
  },
};
