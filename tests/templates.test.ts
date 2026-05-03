import { describe, expect, it } from "vitest";
import { pageLayout } from "../src/templates.js";

describe("pageLayout", () => {
  it("persists scroll position across comment editor reloads", () => {
    const html = pageLayout({
      title: "doc.md",
      content: `<div class="markdown-body"><div class="sm-comment" data-comment-id="0"><div class="sm-comment-body">Old</div></div></div>`,
      theme: "dark",
      liveReload: false,
      docsMode: false,
      currentPath: "/doc.md",
    });

    expect(html).toContain("servmark-comment-scroll:");
    expect(html).toContain('document.querySelector(".docs-content")||window');
    expect(html).toContain("sessionStorage.setItem(scrollKey,String(currentScrollTop()))");
    expect(html).toContain("setScrollTop(y)");
    expect(html).toContain("reloadKeepingScroll()");
  });
});
