import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the architecture configurator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MSA Architecture Console<\/title>/i);
  assert.match(html, /필요한 만큼만/);
  assert.match(html, /권장 시작 구성/);
  assert.match(html, /template-config\.json/);
  assert.match(html, /React SPA/);
  assert.match(html, /프론트 없음/);
  assert.match(html, /--profile observability/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
