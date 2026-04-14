import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadIgnoreRules, isIgnored } from "../src/ignore.js";

const TEST_DIR = join(import.meta.dirname, "__ignore_fixtures__");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("builtin patterns", () => {
  it("ignores vim backup files", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("README.md~", rules)).toBe(true);
    expect(isIgnored("src/file.ts~", rules)).toBe(true);
  });

  it("ignores vim swap files", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored(".file.swp", rules)).toBe(true);
    expect(isIgnored("src/.file.swo", rules)).toBe(true);
  });

  it("ignores tmp files", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("file.tmp", rules)).toBe(true);
  });

  it("ignores emacs lockfiles", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored(".#file.ts", rules)).toBe(true);
  });

  it("ignores jetbrains temp files", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("__jb_old__", rules)).toBe(true);
    expect(isIgnored("file__jb_tmp__", rules)).toBe(true);
  });

  it("does not ignore normal files", () => {
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("README.md", rules)).toBe(false);
    expect(isIgnored("src/index.ts", rules)).toBe(false);
  });
});

describe(".gitignore", () => {
  it("ignores files matching gitignore patterns", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "node_modules\n*.log\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("node_modules/foo/bar.js", rules)).toBe(true);
    expect(isIgnored("error.log", rules)).toBe(true);
    expect(isIgnored("src/debug.log", rules)).toBe(true);
  });

  it("handles directory patterns with trailing slash", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "dist/\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("dist/cli.js", rules)).toBe(true);
    expect(isIgnored("dist", rules)).toBe(true);
    expect(isIgnored("src/dist.ts", rules)).toBe(false);
  });

  it("handles negation", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "*.log\n!important.log\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("debug.log", rules)).toBe(true);
    expect(isIgnored("important.log", rules)).toBe(false);
  });

  it("handles leading slash as root-relative", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "/build\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("build", rules)).toBe(true);
    expect(isIgnored("build/output.js", rules)).toBe(false);
    expect(isIgnored("src/build", rules)).toBe(false);
  });

  it("ignores comments and blank lines", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "# comment\n\n*.log\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("app.log", rules)).toBe(true);
    expect(isIgnored("# comment", rules)).toBe(false);
  });
});

describe(".smignore", () => {
  it("loads .smignore rules", () => {
    writeFileSync(join(TEST_DIR, ".smignore"), "secret/\ndrafts/*.md\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("secret/keys.txt", rules)).toBe(true);
    expect(isIgnored("drafts/wip.md", rules)).toBe(true);
    expect(isIgnored("docs/final.md", rules)).toBe(false);
  });
});

describe(".ignore", () => {
  it("loads .ignore rules", () => {
    writeFileSync(join(TEST_DIR, ".ignore"), "*.bak\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("data.bak", rules)).toBe(true);
  });
});

describe("multiple ignore files", () => {
  it("merges rules from all files", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "*.log\n");
    writeFileSync(join(TEST_DIR, ".smignore"), "*.bak\n");
    const rules = loadIgnoreRules(TEST_DIR);
    expect(isIgnored("app.log", rules)).toBe(true);
    expect(isIgnored("data.bak", rules)).toBe(true);
    expect(isIgnored("index.ts", rules)).toBe(false);
  });
});
