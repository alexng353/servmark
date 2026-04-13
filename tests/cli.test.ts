import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("returns defaults with no args", () => {
    const opts = parseCliArgs([]);
    expect(opts.port).toBe(3000);
    expect(opts.docsMode).toBe(false);
    expect(opts.theme).toBe("auto");
    expect(opts.browser).toBe(true);
    expect(opts.liveReload).toBe(true);
    expect(opts.directory).toBe(".");
  });

  it("parses --port", () => {
    const opts = parseCliArgs(["--port", "8080"]);
    expect(opts.port).toBe(8080);
  });

  it("parses -p shorthand", () => {
    const opts = parseCliArgs(["-p", "9000"]);
    expect(opts.port).toBe(9000);
  });

  it("parses --docs", () => {
    const opts = parseCliArgs(["--docs"]);
    expect(opts.docsMode).toBe(true);
  });

  it("parses --dark", () => {
    const opts = parseCliArgs(["--dark"]);
    expect(opts.theme).toBe("dark");
  });

  it("parses --light", () => {
    const opts = parseCliArgs(["--light"]);
    expect(opts.theme).toBe("light");
  });

  it("parses --no-browser", () => {
    const opts = parseCliArgs(["--no-browser"]);
    expect(opts.browser).toBe(false);
  });

  it("parses --no-reload", () => {
    const opts = parseCliArgs(["--no-reload"]);
    expect(opts.liveReload).toBe(false);
  });

  it("parses positional directory argument", () => {
    const opts = parseCliArgs(["./my-folder"]);
    expect(opts.directory).toBe("./my-folder");
  });

  it("parses directory with flags", () => {
    const opts = parseCliArgs(["./docs", "--docs", "--port", "4000"]);
    expect(opts.directory).toBe("./docs");
    expect(opts.docsMode).toBe(true);
    expect(opts.port).toBe(4000);
  });
});
