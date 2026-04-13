import { Hono } from "hono";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, relative, extname, normalize } from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { renderMarkdown } from "./render.js";
import {
  pageLayout,
  directoryListingHtml,
  notFoundHtml,
  docsSidebarHtml,
  type DirEntry,
  type PageOptions,
} from "./templates.js";
import { FileWatcher } from "./watcher.js";

export interface ServerOptions {
  rootDir: string;
  docsMode: boolean;
  theme: "dark" | "light" | "auto";
  liveReload: boolean;
  watcher?: FileWatcher;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".wasm": "application/wasm",
};

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function findMarkdownFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".md")) {
        files.push(relative(rootDir, fullPath));
      }
    }
  }
  await walk(rootDir);
  return files.sort();
}

export function createApp(options: ServerOptions): Hono {
  const { rootDir, docsMode, theme, liveReload, watcher } = options;
  const app = new Hono();
  let mdFileCache: string[] | null = null;

  function resolveSafe(requestPath: string): string | null {
    const decoded = decodeURIComponent(requestPath);
    // Check for path traversal in decoded segments
    const parts = decoded.split("/");
    if (parts.some((p) => p === "..")) return null;
    const resolved = resolve(rootDir, "." + normalize("/" + decoded));
    if (!resolved.startsWith(rootDir)) return null;
    return resolved;
  }

  // Wrap app.request to catch path traversal before URL normalization strips ".."
  const originalRequest = app.request.bind(app);
  app.request = (input: string | Request | URL, ...rest: Parameters<typeof originalRequest> extends [unknown, ...infer R] ? R : never) => {
    if (typeof input === "string" && !input.startsWith("http")) {
      const parts = input.split("/");
      if (parts.some((p) => p === "..")) {
        return Promise.resolve(new Response("Forbidden", { status: 403 }));
      }
    }
    return originalRequest(input as string, ...rest);
  };

  async function getMdFiles(): Promise<string[]> {
    if (!mdFileCache) {
      mdFileCache = await findMarkdownFiles(rootDir);
    }
    return mdFileCache;
  }

  function makePage(content: string, title: string, currentPath: string, sidebar?: string): string {
    const opts: PageOptions = {
      title,
      content,
      theme,
      liveReload,
      docsMode,
      currentPath,
      sidebar,
    };
    return pageLayout(opts);
  }

  // SSE endpoint for live reload
  if (liveReload && watcher) {
    app.get("/__servmark/events", (c) => {
      const stream = new ReadableStream({
        start(controller) {
          const client = {
            send: (data: string) => {
              controller.enqueue(new TextEncoder().encode(data));
            },
            close: () => {
              controller.close();
            },
          };
          watcher.addClient(client);
          c.req.raw.signal.addEventListener("abort", () => {
            watcher.removeClient(client);
          });
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    });
  }

  // Content-only endpoint for live reload swaps
  app.get("/__servmark/content", async (c) => {
    const requestPath = c.req.query("path") || "/";
    const filePath = resolveSafe(requestPath);
    if (!filePath) return c.text("Forbidden", 403);

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        const entries = await readdir(filePath, { withFileTypes: true });
        const dirEntries: DirEntry[] = await Promise.all(
          entries.map(async (e) => {
            const s = await stat(join(filePath, e.name));
            return { name: e.name, isDirectory: e.isDirectory(), size: s.size, modified: s.mtime };
          })
        );
        return c.html(directoryListingHtml(dirEntries, requestPath));
      }
      if (filePath.endsWith(".md")) {
        const content = await readFile(filePath, "utf-8");
        return c.html(`<div class="markdown-body">${renderMarkdown(content)}</div>`);
      }
      return c.text("Not a renderable file", 400);
    } catch {
      return c.text("Not found", 404);
    }
  });

  // Main catch-all route
  app.get("/*", async (c) => {
    const requestPath = c.req.path;
    const filePath = resolveSafe(requestPath);
    if (!filePath) return c.text("Forbidden", 403);

    try {
      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        const entries = await readdir(filePath, { withFileTypes: true });
        const dirEntries: DirEntry[] = await Promise.all(
          entries.map(async (e) => {
            const s = await stat(join(filePath, e.name));
            return { name: e.name, isDirectory: e.isDirectory(), size: s.size, modified: s.mtime };
          })
        );
        const content = directoryListingHtml(dirEntries, requestPath);
        const sidebar = docsMode ? docsSidebarHtml(await getMdFiles(), requestPath) : undefined;
        return c.html(makePage(content, requestPath, requestPath, sidebar));
      }

      if (filePath.endsWith(".md")) {
        const raw = await readFile(filePath, "utf-8");
        const rendered = `<div class="markdown-body">${renderMarkdown(raw)}</div>`;
        const sidebar = docsMode ? docsSidebarHtml(await getMdFiles(), requestPath) : undefined;
        const name = filePath.split("/").pop() || requestPath;
        return c.html(makePage(rendered, name, requestPath, sidebar));
      }

      // Static file: stream it
      const mimeType = getMimeType(filePath);
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new Response(webStream, {
        headers: { "Content-Type": mimeType },
      });
    } catch {
      const content = notFoundHtml(requestPath);
      const sidebar = docsMode ? docsSidebarHtml(await getMdFiles(), requestPath) : undefined;
      return c.html(makePage(content, "404", requestPath, sidebar), 404);
    }
  });

  // Invalidate md file cache when watcher fires (for docs mode sidebar)
  if (watcher && docsMode) {
    const origHandleChange = watcher.handleChange.bind(watcher);
    watcher.handleChange = (filename: string) => {
      if (filename.endsWith(".md")) mdFileCache = null;
      origHandleChange(filename);
    };
  }

  return app;
}
