// Temporary deployment diagnostic for SPEC-0022 request URL parsing.

function safeUrlShape(value) {
  if (typeof value !== "string") return { type: typeof value };

  const shape = {
    type: "string",
    length: value.length,
    startsWithSlash: value.startsWith("/"),
    hasScheme: /^[a-z][a-z\d+.-]*:\/\//i.test(value),
    hasQuery: value.includes("?"),
  };

  try {
    const url = new URL(value);
    shape.absoluteParse = true;
    shape.queryKeys = [...url.searchParams.keys()];
    shape.range = url.searchParams.get("range");
    shape.granularity = url.searchParams.get("granularity");
    try {
      shape.arrayFromEntries = Array.from(url.searchParams).map(([key]) => key);
    } catch {
      shape.arrayFromEntries = "error";
    }
    try {
      shape.spreadEntries = [...url.searchParams].map(([key]) => key);
    } catch {
      shape.spreadEntries = "error";
    }
  } catch {
    shape.absoluteParse = false;
  }

  try {
    const url = new URL(value, "https://diagnostic.invalid");
    shape.relativeParse = true;
    shape.resolvedPathname = url.pathname;
    shape.resolvedQueryKeys = [...url.searchParams.keys()];
  } catch {
    shape.relativeParse = false;
  }

  return shape;
}

export function onRequest(context) {
  const request = context?.request;
  return new Response(
    JSON.stringify({
      requestType: typeof request,
      method: request?.method,
      url: safeUrlShape(request?.url),
      queryType: typeof request?.query,
      queryKeys:
        request?.query && typeof request.query === "object"
          ? Object.keys(request.query)
          : [],
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
