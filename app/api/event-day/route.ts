import { getEventSettings, isEventDayActive, publicEvent } from "@/db/invitations";
import { publicCorsHeaders, publicJson } from "@/app/api/cors";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: publicCorsHeaders(request, "GET, OPTIONS") });
}

export async function GET(request: Request) {
  try {
    const settings = await getEventSettings();
    return publicJson(request, {
      active: isEventDayActive(settings),
      photoUploadsEnabled: settings.photoUploadsEnabled,
      event: publicEvent(settings),
    });
  } catch {
    return publicJson(request, { active: false, photoUploadsEnabled: false, event: null }, { status: 503 });
  }
}
