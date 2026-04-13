import MarkdownIt from "markdown-it";
import Shiki from "@shikijs/markdown-it";
import taskLists from "markdown-it-task-lists";

let md: MarkdownIt;

export async function initRenderer(): Promise<void> {
  md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  md.use(taskLists);

  md.use(
    await Shiki({
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
    })
  );
}

export function renderMarkdown(content: string): string {
  return md.render(content);
}
