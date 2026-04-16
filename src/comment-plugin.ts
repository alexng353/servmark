import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type Token from "markdown-it/lib/token.mjs";

interface CommentMeta {
  relativeLines: number[];
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

function parseFrontmatter(text: string): {
  relativeLines: number[];
  body: string;
} {
  const sepIndex = text.indexOf("---");
  if (sepIndex === -1) {
    return { relativeLines: [], body: text.trim() };
  }
  const frontmatter = text.slice(0, sepIndex).trim();
  const body = text.slice(sepIndex + 3).trim();

  let relativeLines: number[] = [];
  const lineMatch = frontmatter.match(/relativeLines:\s*(.+)/);
  if (lineMatch) {
    relativeLines = parseRelativeLines(lineMatch[1]);
  }

  return { relativeLines, body };
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

      // Find closing tag
      let closeLine = -1;
      for (let i = startLine + 1; i < endLine; i++) {
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
      const { relativeLines, body } = parseFrontmatter(raw);

      const token = state.push("comment_block", "", 0);
      token.meta = {
        relativeLines,
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
    const meta = tokens[idx].meta as CommentMeta;
    const linesAttr = meta.relativeLines.join(",");
    // Render body as inline markdown
    const bodyHtml = md.renderInline(meta.body);

    return `<div class="sm-comment" data-lines="${linesAttr}" data-comment-id="${meta.commentIndex}">\n  <div class="sm-comment-body">${bodyHtml}</div>\n</div>\n`;
  };
}
