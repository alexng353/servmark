import MarkdownIt from "markdown-it";
import Shiki from "@shikijs/markdown-it";
import taskLists from "markdown-it-task-lists";
import { commentPlugin } from "./comment-plugin.js";
import { extractFrontmatter, renderFrontmatter } from "./frontmatter.js";

let md: MarkdownIt;

export async function initRenderer(): Promise<void> {
  md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  md.use(taskLists, { enabled: true });
  md.use(commentPlugin);

  md.use(
    await Shiki({
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
    }),
  );

  // Add source line attributes for comment highlighting
  const blockRules = [
    "paragraph_open",
    "heading_open",
    "bullet_list_open",
    "ordered_list_open",
    "blockquote_open",
    "table_open",
    "hr",
  ];
  for (const rule of blockRules) {
    const original = md.renderer.rules[rule];
    md.renderer.rules[rule] = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      if (token.map && token.map[0] !== null) {
        token.attrSet("data-source-line", String(token.map[0]));
      }
      if (original) return original(tokens, idx, options, env, self);
      return self.renderToken(tokens, idx, options);
    };
  }
}

export function renderMarkdown(content: string): string {
  const { data, body } = extractFrontmatter(content);
  const header = data ? renderFrontmatter(data) : "";
  return header + md.render(body);
}
