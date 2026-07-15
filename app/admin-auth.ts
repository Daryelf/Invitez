import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

const OWNER_EMAIL = "gamingboi567@gmail.com";

export type AdminAccess = {
  user: ChatGPTUser | null;
  authorized: boolean;
  localPreview: boolean;
};

function allowedEmails() {
  const configured = (env as unknown as { ADMIN_EMAILS?: string }).ADMIN_EMAILS;
  return new Set((configured || OWNER_EMAIL).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  const localPreview = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (localPreview) {
    return {
      user: { displayName: "Daryel Ferreira", email: OWNER_EMAIL, fullName: "Daryel Ferreira" },
      authorized: true,
      localPreview: true,
    };
  }

  const user = await getChatGPTUser();
  return {
    user,
    authorized: Boolean(user && allowedEmails().has(user.email.toLowerCase())),
    localPreview: false,
  };
}

export async function requireAdminApi() {
  const access = await getAdminAccess();
  if (!access.user) return { access, response: Response.json({ error: "Sign in required" }, { status: 401 }) };
  if (!access.authorized) return { access, response: Response.json({ error: "Not authorized" }, { status: 403 }) };
  return { access, response: null };
}
