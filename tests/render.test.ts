import { describe, it, expect, beforeAll } from "vitest";
import { initRenderer, renderMarkdown } from "../src/render.js";

beforeAll(async () => {
  await initRenderer();
});

describe("renderMarkdown", () => {
  it("renders headings", () => {
    const html = renderMarkdown("# Hello");
    expect(html).toContain(">Hello</h1>");
    expect(html).toContain('data-source-line="0"');
  });

  it("renders paragraphs", () => {
    const html = renderMarkdown("Hello world");
    expect(html).toContain(">Hello world</p>");
  });

  it("renders GFM tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = renderMarkdown(md);
    expect(html).toContain("<table");
    expect(html).toContain("<td>1</td>");
  });

  it("renders strikethrough", () => {
    const html = renderMarkdown("~~deleted~~");
    expect(html).toContain("<s>deleted</s>");
  });

  it("renders task lists", () => {
    const md = "- [ ] todo\n- [x] done";
    const html = renderMarkdown(md);
    expect(html).toContain('type="checkbox"');
  });

  it("renders fenced code blocks with shiki dual themes", () => {
    const md = "```js\nconst x = 1;\n```";
    const html = renderMarkdown(md);
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-dark");
  });

  it("auto-links URLs", () => {
    const html = renderMarkdown("Visit https://example.com today");
    expect(html).toContain('href="https://example.com"');
  });
});
