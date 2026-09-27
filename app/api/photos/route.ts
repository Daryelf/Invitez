import { env } from "cloudflare:workers";
import { getEventSettings } from "@/db/invitations";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 90 * 1024 * 1024;
const MAX_REQUEST_SIZE = 96 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

function decodeUploadHeader(value: string | null, limit: number) {
  try {
    return decodeURIComponent(value || "").trim().slice(0, limit);
  } catch {
    return "";
  }
}

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
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_SIZE) {
    return json({ error: "File is too large" }, { status: 413 });
  }
  const event = await getEventSettings();
  if (!event.photoUploadsEnabled) return json({ error: "Uploads are paused by the host" }, { status: 403 });
  const requestType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const isMultipart = requestType === "multipart/form-data";
  const formData = isMultipart ? await request.formData() : null;
  const file = formData?.get("photo");
  if (isMultipart && !(file instanceof File)) return json({ error: "Choose a photo or video first" }, { status: 400 });
  const contentType = file instanceof File ? file.type : requestType;
  const name = file instanceof File ? file.name : decodeUploadHeader(request.headers.get("x-file-name"), 160) || "event-memory";
  const caption = file instanceof File
    ? String(formData?.get("caption") ?? "").trim().slice(0, 140)
    : decodeUploadHeader(request.headers.get("x-caption"), 140);
  const guestName = file instanceof File
    ? String(formData?.get("guestName") ?? "").trim().slice(0, 80)
    : decodeUploadHeader(request.headers.get("x-guest-name"), 80);
  const isImage = ALLOWED_IMAGE_TYPES.has(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);
  if (!isImage && !isVideo) return json({ error: "Choose a JPG, PNG, WebP, MP4, MOV, WebM, or M4V file" }, { status: 400 });
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  const declaredSize = file instanceof File ? file.size : Number(request.headers.get("content-length") || 0);
  if (declaredSize > maxSize) return json({ error: isImage ? "That photo is larger than 10MB" : "That video is larger than 90MB" }, { status: 400 });
  if (file instanceof File && !file.size) return json({ error: "Choose a nonempty photo or video" }, { status: 400 });
  const source = file instanceof File ? file.stream() : request.body;
  if (!source) return json({ error: "Choose a photo or video first" }, { status: 400 });

  const id = crypto.randomUUID();
  const objectKey = `event-photos/${id}-${name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const createdAt = new Date().toISOString();
  try {
    const stored = await env.MEDIA.put(objectKey, source, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } });
    if (!stored?.size || stored.size > maxSize) {
      await env.MEDIA.delete(objectKey);
      return json({ error: stored?.size ? (isImage ? "That photo is larger than 10MB" : "That video is larger than 90MB") : "Choose a nonempty photo or video" }, { status: 400 });
    }
    await env.DB.prepare("INSERT INTO photos (id, object_key, name, content_type, caption, guest_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, objectKey, name, contentType, caption || null, guestName || null, createdAt).run();
    return json({ photo: { id, caption: caption || null, contentType, url: `/api/photos/${id}`, createdAt } });
  } catch {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return json({ error: "Could not save that photo or video" }, { status: 500 });
  }
}
