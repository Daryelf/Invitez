import { requireAdminApi } from "@/app/admin-auth";
import { getRsvpLayout, saveRsvpLayout } from "@/db/invitations";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  return Response.json({ layout: await getRsvpLayout() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request." }, { status: 403 });
  }

  let input: { layout?: unknown };
  try {
    input = await request.json() as { layout?: unknown };
  } catch {
    return Response.json({ error: "Invalid layout" }, { status: 400 });
  }

  const layout = await saveRsvpLayout(input.layout);
  return Response.json({ ok: true, layout }, { headers: { "Cache-Control": "no-store" } });
}
