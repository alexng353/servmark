import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type Token from "markdown-it/lib/token.mjs";
import { fencedLineIndices } from "./fence.js";

interface CommentMeta {
  relativeLines: number[];
  placeholder: string | null;
  body: string;
  commentIndex: number;
}

function parseRelativeLines(value: string): number[] {
  const lines: number[] = [];
  const ranges = value.split(",").map((s) => s.trim());
  for (const range of ranges) {
    const match = range.match(/^\+(\d+)\.\.\=(\d+)$/);
    if (!match) continue;
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    for (let i = start; i <= end; i++) {
      lines.push(i);
    }
  }
  return lines;
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

function parseFrontmatter(text: string): {
  relativeLines: number[];
  placeholder: string | null;
  body: string;
} {
  const sepIndex = text.indexOf("---");
  if (sepIndex === -1) {
    return { relativeLines: [], placeholder: null, body: text.trim() };
  }
  const frontmatter = text.slice(0, sepIndex).trim();
  const body = text.slice(sepIndex + 3).trim();

  let relativeLines: number[] = [];
  const lineMatch = frontmatter.match(/^\s*relativeLines:\s*(.+)$/m);
  if (lineMatch) {
    relativeLines = parseRelativeLines(lineMatch[1].trim());
  }

  let placeholder: string | null = null;
  const placeholderMatch = frontmatter.match(/^\s*placeholder:\s*(.+)$/m);
  if (placeholderMatch) {
    placeholder = unquote(placeholderMatch[1].trim());
  }

  return { relativeLines, placeholder, body };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function commentPlugin(md: MarkdownIt): void {
  let commentCount = 0;

  // Reset counter on each render
  const originalRender = md.render.bind(md);
  md.render = (src: string, env?: object): string => {
    commentCount = 0;
    return originalRender(src, env);
  };

  md.block.ruler.before(
    "fence",
    "comment_block",
    (
      state: StateBlock,
      startLine: number,
      endLine: number,
      silent: boolean,
    ): boolean => {
      const startPos = state.bMarks[startLine] + state.tShift[startLine];
      const startMax = state.eMarks[startLine];
      const lineText = state.src.slice(startPos, startMax).trim();

      if (lineText !== "{::comment}") return false;
      if (silent) return true;

      // Find closing tag — skip {:/comment} markers that appear inside
      // fenced code blocks (e.g. example syntax in the comment body).
      const allLines = state.src.split("\n");
      const fenced = fencedLineIndices(allLines);
      let closeLine = -1;
      for (let i = startLine + 1; i < endLine; i++) {
        if (fenced.has(i)) continue;
        const pos = state.bMarks[i] + state.tShift[i];
        const max = state.eMarks[i];
        const line = state.src.slice(pos, max).trim();
        if (line === "{:/comment}") {
          closeLine = i;
          break;
        }
      }
      if (closeLine === -1) return false;

      // Extract content between delimiters
      const contentLines: string[] = [];
      for (let i = startLine + 1; i < closeLine; i++) {
        contentLines.push(
          state.src.slice(state.bMarks[i], state.eMarks[i]),
        );
      }
      const raw = contentLines.join("\n");
      const { relativeLines, placeholder, body } = parseFrontmatter(raw);

      const token = state.push("comment_block", "", 0);
      token.meta = {
        relativeLines,
        placeholder,
        body,
        commentIndex: commentCount++,
      } as CommentMeta;
      token.map = [startLine, closeLine + 1];

      state.line = closeLine + 1;
      return true;
    },
  );

  md.renderer.rules["comment_block"] = (
    tokens: Token[],
    idx: number,
  ): string => {
    const token = tokens[idx];
    const meta = token.meta as CommentMeta;
    const linesAttr = meta.relativeLines.join(",");
    // The anchor — relative offset 0 corresponds to the line directly after
    // {:/comment}, which is token.map[1] from the block ruler above.
    const anchorLine = token.map ? token.map[1] : 0;
    // Render the body as block-level markdown so paragraphs, lists, and other
    // block constructs work. Use originalRender to bypass the wrapper that
    // resets the comment counter on each render call.
    const isEmpty = meta.body.trim() === "";
    const bodyInner =
      isEmpty && meta.placeholder
        ? `<p class="sm-comment-placeholder">${escapeHtml(meta.placeholder)}</p>`
        : originalRender(meta.body);
    const placeholderAttr = meta.placeholder
      ? ` data-placeholder="${escapeHtml(meta.placeholder)}"`
      : "";

    return `<div class="sm-comment" data-source-line="${anchorLine}" data-lines="${linesAttr}" data-comment-id="${meta.commentIndex}"${placeholderAttr}>\n  <div class="sm-comment-body">${bodyInner}</div>\n</div>\n`;
  };
}
