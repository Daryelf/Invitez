import { env } from "cloudflare:workers";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.DB || !env.MEDIA) return new Response("Photo storage is not configured yet", { status: 503 });
  const { id } = await context.params;
  const photo = await env.DB.prepare("SELECT object_key, content_type FROM photos WHERE id = ?").bind(id).first<{ object_key: string; content_type: string }>();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(photo.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", photo.content_type);
  return new Response(object.body, { headers });
}
