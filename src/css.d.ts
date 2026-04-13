declare module "*.css" {
  const content: string;
  export default content;
}

declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";
  const taskLists: MarkdownIt.PluginSimple;
  export default taskLists;
}
