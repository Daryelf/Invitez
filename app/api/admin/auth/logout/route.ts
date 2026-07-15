import {
  clearSessionCookie,
  requestIsSecure,
  revokeAdminSession,
  sessionTokenFromCookie,
} from "@/app/admin-auth";

async function logout(request: Request, redirectToAdmin: boolean) {
  const token = sessionTokenFromCookie(request.headers.get("cookie"));
  await revokeAdminSession(token);
  const secure = requestIsSecure(request);

  if (redirectToAdmin) {
    return new Response(null, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        Location: new URL("/admin", request.url).toString(),
        "Set-Cookie": clearSessionCookie(secure),
      },
    });
  }

  const response = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", clearSessionCookie(secure));
  return response;
}

export async function GET(request: Request) {
  return logout(request, true);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request." }, { status: 403 });
  }
  return logout(request, false);
}
