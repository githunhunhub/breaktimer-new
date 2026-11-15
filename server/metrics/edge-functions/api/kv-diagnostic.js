// Temporary deployment diagnostic for the EdgeOne KV binding.
import { getKv, response } from "../_lib/runtime.js";

function safeError(error) {
  return {
    name: typeof error?.name === "string" ? error.name : typeof error,
    message:
      typeof error?.message === "string"
        ? error.message.slice(0, 240)
        : String(error).slice(0, 240),
    code:
      typeof error?.code === "string" || typeof error?.code === "number"
        ? String(error.code)
        : null,
  };
}

export async function onRequest(context) {
  const kv = getKv(context);
  const result = {
    hasKv: Boolean(kv),
    methods: kv
      ? {
          get: typeof kv.get,
          list: typeof kv.list,
          put: typeof kv.put,
        }
      : null,
    getMissing: null,
    list: null,
  };

  if (!kv) {
    return response(503, JSON.stringify(result), {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    });
  }

  try {
    const value = await kv.get("__metrics_diagnostic_missing__");
    result.getMissing = { ok: true, valueType: value === null ? "null" : typeof value };
  } catch (error) {
    result.getMissing = { ok: false, error: safeError(error) };
  }

  if (typeof kv.list === "function") {
    try {
      const page = await kv.list({ prefix: "h_", limit: 1 });
      result.list = {
        ok: true,
        resultType: page === null ? "null" : typeof page,
        keysType: Array.isArray(page?.keys) ? "array" : typeof page?.keys,
        keyCount: Array.isArray(page?.keys) ? page.keys.length : null,
        completeType: typeof page?.complete,
        cursorType: typeof page?.cursor,
      };
    } catch (error) {
      result.list = { ok: false, error: safeError(error) };
    }
  }

  return response(200, JSON.stringify(result), {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
}
