export type FrontmatterValue = string | number | boolean | string[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export interface FrontmatterResult {
  data: FrontmatterData | null;
  body: string;
}

const FENCE_RE = /^---[ \t]*$/;

/**
 * Detects YAML-style frontmatter delimited by `---` lines at the very top of
 * the document, parses it, and returns both the parsed data and a body with
 * the frontmatter region replaced by blank lines (so downstream line numbers
 * line up with the original source — important for comment line tracking).
 */
export function extractFrontmatter(content: string): FrontmatterResult {
  const lines = content.split("\n");
  if (lines.length < 2 || !FENCE_RE.test(lines[0])) {
    return { data: null, body: content };
  }

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return { data: null, body: content };

  const fmLines = lines.slice(1, closeIdx);
  const data = parseYamlish(fmLines);
  if (!data) return { data: null, body: content };

  // Replace frontmatter region (including fences) with blank lines so that
  // line indices in the remaining body match the original file.
  const blanked = lines.slice();
  for (let i = 0; i <= closeIdx; i++) blanked[i] = "";

  return { data, body: blanked.join("\n") };
}

function parseYamlish(lines: string[]): FrontmatterData | null {
  const data: FrontmatterData = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) return null; // malformed — bail out, render as plain markdown
    const key = m[1];
    const rawValue = m[2];

    if (rawValue === "") {
      // Block-style list: subsequent indented "- item" lines
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        const listMatch = next.match(/^\s+-\s+(.*)$/);
        if (!listMatch) break;
        items.push(unquote(listMatch[1].trim()));
        j++;
      }
      if (items.length === 0) {
        data[key] = "";
      } else {
        data[key] = items;
      }
      i = j;
      continue;
    }

    data[key] = parseScalar(rawValue);
    i++;
  }
  return data;
}

function parseScalar(raw: string): FrontmatterValue {
  const trimmed = raw.trim();
  // Inline list: [a, b, c]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => unquote(s.trim()));
  }
  // Quoted strings
  const unq = unquote(trimmed);
  if (unq !== trimmed) return unq;
  // Booleans
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatValue(key: string, value: FrontmatterValue): string {
  if (Array.isArray(value)) {
    if (key === "tags" || key === "categories" || key === "keywords") {
      return value
        .map((v) => `<span class="sm-frontmatter-tag">${escapeHtml(v)}</span>`)
        .join("");
    }
    return value.map((v) => escapeHtml(String(v))).join(", ");
  }
  return escapeHtml(String(value));
}

export function renderFrontmatter(data: FrontmatterData): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return "";

  const titleRaw = data.title;
  const title =
    typeof titleRaw === "string" || typeof titleRaw === "number"
      ? String(titleRaw)
      : null;

  const metaKeys = keys.filter((k) => k !== "title");
  const rows = metaKeys
    .map((key) => {
      const value = data[key];
      const isTagList =
        Array.isArray(value) &&
        (key === "tags" || key === "categories" || key === "keywords");
      const ddClass = isTagList ? ' class="sm-frontmatter-tags"' : "";
      return `<dt>${escapeHtml(key)}</dt><dd${ddClass}>${formatValue(key, value)}</dd>`;
    })
    .join("");

  const titleHtml = title
    ? `<h1 class="sm-frontmatter-title">${escapeHtml(title)}</h1>`
    : "";
  const metaHtml = rows ? `<dl class="sm-frontmatter-meta">${rows}</dl>` : "";

  return `<header class="sm-frontmatter">${titleHtml}${metaHtml}</header>\n`;
}
