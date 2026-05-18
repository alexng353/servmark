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

  describe("frontmatter", () => {
    it("renders title from frontmatter, not as a setext heading", () => {
      const md =
        "---\ntitle: My Doc\nauthor: Alice\n---\n\nFirst paragraph.";
      const html = renderMarkdown(md);
      expect(html).toContain('class="sm-frontmatter"');
      expect(html).toContain('class="sm-frontmatter-title">My Doc</h1>');
      expect(html).toContain("<dt>author</dt>");
      expect(html).toContain("<dd>Alice</dd>");
      // Body should still render as a paragraph
      expect(html).toContain(">First paragraph.</p>");
      // Frontmatter should not produce a setext heading from the trailing ---
      expect(html).not.toContain(">title: My Doc");
    });

    it("renders inline tag arrays as pills", () => {
      const md = "---\ntitle: T\ntags: [a, b, c]\n---\n\nbody";
      const html = renderMarkdown(md);
      expect(html).toContain('class="sm-frontmatter-tag">a</span>');
      expect(html).toContain('class="sm-frontmatter-tag">c</span>');
    });

    it("preserves source line numbers after frontmatter", () => {
      const md = "---\ntitle: T\n---\n\n# Hello";
      const html = renderMarkdown(md);
      // # Hello is on line 4 (0-indexed) of the original source
      expect(html).toContain('data-source-line="4"');
      expect(html).toContain(">Hello</h1>");
    });

    it("leaves content alone when no frontmatter is present", () => {
      const html = renderMarkdown("# Hello");
      expect(html).not.toContain("sm-frontmatter");
      expect(html).toContain(">Hello</h1>");
    });

    it("does not render frontmatter when closing fence is missing", () => {
      const md = "---\ntitle: T\n\n# Heading";
      const html = renderMarkdown(md);
      expect(html).not.toContain("sm-frontmatter");
    });
  });
});
