import { env } from "cloudflare:workers";
import { getEventSettings } from "@/db/invitations";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 90 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" }, ...init });
}

export async function GET() {
  if (!env.DB) return json({ photos: [] });
  try {
    const result = await env.DB.prepare("SELECT id, caption, content_type, created_at FROM photos ORDER BY created_at DESC LIMIT 120").all<{ id: string; caption: string | null; content_type: string; created_at: string }>();
    return json({ photos: result.results.map((photo) => ({ id: photo.id, caption: photo.caption, contentType: photo.content_type, url: `/api/photos/${photo.id}`, createdAt: photo.created_at })) });
  } catch {
    return json({ photos: [] });
  }
}

export async function POST(request: Request) {
  if (!env.DB || !env.MEDIA) return json({ error: "Media storage is not configured yet" }, { status: 503 });
  const event = await getEventSettings();
  if (!event.photoUploadsEnabled) return json({ error: "Uploads are paused by the host" }, { status: 403 });
  const formData = await request.formData();
  const file = formData.get("photo");
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 140);
  const guestName = String(formData.get("guestName") ?? "").trim().slice(0, 80);
  if (!(file instanceof File)) return json({ error: "Choose a photo or video first" }, { status: 400 });
  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) return json({ error: "Choose a JPG, PNG, WebP, MP4, MOV, WebM, or M4V file" }, { status: 400 });
  if (isImage && file.size > MAX_IMAGE_SIZE) return json({ error: "That photo is larger than 10MB" }, { status: 400 });
  if (isVideo && file.size > MAX_VIDEO_SIZE) return json({ error: "That video is larger than 90MB" }, { status: 400 });

  const id = crypto.randomUUID();
  const objectKey = `event-photos/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const createdAt = new Date().toISOString();
  try {
    await env.MEDIA.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
    await env.DB.prepare("INSERT INTO photos (id, object_key, name, content_type, caption, guest_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, objectKey, file.name, file.type, caption || null, guestName || null, createdAt).run();
    return json({ photo: { id, caption: caption || null, contentType: file.type, url: `/api/photos/${id}`, createdAt } });
  } catch {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return json({ error: "Could not save that photo or video" }, { status: 500 });
  }
}
