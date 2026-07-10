import { env } from "cloudflare:workers";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" }, ...init });
}

export async function GET() {
  if (!env.DB) return json({ photos: [] });
  try {
    const result = await env.DB.prepare("SELECT id, name, caption, created_at FROM photos ORDER BY created_at DESC LIMIT 60").all<{ id: string; name: string; caption: string | null; created_at: string }>();
    return json({ photos: result.results.map((photo) => ({ id: photo.id, name: photo.name, caption: photo.caption, url: `/api/photos/${photo.id}`, createdAt: photo.created_at })) });
  } catch {
    return json({ photos: [] });
  }
}

export async function POST(request: Request) {
  if (!env.DB || !env.MEDIA) return json({ error: "Photo storage is not configured yet" }, { status: 503 });
  const formData = await request.formData();
  const file = formData.get("photo");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 140);
  if (!(file instanceof File)) return json({ error: "Choose an image first" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return json({ error: "That image is larger than 10MB" }, { status: 400 });

  const id = crypto.randomUUID();
  const objectKey = `event-photos/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const createdAt = new Date().toISOString();
  try {
    await env.MEDIA.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    await env.DB.prepare("INSERT INTO photos (id, object_key, name, content_type, caption, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, objectKey, file.name, file.type, caption || null, createdAt).run();
    return json({ photo: { id, name: file.name, caption: caption || null, url: `/api/photos/${id}`, createdAt } });
  } catch {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return json({ error: "Could not save that photo" }, { status: 500 });
  }
}
