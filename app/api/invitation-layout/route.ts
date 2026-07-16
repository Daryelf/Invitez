import { publicCorsHeaders, publicJson } from "@/app/api/cors";
import { getRsvpLayout } from "@/db/invitations";
import { DEFAULT_RSVP_LAYOUT } from "@/lib/rsvp-layout";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: publicCorsHeaders(request, "GET, OPTIONS") });
}

export async function GET(request: Request) {
  try {
    return publicJson(request, { layout: await getRsvpLayout() });
  } catch (error) {
    console.error("Could not load invitation layout", error);
    return publicJson(request, { layout: DEFAULT_RSVP_LAYOUT, unavailable: true });
  }
}
