import {
  AdminAuthError,
  createAdminSession,
  createInitialAdminPassword,
  requestIsSecure,
  sessionCookie,
} from "@/app/admin-auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const setupToken = typeof body.setupToken === "string" ? body.setupToken : "";
    const user = await createInitialAdminPassword({ email, password, setupToken });
    const session = await createAdminSession(user.email);
    const response = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.headers.append("Set-Cookie", sessionCookie(session.token, session.expiresAt, requestIsSecure(request)));
    return response;
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 400;
    const message = error instanceof AdminAuthError ? error.message : "Could not create your password.";
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
