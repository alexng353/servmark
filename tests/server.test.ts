import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createApp, type ServerOptions } from "../src/server.js";
import { initRenderer } from "../src/render.js";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testDir: string;

beforeAll(async () => {
  await initRenderer();
});

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "servmark-test-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function makeApp(overrides?: Partial<ServerOptions>) {
  return createApp({
    rootDir: testDir,
    docsMode: false,
    theme: "dark",
    liveReload: false,
    ...overrides,
  });
}

describe("server", () => {
  it("serves directory listing at root", async () => {
    await writeFile(join(testDir, "hello.txt"), "hi");
    const app = makeApp();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("hello.txt");
  });

  it("serves static files with correct content-type", async () => {
    await writeFile(join(testDir, "style.css"), "body{}");
    const app = makeApp();
    const res = await app.request("/style.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
    expect(await res.text()).toBe("body{}");
  });

  it("renders markdown files as HTML", async () => {
    await writeFile(join(testDir, "readme.md"), "# Hello");
    const app = makeApp();
    const res = await app.request("/readme.md");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<h1>Hello</h1>");
  });

  it("returns 404 for missing files", async () => {
    const app = makeApp();
    const res = await app.request("/nonexistent.txt");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("404");
    expect(html).toContain("Go back");
  });

  it("rejects path traversal attempts", async () => {
    const app = makeApp();
    const res = await app.request("/../../../etc/passwd");
    expect(res.status).toBe(403);
  });

  it("serves content endpoint for live reload", async () => {
    await writeFile(join(testDir, "doc.md"), "# Updated");
    const app = makeApp({ liveReload: true });
    const res = await app.request("/__servmark/content?path=/doc.md");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<h1>Updated</h1>");
    expect(html).not.toContain("<!DOCTYPE");
  });

  it("serves subdirectories", async () => {
    await mkdir(join(testDir, "sub"));
    await writeFile(join(testDir, "sub", "file.txt"), "content");
    const app = makeApp();
    const res = await app.request("/sub");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("file.txt");
  });
});
