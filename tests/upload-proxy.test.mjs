import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

test("upload proxy streams requests, handles concurrent uploads, and rejects oversized bodies", async (t) => {
  let upstreamRequests = 0;
  let firstChunkSeen = false;
  const upstream = createServer(async (request, response) => {
    upstreamRequests += 1;
    let bytes = 0;
    for await (const chunk of request) {
      firstChunkSeen = true;
      bytes += chunk.length;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ bytes }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  t.after(() => upstream.close());

  const port = await freePort();
  const child = spawn(process.execPath, ["railway-server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), DASHBOARD_ORIGIN: `http://127.0.0.1:${upstream.address().port}` },
    stdio: "ignore",
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      ready = (await fetch(`${base}/share-photos`)).ok;
      if (ready) break;
    } catch { /* startup */ }
    await delay(50);
  }
  assert.ok(ready, "proxy server started");

  let releaseBody;
  const bodyGate = new Promise((resolve) => { releaseBody = resolve; });
  const streamedUpload = fetch(`${base}/api/photos`, {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024));
        bodyGate.then(() => {
          controller.enqueue(new Uint8Array(1024));
          controller.close();
        });
      },
    }),
    duplex: "half",
  });
  try {
    for (let attempt = 0; attempt < 30 && !firstChunkSeen; attempt += 1) await delay(20);
    assert.ok(firstChunkSeen, "upstream received bytes before the client finished sending");
  } finally {
    releaseBody();
  }
  assert.deepEqual(await (await streamedUpload).json(), { bytes: 2048 });

  const payload = Buffer.alloc(64 * 1024, 7);
  for (let wave = 0; wave < 5; wave += 1) {
    const results = await Promise.all(Array.from({ length: 200 }, async () => {
      const response = await fetch(`${base}/api/photos`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg", "X-File-Name": "load.jpg" },
        body: payload,
      });
      assert.equal(response.status, 200);
      return response.json();
    }));
    assert.ok(results.every((result) => result.bytes === payload.length));
  }
  assert.equal(upstreamRequests, 1001);

  const oversized = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/api/photos`, {
      method: "POST",
      headers: { "Content-Length": String(97 * 1024 * 1024) },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.flushHeaders();
  });
  assert.equal(oversized, 413);
  assert.equal(upstreamRequests, 1001, "oversized body never reached storage");
});
