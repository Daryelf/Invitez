import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 8080);
const root = process.cwd();
const publicRoot = join(root, "public");
const dashboardOrigin = process.env.DASHBOARD_ORIGIN || "https://after-hours-party.adventraa.chatgpt.site";
const dashboardSessionCookie = "invitez_admin_session=";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(pathname) {
  if (pathname === "/" || pathname === "/index.html") return join(root, "railway", "index.html");
  if (/^\/i\/[^/]+\/?$/.test(pathname)) return join(root, "railway", "index.html");
  if (pathname === "/globals.css") return join(root, "app", "globals.css");

  const decoded = decodeURIComponent(pathname).replace(/^\/+/, "");
  const safePath = normalize(decoded);
  if (safePath.startsWith("..") || safePath.includes("/../")) return null;
  return join(publicRoot, safePath);
}

function canonicalInvitationPath(pathname) {
  const match = /^\/i\/([a-f0-9]{32})(?:\/?$|https?:)/i.exec(pathname);
  return match ? `/i/${match[1].toLowerCase()}` : null;
}

function shouldProxyDashboard(pathname) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname === "/api/admin"
    || pathname.startsWith("/api/admin/")
    || pathname.startsWith("/assets/");
}

function publicRequestOrigin(request) {
  const forwardedHost = request.headers["x-forwarded-host"];
  const requestedHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || request.headers.host || "www.invitez.xyz";
  const isLocal = requestedHost.startsWith("localhost:") || requestedHost.startsWith("127.0.0.1:");
  const allowedHost = requestedHost === "invitez.xyz" || requestedHost === "www.invitez.xyz" || isLocal
    ? requestedHost
    : "www.invitez.xyz";
  return `${isLocal ? "http" : "https"}://${allowedHost}`;
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyDashboardRequest(request, response, requestUrl) {
  const publicOrigin = publicRequestOrigin(request);
  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, dashboardOrigin);
  const upstreamHeaders = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (!value || ["host", "connection", "content-length", "transfer-encoding", "accept-encoding"].includes(name)) continue;
    upstreamHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  upstreamHeaders.set("accept-encoding", "identity");
  upstreamHeaders.set("x-forwarded-host", new URL(publicOrigin).host);
  upstreamHeaders.set("x-forwarded-proto", new URL(publicOrigin).protocol.slice(0, -1));
  if (upstreamHeaders.has("origin")) upstreamHeaders.set("origin", dashboardOrigin);

  const method = request.method || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(request);
  const upstream = await fetch(target, {
    method,
    headers: upstreamHeaders,
    body,
    redirect: "manual",
  });
  const responseBody = method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer());
  const responseHeaders = {};

  upstream.headers.forEach((value, name) => {
    if (["connection", "content-length", "content-encoding", "set-cookie"].includes(name)) return;
    responseHeaders[name] = name === "location" ? value.replaceAll(dashboardOrigin, publicOrigin) : value;
  });
  responseHeaders["Content-Length"] = responseBody.length;

  const setCookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : [upstream.headers.get("set-cookie") || ""];
  const dashboardCookies = setCookies.filter((cookie) => cookie.startsWith(dashboardSessionCookie));
  if (dashboardCookies.length) responseHeaders["Set-Cookie"] = dashboardCookies;

  response.writeHead(upstream.status, responseHeaders);
  response.end(responseBody);
}

async function sendFile(request, response, filePath) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error("Not a file");

  const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  const range = request.headers.range;
  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": [".html", ".css"].includes(extname(filePath)) ? "no-cache" : "public, max-age=3600",
    "Content-Type": contentType,
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${fileStat.size}` });
      response.end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
    if (start > end || start >= fileStat.size) {
      response.writeHead(416, { "Content-Range": `bytes */${fileStat.size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      ...headers,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
    });
    if (request.method === "HEAD") return response.end();
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { ...headers, "Content-Length": fileStat.size });
  if (request.method === "HEAD") return response.end();
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const pathname = requestUrl.pathname;
    const canonicalInvitePath = canonicalInvitationPath(pathname);
    if (canonicalInvitePath && canonicalInvitePath !== pathname) {
      response.writeHead(308, {
        "Cache-Control": "no-store",
        Location: `${canonicalInvitePath}${requestUrl.search}`,
      });
      response.end();
      return;
    }
    if (shouldProxyDashboard(pathname)) {
      await proxyDashboardRequest(request, response, requestUrl);
      return;
    }
    if (pathname === "/event-day" || pathname === "/event-day/") {
      response.writeHead(302, { Location: `https://after-hours-party.adventraa.chatgpt.site/event-day${requestUrl.search}` });
      response.end();
      return;
    }
    const filePath = resolveRequestPath(pathname);
    if (!filePath) throw new Error("Invalid path");
    await sendFile(request, response, filePath);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Invitez is listening on port ${port}`);
});
