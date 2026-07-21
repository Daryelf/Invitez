import encoded from "../../public/og-rsvp.jpg.b64?raw";

export const dynamic = "force-static";

export async function GET() {
  const binary = atob(encoded.replace(/\s+/g, ""));
  const image = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=86400, immutable",
      "Content-Type": "image/jpeg",
    },
  });
}
