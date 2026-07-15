const ALLOWED_ORIGINS = new Set([
  "https://www.invitez.xyz",
  "https://invitez.xyz",
  "https://after-hours-party.adventraa.chatgpt.site",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

export function publicCorsHeaders(request: Request, methods = "GET, POST, OPTIONS") {
  const origin = request.headers.get("Origin");
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": methods,
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      }
    : {};
}

export function publicJson(request: Request, data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...publicCorsHeaders(request), ...(init?.headers || {}) },
  });
}
