import { env } from "cloudflare:workers";
import { requireAdminApi } from "@/app/admin-auth";

type PhotoRecord = {
  object_key: string;
  name: string;
  content_type: string;
};

function downloadName(value: string) {
  const safe = value.replace(/[\r\n"\\/]/g, "-").trim() || "event-memory";
  return `filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

async function photoRecord(id: string) {
  if (!env.DB) return null;
  return env.DB.prepare("SELECT object_key, name, content_type FROM photos WHERE id = ?")
    .bind(id)
    .first<PhotoRecord>();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  if (!env.MEDIA) return Response.json({ error: "Gallery storage is unavailable" }, { status: 503 });

  const { id } = await context.params;
  const photo = await photoRecord(id);
  if (!photo) return Response.json({ error: "Memory not found" }, { status: 404 });
  const object = await env.MEDIA.get(photo.object_key);
  if (!object) return Response.json({ error: "Media file not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; ${downloadName(photo.name)}`,
      "Content-Length": String(object.size),
      "Content-Type": photo.content_type,
    },
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  if (!env.DB || !env.MEDIA) return Response.json({ error: "Gallery storage is unavailable" }, { status: 503 });

  const { id } = await context.params;
  const photo = await photoRecord(id);
  if (!photo) return Response.json({ error: "Memory not found" }, { status: 404 });

  await env.MEDIA.delete(photo.object_key);
  await env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(id).run();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
