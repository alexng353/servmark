import { describe, it, expect, beforeAll } from "vitest";
import { initRenderer, renderMarkdown } from "../src/render.js";

beforeAll(async () => {
  await initRenderer();
});

describe("comment plugin parsing", () => {
  it("parses a basic comment block", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nA note about this line\n{:/comment}\nHello world`;
    const html = renderMarkdown(md);
    expect(html).toContain("sm-comment");
    expect(html).toContain("A note about this line");
    expect(html).toContain("Hello world");
  });

  it("does not render the comment delimiters or frontmatter as text", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nMy note\n{:/comment}\nContent`;
    const html = renderMarkdown(md);
    expect(html).not.toContain("{::comment}");
    expect(html).not.toContain("{:/comment}");
    expect(html).not.toContain("relativeLines:");
  });

  it("parses multi-line range", () => {
    const md = `{::comment}\nrelativeLines: +0..=2\n---\nCovers three lines\n{:/comment}\nLine one\nLine two\nLine three\nLine four`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-lines="0,1,2"');
  });

  it("parses discontinuous ranges", () => {
    const md = `{::comment}\nrelativeLines: +0..=0, +3..=4\n---\nNote\n{:/comment}\nFirst\nSkip\nSkip\nFourth\nFifth`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-lines="0,3,4"');
  });

  it("handles multiline comment body", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nFirst paragraph.\n\nSecond paragraph.\n{:/comment}\nContent`;
    const html = renderMarkdown(md);
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });

  it("assigns sequential comment IDs", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nFirst comment\n{:/comment}\nLine A\n\n{::comment}\nrelativeLines: +0..=0\n---\nSecond comment\n{:/comment}\nLine B`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-comment-id="0"');
    expect(html).toContain('data-comment-id="1"');
  });
});
