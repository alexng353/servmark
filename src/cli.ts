import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { serve } from "@hono/node-server";
import { createApp } from "./server.js";
import { initRenderer } from "./render.js";
import { FileWatcher } from "./watcher.js";

export interface CliOptions {
  port: number;
  docsMode: boolean;
  theme: "dark" | "light" | "auto";
  browser: boolean;
  liveReload: boolean;
  directory: string;
}

export function parseCliArgs(args: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p", default: "3000" },
      docs: { type: "boolean", default: false },
      dark: { type: "boolean", default: false },
      light: { type: "boolean", default: false },
      browser: { type: "boolean", default: true },
      "no-browser": { type: "boolean", default: false },
      reload: { type: "boolean", default: true },
      "no-reload": { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  let theme: "dark" | "light" | "auto" = "auto";
  if (values.dark) theme = "dark";
  if (values.light) theme = "light";

  return {
    port: parseInt(values.port as string, 10),
    docsMode: values.docs as boolean,
    theme,
    browser: values["no-browser"] ? false : (values.browser as boolean),
    liveReload: values["no-reload"] ? false : (values.reload as boolean),
    directory: positionals[0] || ".",
  };
}

function findOpenPort(startPort: number): Promise<number> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.listen(startPort, () => {
      server.close(() => resolvePort(startPort));
    });
    server.on("error", () => {
      resolvePort(findOpenPort(startPort + 1));
    });
  });
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  const rootDir = resolve(opts.directory);

  await initRenderer();

  let watcher: FileWatcher | undefined;
  if (opts.liveReload) {
    watcher = new FileWatcher(rootDir);
    watcher.start();
  }

  const app = createApp({
    rootDir,
    docsMode: opts.docsMode,
    theme: opts.theme,
    liveReload: opts.liveReload,
    watcher,
  });

  const port = await findOpenPort(opts.port);

  serve({ fetch: app.fetch, port }, (info) => {
    const url = `http://localhost:${info.port}`;
    console.log(`\n  servmark serving ${rootDir}\n`);
    console.log(`  Local:  ${url}\n`);

    if (opts.browser) {
      import("open").then((mod) => mod.default(url));
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
