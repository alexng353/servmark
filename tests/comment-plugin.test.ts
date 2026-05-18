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

  it("emits data-source-line on the comment card matching the line after {:/comment}", () => {
    // Block occupies source lines 0..=4 (5 lines). The anchor (relative offset 0)
    // is the line right after {:/comment}, which is line 5.
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nNote\n{:/comment}\nTarget paragraph`;
    const html = renderMarkdown(md);
    expect(html).toMatch(/<[^>]*class="sm-comment"[^>]*data-source-line="5"/);
  });

  it("renders block-level markdown in the comment body (paragraphs separated by blank lines)", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nFirst paragraph.\n\nSecond paragraph.\n{:/comment}\nContent`;
    const html = renderMarkdown(md);
    // Both paragraphs should be wrapped in their own <p> tags inside the comment body.
    expect(html).toMatch(
      /<div class="sm-comment-body">[\s\S]*<p[^>]*>First paragraph\.<\/p>[\s\S]*<p[^>]*>Second paragraph\.<\/p>[\s\S]*<\/div>/
    );
  });

  it("renders the placeholder text when the body is empty", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\nplaceholder: "Drop your answer here"\n---\n\n{:/comment}\nTarget`;
    const html = renderMarkdown(md);
    expect(html).toContain("sm-comment-placeholder");
    expect(html).toContain("Drop your answer here");
  });

  it("does not render the visible placeholder when the body is non-empty", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\nplaceholder: "Drop your answer here"\n---\nReal body\n{:/comment}\nTarget`;
    const html = renderMarkdown(md);
    // The visible placeholder paragraph should not appear...
    expect(html).not.toContain("sm-comment-placeholder");
    // ...but data-placeholder is preserved so the editor can use it.
    expect(html).toContain('data-placeholder="Drop your answer here"');
    expect(html).toContain("Real body");
  });

  it("exposes the placeholder via data-placeholder for the editor", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\nplaceholder: "Pick A, B, or C"\n---\n\n{:/comment}\nTarget`;
    const html = renderMarkdown(md);
    expect(html).toMatch(/data-placeholder="Pick A, B, or C"/);
  });

  it("accepts an unquoted placeholder value", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\nplaceholder: Drop your answer here\n---\n\n{:/comment}\nTarget`;
    const html = renderMarkdown(md);
    expect(html).toContain("Drop your answer here");
    expect(html).toContain("sm-comment-placeholder");
  });

  it("escapes HTML in the placeholder text and attribute", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\nplaceholder: "<script>x</script>"\n---\n\n{:/comment}\nTarget`;
    const html = renderMarkdown(md);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("ignores {::comment} delimiters inside a fenced code block", () => {
    const md = `Reminder:\n\n\`\`\`\n{::comment}\nrelativeLines: +0..=0\n---\nFake\n{:/comment}\n\`\`\`\n\nReal line.`;
    const html = renderMarkdown(md);
    expect(html).not.toContain("sm-comment");
  });

  it("does not prematurely close a comment at a {:/comment} embedded in a code block in the body", () => {
    const md = `{::comment}\nrelativeLines: +0..=0\n---\nReminder example:\n\n\`\`\`\n{::comment}\nrelativeLines: +0..=2\n---\nExample body\n{:/comment}\n\`\`\`\n\nReal note text.\n{:/comment}\nTarget line`;
    const html = renderMarkdown(md);
    // Exactly one rendered comment annotation, and it anchors to "Target line".
    expect((html.match(/class="sm-comment"/g) || []).length).toBe(1);
    expect(html).toContain("Real note text.");
    // The literal example markers stay inside a code block (escaped) instead
    // of leaking back into the document body.
    expect(html).not.toMatch(/<p[^>]*>Target line<\/p>[\s\S]*\{:\/comment\}/);
    expect(html).toContain("Target line");
  });
});
