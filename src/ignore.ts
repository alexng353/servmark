import { readFileSync } from "node:fs";
import { join } from "node:path";
import picomatch from "picomatch";

const IGNORE_FILES = [".gitignore", ".ignore", ".smignore"];

// Editor temp/backup files that should always be ignored
const BUILTIN_PATTERNS = [
  "**/*~",        // backup files (vim, neovim, emacs)
  "**/*.swp",     // vim swap
  "**/*.swo",     // vim swap
  "**/*.tmp",     // generic temp files
  "**/.#*",       // emacs lockfiles
  "**/__jb_*",    // jetbrains temp files
  "**/*__jb_tmp__",
];

interface IgnoreRule {
  negated: boolean;
  match: (path: string) => boolean;
}

function parseIgnoreFile(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (let line of content.split("\n")) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }

    // Check for slash presence before any stripping.
    // A trailing-only slash (e.g. "dist/") means directory,
    // but the pattern is still just a bare name without path separators.
    const dirOnly = line.endsWith("/");
    const raw = dirOnly ? line.slice(0, -1) : line;

    // A pattern "contains a slash" if it has a `/` that isn't just
    // a leading slash or the trailing one we already stripped.
    // e.g. "src/foo" has a slash, "dist" does not, "/build" does (leading = anchored).
    const anchored = raw.startsWith("/") || raw.includes("/");
    const stripped = raw.startsWith("/") ? raw.slice(1) : raw;

    const patterns: string[] = [];

    if (anchored) {
      // Anchored to root: match exactly at this path
      patterns.push(stripped);
      if (dirOnly) {
        // Directory pattern: also match everything inside
        patterns.push(`${stripped}/**`);
      }
    } else {
      // Bare name: match in any directory
      patterns.push(`**/${stripped}`);
      // Also match as a directory with contents (e.g. "node_modules" matches "node_modules/foo")
      patterns.push(`**/${stripped}/**`);
      // Also match at root level
      patterns.push(stripped);
      patterns.push(`${stripped}/**`);
    }

    const matchers = patterns.map((p) => picomatch(p, { dot: true }));
    rules.push({
      negated,
      match: (path: string) => matchers.some((m) => m(path)),
    });
  }
  return rules;
}

export function loadIgnoreRules(rootDir: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];

  // Built-in patterns first
  for (const pattern of BUILTIN_PATTERNS) {
    rules.push({
      negated: false,
      match: picomatch(pattern, { dot: true }),
    });
  }

  // Load ignore files
  for (const filename of IGNORE_FILES) {
    try {
      const content = readFileSync(join(rootDir, filename), "utf-8");
      rules.push(...parseIgnoreFile(content));
    } catch {
      // file doesn't exist, skip
    }
  }

  return rules;
}

export function isIgnored(filename: string, rules: IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.match(filename)) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}
