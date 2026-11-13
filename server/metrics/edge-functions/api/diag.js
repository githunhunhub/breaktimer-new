// TEMPORARY runtime probe for the EdgeOne request shape (SPEC-0018).
// Remove once the collect body handling is confirmed on the platform.
import { NO_STORE } from "../_lib/runtime.js";

function probe(read) {
  try {
    return read();
  } catch (error) {
    return `error:${error?.message || error}`;
  }
}

export async function onRequest(context) {
  const request = context?.request;
  const info = {
    contextKeys: probe(() => Object.keys(context).join(",")),
    requestType: probe(() => typeof request),
    requestCtor: probe(() => request?.constructor?.name),
    requestKeys: probe(() => Object.keys(request).join(",")),
    method: probe(() => request?.method),
    hasText: probe(() => typeof request?.text),
    hasJson: probe(() => typeof request?.json),
    hasArrayBuffer: probe(() => typeof request?.arrayBuffer),
    hasFormData: probe(() => typeof request?.formData),
    bodyType: probe(() => typeof request?.body),
    bodyCtor: probe(() => request?.body?.constructor?.name),
    bodyKeys: probe(() =>
      request?.body && typeof request.body === "object"
        ? Object.keys(request.body).join(",")
        : null,
    ),
    bodyLength: probe(() => request?.body?.length),
    hasGetReader: probe(() => typeof request?.body?.getReader),
    contentLength: probe(() => request?.headers?.get?.("content-length")),
    contentType: probe(() => request?.headers?.get?.("content-type")),
    envKeys: probe(() => Object.keys(context?.env || {}).join(",")),
    hasTextDecoder: probe(() => typeof TextDecoder),
  };

  try {
    const text = await request.text();
    info.textRead = `ok:${typeof text}:${text === undefined ? "undefined" : text.length}`;
    info.textHead = typeof text === "string" ? text.slice(0, 40) : null;
  } catch (error) {
    info.textRead = `error:${error?.message || error}`;
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: { ...NO_STORE, "Content-Type": "application/json" },
  });
}
