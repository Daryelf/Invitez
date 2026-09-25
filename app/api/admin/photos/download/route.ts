import { env } from "cloudflare:workers";
import { requireAdminApi } from "@/app/admin-auth";
import { createZipStream } from "@/lib/zip-stream";

type PhotoArchiveRow = {
  id: string;
  object_key: string;
  name: string;
  guest_name: string | null;
  created_at: string;
};

function safeSegment(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, 100) || fallback;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  if (!env.DB || !env.MEDIA) return Response.json({ error: "Gallery storage is unavailable" }, { status: 503 });

  const result = await env.DB.prepare(`SELECT id, object_key, name, guest_name, created_at
    FROM photos ORDER BY created_at ASC LIMIT 5000`).all<PhotoArchiveRow>();
  if (!result.results.length) return Response.json({ error: "There are no memories to download yet" }, { status: 404 });

  const entries = result.results.map((photo) => {
    const guestFolder = safeSegment(photo.guest_name || "Anonymous guest", "Anonymous guest");
    const originalName = safeSegment(photo.name, "event-memory");
    const dateStamp = photo.created_at.replace(/[^0-9]/g, "").slice(0, 14);
    return {
      objectKey: photo.object_key,
      archiveName: `${guestFolder}/${dateStamp}-${photo.id.slice(0, 8)}-${originalName}`,
      createdAt: photo.created_at,
    };
  });

  return new Response(createZipStream(entries, env.MEDIA), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=Erikas-Sweet-16-guest-memories.zip",
      "Content-Type": "application/zip",
    },
  });
}
