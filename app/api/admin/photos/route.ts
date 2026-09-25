import { env } from "cloudflare:workers";
import { requireAdminApi } from "@/app/admin-auth";

type PhotoRow = {
  id: string;
  name: string;
  content_type: string;
  caption: string | null;
  guest_name: string | null;
  created_at: string;
};

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  if (!env.DB) return Response.json({ error: "Gallery storage is unavailable" }, { status: 503 });

  const result = await env.DB.prepare(`SELECT id, name, content_type, caption, guest_name, created_at
    FROM photos ORDER BY created_at ASC LIMIT 5000`).all<PhotoRow>();

  return Response.json({
    photos: result.results.map((photo) => ({
      id: photo.id,
      name: photo.name,
      contentType: photo.content_type,
      caption: photo.caption || "",
      guestName: photo.guest_name || "",
      url: `/api/photos/${photo.id}`,
      downloadUrl: `/api/admin/photos/${photo.id}`,
      createdAt: photo.created_at,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
