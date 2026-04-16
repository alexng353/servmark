import { describe, it, expect } from "vitest";
import { breadcrumbHtml } from "../src/templates.js";

describe("breadcrumbHtml", () => {
  it("root path renders just servmark link, no breadcrumb-current", () => {
    const html = breadcrumbHtml("/");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).not.toContain("breadcrumb-current");
    expect(html).toContain('class="breadcrumb"');
  });

  it('single file "/readme.md" renders servmark link + separator + current span', () => {
    const html = breadcrumbHtml("/readme.md");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).toContain('class="breadcrumb-sep"');
    expect(html).toContain('<span class="breadcrumb-current">readme.md</span>');
  });

  it('nested path "/docs/guides/setup.md" renders clickable intermediate segments', () => {
    const html = breadcrumbHtml("/docs/guides/setup.md");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).toContain('<a href="/docs/">docs</a>');
    expect(html).toContain('<a href="/docs/guides/">guides</a>');
    expect(html).toContain(
      '<span class="breadcrumb-current">setup.md</span>'
    );
    // Should have separators between each segment
    const sepCount = (html.match(/breadcrumb-sep/g) || []).length;
    expect(sepCount).toBe(3);
  });

  it('directory path "/docs/guides/" renders with last segment as current', () => {
    const html = breadcrumbHtml("/docs/guides/");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).toContain('<a href="/docs/">docs</a>');
    expect(html).toContain(
      '<span class="breadcrumb-current">guides</span>'
    );
  });

  it("HTML in path segments is escaped", () => {
    const html = breadcrumbHtml("/<script>alert(1)</script>/foo");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain(
      '<span class="breadcrumb-current">foo</span>'
    );
  });
});
