import { env } from "cloudflare:workers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.DB || !env.MEDIA) return new Response("Media storage is not configured yet", { status: 503 });
  const { id } = await context.params;
  const photo = await env.DB.prepare("SELECT object_key, content_type FROM photos WHERE id = ?").bind(id).first<{ object_key: string; content_type: string }>();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(photo.object_key, { range: request.headers });
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", photo.content_type);
  headers.set("accept-ranges", "bytes");
  if (object.range) {
    const offset = object.range.offset || 0;
    const length = object.range.length || object.size;
    headers.set("content-length", String(length));
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
