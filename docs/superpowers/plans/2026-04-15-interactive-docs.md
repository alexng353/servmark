# Interactive Docs Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible sidebar, clickable breadcrumbs, unified sticky header, persistent checkboxes with drag-reorder, and inline markdown comments to servmark's docs mode.

**Architecture:** Server-side HTML rendering via Hono + markdown-it stays unchanged. New POST endpoints handle file mutations (checkbox toggle, reorder, comment CRUD). A custom markdown-it plugin parses `{::comment}` blocks. All browser interactivity is vanilla JS inlined in the page template.

**Tech Stack:** Hono (routing), markdown-it (custom plugin), Node.js fs (file mutations), HTML Drag and Drop API, CSS transitions, SSE (existing live reload)

**Spec:** `docs/superpowers/specs/2026-04-15-interactive-docs-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/templates.ts` | Modify | breadcrumbHtml(), unified header layout, sidebar toggle script, checkbox/reorder/comment client JS |
| `src/style.css` | Modify | breadcrumb styles, sticky header, sidebar collapse animation, comment card/gutter/highlight styles, grip handle styles |
| `src/server.ts` | Modify | POST endpoints for checkbox/reorder/comment, JSON body parsing |
| `src/render.ts` | Modify | Register comment plugin, pass source line map option |
| `src/comment-plugin.ts` | Create | Custom markdown-it block plugin for `{::comment}` blocks |
| `src/mutations.ts` | Create | File mutation logic: toggleCheckbox, reorderTaskItem, createComment, updateComment, deleteComment |
| `tests/breadcrumb.test.ts` | Create | breadcrumbHtml() unit tests |
| `tests/comment-plugin.test.ts` | Create | Comment parsing and rendering tests |
| `tests/mutations.test.ts` | Create | File mutation logic tests |
| `tests/server.test.ts` | Modify | Add integration tests for POST endpoints |

---

## Task 1: Clickable Breadcrumbs

**Files:**
- Modify: `src/templates.ts:140` (header rendering)
- Modify: `src/style.css:99-112` (header title styles)
- Create: `tests/breadcrumb.test.ts`

- [ ] **Step 1: Write failing tests for breadcrumbHtml()**

Create `tests/breadcrumb.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { breadcrumbHtml } from "../src/templates.js";

describe("breadcrumbHtml", () => {
  it("renders root path with just servmark link", () => {
    const html = breadcrumbHtml("/");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).not.toContain("breadcrumb-current");
  });

  it("renders single file at root", () => {
    const html = breadcrumbHtml("/readme.md");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).toContain("breadcrumb-sep");
    expect(html).toContain('<span class="breadcrumb-current">readme.md</span>');
  });

  it("renders nested path with clickable intermediate segments", () => {
    const html = breadcrumbHtml("/docs/guides/setup.md");
    expect(html).toContain('<a href="/">servmark</a>');
    expect(html).toContain('<a href="/docs/">docs</a>');
    expect(html).toContain('<a href="/docs/guides/">guides</a>');
    expect(html).toContain('<span class="breadcrumb-current">setup.md</span>');
  });

  it("renders directory path", () => {
    const html = breadcrumbHtml("/docs/guides/");
    expect(html).toContain('<a href="/docs/">docs</a>');
    expect(html).toContain('<span class="breadcrumb-current">guides</span>');
  });

  it("escapes HTML in path segments", () => {
    const html = breadcrumbHtml("/docs/<script>/file.md");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/breadcrumb.test.ts`
Expected: FAIL — `breadcrumbHtml` is not exported from `../src/templates.js`

- [ ] **Step 3: Implement breadcrumbHtml() in templates.ts**

Add the following function to `src/templates.ts` (after the `escapeHtml` function) and add it to exports:

```typescript
export function breadcrumbHtml(currentPath: string): string {
  const segments = currentPath.split("/").filter(Boolean);
  const parts: string[] = ['<a href="/">servmark</a>'];

  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const href = "/" + segments.slice(0, i + 1).join("/") + (isLast && segments[i].includes(".") ? "" : "/");

    parts.push('<span class="breadcrumb-sep">/</span>');
    if (isLast) {
      parts.push(`<span class="breadcrumb-current">${escapeHtml(segments[i])}</span>`);
    } else {
      parts.push(`<a href="${escapeHtml(href)}">${escapeHtml(segments[i])}</a>`);
    }
  }

  return `<span class="breadcrumb">${parts.join("")}</span>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/breadcrumb.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Replace header title with breadcrumb in pageLayout()**

In `src/templates.ts`, update both the docs-mode and non-docs-mode branches of `pageLayout()`.

Replace the non-docs header (line ~140):
```html
<div class="page-header-title"><a href="/">servmark</a> · ${escapeHtml(options.currentPath || "/")}</div>
```
with:
```html
<div class="page-header-left">${breadcrumbHtml(options.currentPath || "/")}</div>
```

The docs-mode branch will be updated in Task 2.

- [ ] **Step 6: Add breadcrumb CSS**

In `src/style.css`, replace the `.page-header-title` rules (lines ~99-112) with:

```css
.page-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb a {
  color: var(--text-secondary);
  cursor: pointer;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--text);
  text-decoration: underline;
}

.breadcrumb-sep {
  color: var(--text-tertiary);
  margin: 0 4px;
  flex-shrink: 0;
}

.breadcrumb-current {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 7: Run full test suite and verify nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS. Some server tests check for header content — verify they still pass or update assertions if they relied on the old `·` separator format.

- [ ] **Step 8: Commit**

```bash
git add src/templates.ts src/style.css tests/breadcrumb.test.ts
git commit -m "feat: clickable breadcrumbs in page header"
```

---

## Task 2: Unified Sticky Header + Collapsible Sidebar

**Files:**
- Modify: `src/templates.ts:101-149` (pageLayout function)
- Modify: `src/style.css:86-420` (header, sidebar, docs-layout styles)

- [ ] **Step 1: Restructure docs-mode HTML in pageLayout()**

In `src/templates.ts`, replace the docs-mode branch of `pageLayout()` (the `if (options.docsMode && options.sidebar)` block) with:

```typescript
if (options.docsMode && options.sidebar) {
  return `${head}
<body>
  <header class="page-header">
    <div class="page-header-left">
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      ${breadcrumbHtml(options.currentPath || "/")}
    </div>
    ${themeToggleButton()}
  </header>
  <div class="docs-layout" id="docs-layout">
    <nav class="docs-sidebar" id="docs-sidebar">
      <ul class="sidebar-list">
        ${options.sidebar}
      </ul>
    </nav>
    <main class="docs-content">
      <div id="content">${options.content}</div>
    </main>
  </div>
  ${sidebarToggleScript()}
  ${themeToggleScript()}
  ${options.liveReload ? liveReloadScript() : ""}
</body>
</html>`;
}
```

Also update the non-docs branch to use the new `page-header-left` wrapper (if not already done in Task 1):

```typescript
return `${head}
<body>
  <header class="page-header">
    <div class="page-header-left">
      ${breadcrumbHtml(options.currentPath || "/")}
    </div>
    ${themeToggleButton()}
  </header>
  <main class="page-content">
    <div id="content">${options.content}</div>
  </main>
  ${themeToggleScript()}
  ${options.liveReload ? liveReloadScript() : ""}
</body>
</html>`;
```

- [ ] **Step 2: Add sidebarToggleScript() function**

Add to `src/templates.ts` alongside the other script functions:

```typescript
function sidebarToggleScript(): string {
  return `<script>
(function(){
  var layout=document.getElementById("docs-layout");
  var btn=document.getElementById("sidebar-toggle");
  var key="servmark-sidebar";
  if(localStorage.getItem(key)==="collapsed"){
    layout.classList.add("sidebar-collapsed");
  }
  btn.addEventListener("click",function(){
    layout.classList.toggle("sidebar-collapsed");
    localStorage.setItem(key,layout.classList.contains("sidebar-collapsed")?"collapsed":"open");
  });
})();
</script>`;
}
```

- [ ] **Step 3: Update CSS — sticky header**

In `src/style.css`, update the `.page-header` rule to add sticky positioning:

```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 100;
}
```

- [ ] **Step 4: Update CSS — sidebar toggle button**

Add to `src/style.css`:

```css
.sidebar-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--hover-bg);
  color: var(--text);
}
```

- [ ] **Step 5: Update CSS — sidebar collapse animation and content centering**

Update the docs-layout section of `src/style.css`:

```css
.docs-layout {
  display: flex;
  height: calc(100vh - 49px); /* viewport minus sticky header */
}

.docs-sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.2s ease, margin 0.2s ease;
}

.sidebar-collapsed .docs-sidebar {
  transform: translateX(-100%);
  margin-right: -280px;
}

.docs-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  display: flex;
  justify-content: center;
}

.docs-content #content {
  max-width: 960px;
  width: 100%;
}

.docs-content .markdown-body {
  max-width: 960px;
}
```

Remove the old `.sidebar-header` CSS rules since the header is no longer inside the sidebar.

- [ ] **Step 6: Update responsive CSS**

Update the responsive section:

```css
@media (max-width: 768px) {
  .page-content {
    padding: 20px 16px;
  }

  .docs-sidebar {
    width: 220px;
    min-width: 220px;
  }

  .sidebar-collapsed .docs-sidebar {
    margin-right: -220px;
  }

  .docs-content {
    padding: 20px 16px;
  }

  .dir-listing .date-cell {
    display: none;
  }
}
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS. Server tests that check docs-mode HTML may need assertion updates if they check for `.sidebar-header` or the old layout structure.

- [ ] **Step 8: Build and manually verify in browser**

Run: `npm run build && node dist/cli.js --docs .`
Verify:
1. Sticky header with breadcrumbs + theme toggle
2. Hamburger button visible in docs mode
3. Clicking hamburger slides sidebar off-screen
4. Clicking again slides it back
5. Sidebar state persists across page navigation
6. Content is centered in the main area
7. Non-docs mode has no hamburger but still has breadcrumbs + sticky header

- [ ] **Step 9: Commit**

```bash
git add src/templates.ts src/style.css
git commit -m "feat: unified sticky header with collapsible sidebar"
```

---

## Task 3: Checkbox Toggle Persistence — Server Mutations

**Files:**
- Create: `src/mutations.ts`
- Create: `tests/mutations.test.ts`

- [ ] **Step 1: Write failing tests for toggleCheckbox()**

Create `tests/mutations.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { toggleCheckbox } from "../src/mutations.js";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "servmark-mut-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("toggleCheckbox", () => {
  it("checks an unchecked box by index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await toggleCheckbox(file, 1, true);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] first\n- [x] second\n- [ ] third\n");
  });

  it("unchecks a checked box by index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [x] first\n- [x] second\n");
    await toggleCheckbox(file, 0, false);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] first\n- [x] second\n");
  });

  it("handles indented checkboxes", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] top\n  - [ ] nested\n  - [ ] nested2\n");
    await toggleCheckbox(file, 1, true);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] top\n  - [x] nested\n  - [ ] nested2\n");
  });

  it("handles mixed content around checkboxes", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "# Title\n\nSome text\n\n- [ ] task one\n- [x] task two\n\nMore text\n");
    await toggleCheckbox(file, 0, true);
    const result = await readFile(file, "utf-8");
    expect(result).toContain("- [x] task one");
    expect(result).toContain("- [x] task two");
  });

  it("throws on invalid index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] only one\n");
    await expect(toggleCheckbox(file, 5, true)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mutations.test.ts`
Expected: FAIL — `toggleCheckbox` is not exported from `../src/mutations.js`

- [ ] **Step 3: Implement toggleCheckbox()**

Create `src/mutations.ts`:

```typescript
import { readFile, writeFile } from "node:fs/promises";

const CHECKBOX_RE = /- \[([ x])\]/g;

export async function toggleCheckbox(
  filePath: string,
  index: number,
  checked: boolean
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  let matchIndex = 0;
  const result = content.replace(CHECKBOX_RE, (match) => {
    if (matchIndex++ === index) {
      return checked ? "- [x]" : "- [ ]";
    }
    return match;
  });

  if (matchIndex <= index) {
    throw new Error(`Checkbox index ${index} out of range (found ${matchIndex})`);
  }

  await writeFile(filePath, result, "utf-8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mutations.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/mutations.ts tests/mutations.test.ts
git commit -m "feat: toggleCheckbox file mutation"
```

---

## Task 4: Checkbox Toggle Persistence — Server Endpoint + Client JS

**Files:**
- Modify: `src/server.ts:77-237` (add POST endpoint)
- Modify: `src/templates.ts` (add checkbox client JS)
- Modify: `tests/server.test.ts` (integration test)

- [ ] **Step 1: Write failing integration test for POST /__servmark/checkbox**

Add to `tests/server.test.ts`:

```typescript
describe("checkbox endpoint", () => {
  it("toggles a checkbox in a markdown file", async () => {
    await writeFile(join(testDir, "tasks.md"), "- [ ] first\n- [ ] second\n");
    const app = makeApp();
    const res = await app.request("/__servmark/checkbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/tasks.md", index: 1, checked: true }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    const content = await readFile(join(testDir, "tasks.md"), "utf-8");
    expect(content).toBe("- [ ] first\n- [x] second\n");
  });

  it("rejects path traversal in checkbox endpoint", async () => {
    const app = makeApp();
    const res = await app.request("/__servmark/checkbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/../../../etc/passwd", index: 0, checked: true }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — 404 (no POST route exists)

- [ ] **Step 3: Add POST /__servmark/checkbox endpoint to server.ts**

In `src/server.ts`, add the import for `toggleCheckbox` and add the endpoint before the catch-all `GET /*` route:

```typescript
import { toggleCheckbox } from "./mutations.js";
```

Add inside `createApp()`, after the content endpoint:

```typescript
  // Checkbox toggle endpoint
  app.post("/__servmark/checkbox", async (c) => {
    const body = await c.req.json<{ path: string; index: number; checked: boolean }>();
    const filePath = resolveSafe(body.path);
    if (!filePath) return c.json({ error: "Forbidden" }, 403);
    if (!filePath.endsWith(".md")) return c.json({ error: "Not a markdown file" }, 400);

    try {
      await toggleCheckbox(filePath, body.index, body.checked);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Add client-side checkbox script to templates.ts**

Add a new function `checkboxScript()` in `src/templates.ts`:

```typescript
function checkboxScript(): string {
  return `<script>
(function(){
  var suppressed=null;
  document.getElementById("content").addEventListener("change",function(e){
    if(e.target.tagName!=="INPUT"||e.target.type!=="checkbox")return;
    var boxes=document.querySelectorAll('#content .task-list-item input[type="checkbox"]');
    var idx=-1;
    for(var i=0;i<boxes.length;i++){if(boxes[i]===e.target){idx=i;break}}
    if(idx<0)return;
    suppressed=Date.now();
    fetch("/__servmark/checkbox",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:decodeURIComponent(window.location.pathname),index:idx,checked:e.target.checked})
    });
  });
  window.__smSuppressed=function(){
    if(suppressed&&Date.now()-suppressed<500){suppressed=null;return true}
    return false;
  };
})();
</script>`;
}
```

Include this script in the pageLayout output (both modes) after the theme toggle script, and only when `liveReload` is true or unconditionally (checkboxes should work even without live reload). Include it unconditionally in the page output.

- [ ] **Step 6: Update live reload script to check suppression**

Update `liveReloadScript()` to check the suppression flag:

```typescript
function liveReloadScript(): string {
  return `<script>
(function(){
  var es=new EventSource("/__servmark/events");
  es.onmessage=function(e){
    if(window.__smSuppressed&&window.__smSuppressed())return;
    var d=JSON.parse(e.data);
    var cur=decodeURIComponent(window.location.pathname);
    if("/"+d.path===cur||d.path===cur){
      fetch("/__servmark/content?path="+encodeURIComponent(cur))
        .then(function(r){return r.text()})
        .then(function(html){
          var el=document.getElementById("content");
          if(el)el.innerHTML=html;
        });
    }
  };
})();
</script>`;
}
```

- [ ] **Step 7: Remove disabled attribute from checkboxes**

The `markdown-it-task-lists` plugin renders checkboxes with `disabled` by default. Pass `{ enabled: true }` to remove it. In `src/render.ts`, update the plugin registration:

```typescript
md.use(taskLists, { enabled: true });
```

If this option doesn't work (the plugin API may vary), add a post-processing step in the checkbox client script instead — query all `.task-list-item input[type="checkbox"]` and call `removeAttribute("disabled")` on each.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 9: Build and test in browser**

Run: `npm run build && node dist/cli.js --docs .`
Create a test markdown file with checkboxes. Verify clicking a checkbox persists the change to disk.

- [ ] **Step 10: Commit**

```bash
git add src/server.ts src/templates.ts src/render.ts tests/server.test.ts
git commit -m "feat: clickable checkboxes with server persistence"
```

---

## Task 5: Drag-to-Reorder Task List Items — Server Mutations

**Files:**
- Modify: `src/mutations.ts`
- Modify: `tests/mutations.test.ts`

- [ ] **Step 1: Write failing tests for reorderTaskItem()**

Add to `tests/mutations.test.ts`:

```typescript
import { toggleCheckbox, reorderTaskItem } from "../src/mutations.js";

describe("reorderTaskItem", () => {
  it("moves an item down within a list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await reorderTaskItem(file, 0, 0, 2);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] second\n- [ ] third\n- [ ] first\n");
  });

  it("moves an item up within a list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await reorderTaskItem(file, 0, 2, 0);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] third\n- [ ] first\n- [ ] second\n");
  });

  it("preserves content around the task list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "# Title\n\n- [ ] a\n- [ ] b\n\nFooter\n");
    await reorderTaskItem(file, 0, 0, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("# Title\n\n- [ ] b\n- [ ] a\n\nFooter\n");
  });

  it("handles multiple separate task lists (listIndex)", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] a\n- [ ] b\n\nText\n\n- [ ] c\n- [ ] d\n");
    await reorderTaskItem(file, 1, 0, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] a\n- [ ] b\n\nText\n\n- [ ] d\n- [ ] c\n");
  });

  it("throws on invalid listIndex", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] only\n");
    await expect(reorderTaskItem(file, 5, 0, 0)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mutations.test.ts`
Expected: FAIL — `reorderTaskItem` is not exported

- [ ] **Step 3: Implement reorderTaskItem()**

Add to `src/mutations.ts`:

```typescript
interface TaskListGroup {
  startLineIndex: number;
  lines: string[];
}

function findTaskLists(lines: string[]): TaskListGroup[][] {
  const lists: TaskListGroup[][] = [];
  let currentList: TaskListGroup[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*- \[([ x])\]/.test(line)) {
      if (!currentList) {
        currentList = [];
      }
      currentList.push({ startLineIndex: i, lines: [line] });
    } else if (currentList && /^\s{2,}/.test(line) && !/^\s*- /.test(line)) {
      // Continuation line (indented, not a new list item)
      currentList[currentList.length - 1].lines.push(line);
    } else {
      if (currentList && currentList.length > 0) {
        lists.push(currentList);
      }
      currentList = null;
    }
  }
  if (currentList && currentList.length > 0) {
    lists.push(currentList);
  }

  return lists;
}

export async function reorderTaskItem(
  filePath: string,
  listIndex: number,
  fromIndex: number,
  toIndex: number
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const lists = findTaskLists(lines);

  if (listIndex >= lists.length) {
    throw new Error(`List index ${listIndex} out of range (found ${lists.length} lists)`);
  }

  const list = lists[listIndex];
  if (fromIndex >= list.length || toIndex >= list.length) {
    throw new Error(`Item index out of range`);
  }

  // Remove the item from its original position
  const [item] = list.splice(fromIndex, 1);
  // Insert at new position
  list.splice(toIndex, 0, item);

  // Rebuild the file: replace the lines occupied by this task list
  const firstLine = lists[listIndex][0].startLineIndex;
  const origList = findTaskLists(content.split("\n"))[listIndex];
  const lastItem = origList[origList.length - 1];
  const lastLine = lastItem.startLineIndex + lastItem.lines.length - 1;
  const lineCount = lastLine - firstLine + 1;

  const newListLines = list.flatMap((item) => item.lines);
  lines.splice(firstLine, lineCount, ...newListLines);

  await writeFile(filePath, lines.join("\n"), "utf-8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mutations.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/mutations.ts tests/mutations.test.ts
git commit -m "feat: reorderTaskItem file mutation"
```

---

## Task 6: Drag-to-Reorder — Server Endpoint + Client JS

**Files:**
- Modify: `src/server.ts` (add POST endpoint)
- Modify: `src/templates.ts` (add reorder client JS + grip icon)
- Modify: `src/style.css` (grip handle styles)
- Modify: `tests/server.test.ts` (integration test)

- [ ] **Step 1: Write failing integration test**

Add to `tests/server.test.ts`:

```typescript
describe("reorder endpoint", () => {
  it("reorders task items in a markdown file", async () => {
    await writeFile(join(testDir, "tasks.md"), "- [ ] first\n- [ ] second\n- [ ] third\n");
    const app = makeApp();
    const res = await app.request("/__servmark/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/tasks.md", listIndex: 0, fromIndex: 0, toIndex: 2 }),
    });
    expect(res.status).toBe(200);
    const content = await readFile(join(testDir, "tasks.md"), "utf-8");
    expect(content).toBe("- [ ] second\n- [ ] third\n- [ ] first\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — 404

- [ ] **Step 3: Add POST /__servmark/reorder endpoint**

In `src/server.ts`, add import for `reorderTaskItem` and add the endpoint:

```typescript
import { toggleCheckbox, reorderTaskItem } from "./mutations.js";
```

```typescript
  // Reorder task list items endpoint
  app.post("/__servmark/reorder", async (c) => {
    const body = await c.req.json<{ path: string; listIndex: number; fromIndex: number; toIndex: number }>();
    const filePath = resolveSafe(body.path);
    if (!filePath) return c.json({ error: "Forbidden" }, 403);
    if (!filePath.endsWith(".md")) return c.json({ error: "Not a markdown file" }, 400);

    try {
      await reorderTaskItem(filePath, body.listIndex, body.fromIndex, body.toIndex);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Add grip handle + drag-to-reorder client JS**

Add to `src/templates.ts` a `reorderScript()` function. This is the most complex client-side script. The Lucide `grip-vertical` SVG is inlined:

```typescript
function reorderScript(): string {
  return `<script>
(function(){
  var GRIP='<span class="grip-handle" draggable="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>';
  var content=document.getElementById("content");

  function initGrips(){
    var items=content.querySelectorAll(".task-list-item");
    items.forEach(function(item){
      if(item.querySelector(".grip-handle"))return;
      item.style.position="relative";
      item.insertAdjacentHTML("afterbegin",GRIP);
    });
  }
  initGrips();

  var dragItem=null;
  var dragList=null;

  content.addEventListener("dragstart",function(e){
    var grip=e.target.closest(".grip-handle");
    if(!grip)return;
    dragItem=grip.closest(".task-list-item");
    dragList=dragItem.closest("ul");
    dragItem.classList.add("dragging");
    e.dataTransfer.effectAllowed="move";
  });

  content.addEventListener("dragover",function(e){
    if(!dragItem)return;
    e.preventDefault();
    var target=e.target.closest(".task-list-item");
    if(!target||target===dragItem||target.closest("ul")!==dragList)return;
    var rect=target.getBoundingClientRect();
    var mid=rect.top+rect.height/2;
    if(e.clientY<mid){
      dragList.insertBefore(dragItem,target);
    }else{
      dragList.insertBefore(dragItem,target.nextSibling);
    }
  });

  content.addEventListener("dragend",function(){
    if(!dragItem)return;
    dragItem.classList.remove("dragging");
    // Determine listIndex, fromIndex, toIndex
    var allLists=content.querySelectorAll("ul.contains-task-list");
    var listIdx=-1;
    for(var i=0;i<allLists.length;i++){if(allLists[i]===dragList){listIdx=i;break}}
    var items=dragList.querySelectorAll(":scope > .task-list-item");
    var toIdx=-1;
    for(var i=0;i<items.length;i++){if(items[i]===dragItem){toIdx=i;break}}
    // fromIndex was stored at dragstart — we need to capture it
    // Actually, we need to store fromIndex at dragstart. Let me fix:
    if(listIdx>=0&&toIdx>=0&&window.__smDragFrom!==undefined&&window.__smDragFrom!==toIdx){
      window.__smSuppressed&&(window.__smSuppressedTs=Date.now());
      fetch("/__servmark/reorder",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({path:decodeURIComponent(window.location.pathname),listIndex:listIdx,fromIndex:window.__smDragFrom,toIndex:toIdx})
      });
    }
    dragItem=null;
    dragList=null;
    delete window.__smDragFrom;
  });

  // Capture fromIndex at drag start
  var origDragStart=content.addEventListener;
  content.addEventListener("dragstart",function(e){
    var grip=e.target.closest(".grip-handle");
    if(!grip)return;
    var item=grip.closest(".task-list-item");
    var list=item.closest("ul");
    var items=list.querySelectorAll(":scope > .task-list-item");
    for(var i=0;i<items.length;i++){if(items[i]===item){window.__smDragFrom=i;break}}
  });
})();
</script>`;
}
```

Note: the double `dragstart` listener is messy. Clean this up to a single listener that captures `fromIndex`:

```typescript
function reorderScript(): string {
  return `<script>
(function(){
  var GRIP='<span class="grip-handle" draggable="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>';
  var content=document.getElementById("content");

  function initGrips(){
    var items=content.querySelectorAll(".task-list-item");
    items.forEach(function(li){
      if(li.querySelector(".grip-handle"))return;
      li.style.position="relative";
      li.insertAdjacentHTML("afterbegin",GRIP);
    });
  }
  initGrips();

  var dragItem=null,dragList=null,fromIdx=-1;

  content.addEventListener("dragstart",function(e){
    var grip=e.target.closest(".grip-handle");
    if(!grip){e.preventDefault();return}
    dragItem=grip.closest(".task-list-item");
    dragList=dragItem.closest("ul");
    var siblings=dragList.querySelectorAll(":scope > .task-list-item");
    for(var i=0;i<siblings.length;i++){if(siblings[i]===dragItem){fromIdx=i;break}}
    dragItem.classList.add("dragging");
    e.dataTransfer.effectAllowed="move";
  });

  content.addEventListener("dragover",function(e){
    if(!dragItem)return;
    e.preventDefault();
    var target=e.target.closest(".task-list-item");
    if(!target||target===dragItem||target.closest("ul")!==dragList)return;
    var rect=target.getBoundingClientRect();
    if(e.clientY<rect.top+rect.height/2){
      dragList.insertBefore(dragItem,target);
    }else{
      dragList.insertBefore(dragItem,target.nextSibling);
    }
  });

  content.addEventListener("dragend",function(){
    if(!dragItem)return;
    dragItem.classList.remove("dragging");
    var allLists=content.querySelectorAll("ul.contains-task-list");
    var listIdx=-1;
    for(var i=0;i<allLists.length;i++){if(allLists[i]===dragList){listIdx=i;break}}
    var siblings=dragList.querySelectorAll(":scope > .task-list-item");
    var toIdx=-1;
    for(var i=0;i<siblings.length;i++){if(siblings[i]===dragItem){toIdx=i;break}}
    if(listIdx>=0&&toIdx>=0&&fromIdx!==toIdx){
      if(window.__smSuppressed)window.__smSuppressed();
      var suppressed=Date.now();
      var origSup=window.__smSuppressed;
      window.__smSuppressed=function(){if(Date.now()-suppressed<500){window.__smSuppressed=origSup;return true}return origSup?origSup():false};
      fetch("/__servmark/reorder",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({path:decodeURIComponent(window.location.pathname),listIndex:listIdx,fromIndex:fromIdx,toIndex:toIdx})
      });
    }
    dragItem=null;dragList=null;fromIdx=-1;
  });
})();
</script>`;
}
```

Include this script in `pageLayout()` output for both modes.

- [ ] **Step 6: Add grip handle CSS**

Add to `src/style.css`:

```css
.grip-handle {
  display: none;
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  cursor: grab;
  color: var(--text-tertiary);
  padding: 2px;
  border-radius: 3px;
}

.grip-handle:hover {
  color: var(--text-secondary);
  background: var(--hover-bg);
}

.task-list-item:hover .grip-handle {
  display: flex;
}

.task-list-item.dragging {
  opacity: 0.4;
}
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Build and test in browser**

Run: `npm run build && node dist/cli.js --docs .`
Create a test file with multiple checkboxes. Verify:
1. Grip handles appear on hover
2. Dragging reorders items visually
3. Reorder persists to file on disk

- [ ] **Step 9: Commit**

```bash
git add src/server.ts src/templates.ts src/style.css tests/server.test.ts
git commit -m "feat: drag-to-reorder task list items"
```

---

## Task 7: Markdown Comment Plugin — Parsing

**Files:**
- Create: `src/comment-plugin.ts`
- Create: `tests/comment-plugin.test.ts`
- Modify: `src/render.ts`

- [ ] **Step 1: Write failing tests for comment parsing**

Create `tests/comment-plugin.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { initRenderer, renderMarkdown } from "../src/render.js";

beforeAll(async () => {
  await initRenderer();
});

describe("comment plugin parsing", () => {
  it("parses a basic comment block", () => {
    const md = `{::comment}
relativeLines: +0..=0
---
A note about this line
{:/comment}
Hello world`;
    const html = renderMarkdown(md);
    expect(html).toContain("sm-comment");
    expect(html).toContain("A note about this line");
    expect(html).toContain("Hello world");
  });

  it("does not render the comment delimiters or frontmatter as text", () => {
    const md = `{::comment}
relativeLines: +0..=0
---
My note
{:/comment}
Content`;
    const html = renderMarkdown(md);
    expect(html).not.toContain("{::comment}");
    expect(html).not.toContain("{:/comment}");
    expect(html).not.toContain("relativeLines:");
  });

  it("parses multi-line range", () => {
    const md = `{::comment}
relativeLines: +0..=2
---
Covers three lines
{:/comment}
Line one
Line two
Line three
Line four`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-lines="0,1,2"');
  });

  it("parses discontinuous ranges", () => {
    const md = `{::comment}
relativeLines: +0..=0, +3..=4
---
Note
{:/comment}
First
Skip
Skip
Fourth
Fifth`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-lines="0,3,4"');
  });

  it("handles multiline comment body", () => {
    const md = `{::comment}
relativeLines: +0..=0
---
First paragraph.

Second paragraph.
{:/comment}
Content`;
    const html = renderMarkdown(md);
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });

  it("assigns sequential comment IDs", () => {
    const md = `{::comment}
relativeLines: +0..=0
---
First comment
{:/comment}
Line A

{::comment}
relativeLines: +0..=0
---
Second comment
{:/comment}
Line B`;
    const html = renderMarkdown(md);
    expect(html).toContain('data-comment-id="0"');
    expect(html).toContain('data-comment-id="1"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/comment-plugin.test.ts`
Expected: FAIL — comment blocks render as literal text

- [ ] **Step 3: Implement the comment plugin**

Create `src/comment-plugin.ts`:

```typescript
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

function parseFrontmatter(text: string): { relativeLines: number[]; body: string } {
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

  md.block.ruler.before("fence", "comment_block", (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean => {
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
      contentLines.push(state.src.slice(state.bMarks[i], state.eMarks[i]));
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
  });

  md.renderer.rules["comment_block"] = (tokens: Token[], idx: number): string => {
    const meta = tokens[idx].meta as CommentMeta;
    const linesAttr = meta.relativeLines.join(",");
    // Render body as markdown (simple inline rendering)
    const bodyHtml = md.renderInline(meta.body);

    return `<div class="sm-comment" data-lines="${linesAttr}" data-comment-id="${meta.commentIndex}">
  <div class="sm-comment-body">${bodyHtml}</div>
</div>\n`;
  };
}
```

- [ ] **Step 4: Register the plugin in render.ts**

Update `src/render.ts`:

```typescript
import MarkdownIt from "markdown-it";
import Shiki from "@shikijs/markdown-it";
import taskLists from "markdown-it-task-lists";
import { commentPlugin } from "./comment-plugin.js";

let md: MarkdownIt;

export async function initRenderer(): Promise<void> {
  md = MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  md.use(taskLists);
  md.use(commentPlugin);

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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/comment-plugin.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/comment-plugin.ts src/render.ts tests/comment-plugin.test.ts
git commit -m "feat: markdown-it comment block plugin"
```

---

## Task 8: Comment Rendering — CSS + Client-Side Highlighting

**Files:**
- Modify: `src/style.css` (comment card + highlight styles)
- Modify: `src/templates.ts` (add comment highlight JS + source line data attributes)
- Modify: `src/render.ts` (add source line attributes to block elements)

- [ ] **Step 1: Add data-source-line attributes to rendered HTML**

markdown-it tokens have a `map` property with `[startLine, endLine]`. We need a renderer rule that adds `data-source-line` to block-level elements. In `src/render.ts`, after the plugin registrations, add:

```typescript
// After md.use(...) calls, add source line attribute injection
const defaultRender = md.renderer.rules.paragraph_open ||
  function(tokens, idx, options, env, self) { return self.renderToken(tokens, idx, options); };

for (const rule of ["paragraph_open", "heading_open", "bullet_list_open", "ordered_list_open", "blockquote_open", "table_open", "hr"]) {
  const original = md.renderer.rules[rule];
  md.renderer.rules[rule] = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    if (token.map && token.map[0] !== null) {
      token.attrSet("data-source-line", String(token.map[0]));
    }
    if (original) return original(tokens, idx, options, env, self);
    return self.renderToken(tokens, idx, options);
  };
}
```

- [ ] **Step 2: Add comment card CSS**

Add to `src/style.css`:

```css
/* ============================================
   Markdown Comments
   ============================================ */

.sm-comment {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.sm-comment:hover {
  border-color: var(--link);
}

.sm-comment.highlight {
  border-color: var(--link);
  box-shadow: 0 0 0 2px var(--sidebar-active);
}

.sm-comment-body p {
  margin-bottom: 4px;
}

.sm-comment-body p:last-child {
  margin-bottom: 0;
}

.sm-highlighted {
  border-left: 4px solid var(--link);
  padding-left: 12px;
  margin-left: -16px;
  transition: background 0.2s;
}

.sm-highlighted.flash {
  background: var(--sidebar-active);
}
```

- [ ] **Step 3: Add comment highlight client JS**

Add to `src/templates.ts` a `commentHighlightScript()` function:

```typescript
function commentHighlightScript(): string {
  return `<script>
(function(){
  var content=document.getElementById("content");
  if(!content)return;

  // Find all comment cards and build a map of comment-id -> highlighted elements
  function initHighlights(){
    var comments=content.querySelectorAll(".sm-comment");
    comments.forEach(function(card){
      var id=card.getAttribute("data-comment-id");
      var lines=card.getAttribute("data-lines");
      if(!lines)return;
      var lineNums=lines.split(",").map(Number);

      // Find elements after this comment card that correspond to the relative lines
      // Walk forward from the comment card through sibling elements
      var sibling=card.nextElementSibling;
      var relIdx=0;
      var highlighted=[];
      while(sibling&&relIdx<=Math.max.apply(null,lineNums)){
        if(lineNums.indexOf(relIdx)>=0){
          sibling.classList.add("sm-highlighted");
          sibling.setAttribute("data-comment-id",id);
          highlighted.push(sibling);
        }
        relIdx++;
        sibling=sibling.nextElementSibling;
      }

      // Hover interactions
      card.addEventListener("mouseenter",function(){
        highlighted.forEach(function(el){el.classList.add("flash")});
      });
      card.addEventListener("mouseleave",function(){
        highlighted.forEach(function(el){el.classList.remove("flash")});
      });
      highlighted.forEach(function(el){
        el.addEventListener("mouseenter",function(){card.classList.add("highlight")});
        el.addEventListener("mouseleave",function(){card.classList.remove("highlight")});
      });
    });
  }
  initHighlights();
})();
</script>`;
}
```

Include this script in `pageLayout()` output for both modes.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Build and test in browser**

Run: `npm run build && node dist/cli.js --docs .`
Create a test markdown file with comment blocks. Verify:
1. Comment cards render above highlighted lines
2. Highlighted lines have left bar
3. Hovering the bar flashes the comment card
4. Hovering the card flashes the highlighted lines

- [ ] **Step 6: Commit**

```bash
git add src/style.css src/templates.ts src/render.ts
git commit -m "feat: comment rendering with highlight interactions"
```

---

## Task 9: Comment CRUD — Server Mutations

**Files:**
- Modify: `src/mutations.ts`
- Modify: `tests/mutations.test.ts`

- [ ] **Step 1: Write failing tests for comment mutations**

Add to `tests/mutations.test.ts`:

```typescript
import { toggleCheckbox, reorderTaskItem, createComment, updateComment, deleteComment } from "../src/mutations.js";

describe("createComment", () => {
  it("inserts a comment block before the target line", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "Line zero\nLine one\nLine two\n");
    await createComment(file, 1, 2, "A note about these lines");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("{::comment}");
    expect(result).toContain("relativeLines: +0..=1");
    expect(result).toContain("A note about these lines");
    expect(result).toContain("{:/comment}");
    // The original lines should still be there
    expect(result).toContain("Line one");
    expect(result).toContain("Line two");
  });

  it("calculates correct relative lines for single line", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "A\nB\nC\n");
    await createComment(file, 0, 0, "About A");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("relativeLines: +0..=0");
  });
});

describe("updateComment", () => {
  it("replaces the body of an existing comment", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "{::comment}\nrelativeLines: +0..=0\n---\nOld body\n{:/comment}\nContent\n");
    await updateComment(file, 0, "New body");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("New body");
    expect(result).not.toContain("Old body");
    expect(result).toContain("relativeLines: +0..=0");
  });
});

describe("deleteComment", () => {
  it("removes an entire comment block", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "Before\n{::comment}\nrelativeLines: +0..=0\n---\nA note\n{:/comment}\nContent\nAfter\n");
    await deleteComment(file, 0);
    const result = await readFile(file, "utf-8");
    expect(result).not.toContain("{::comment}");
    expect(result).not.toContain("A note");
    expect(result).toContain("Before");
    expect(result).toContain("Content");
    expect(result).toContain("After");
  });

  it("removes the correct comment when multiple exist", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "{::comment}\nrelativeLines: +0..=0\n---\nFirst\n{:/comment}\nA\n{::comment}\nrelativeLines: +0..=0\n---\nSecond\n{:/comment}\nB\n");
    await deleteComment(file, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toContain("First");
    expect(result).not.toContain("Second");
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mutations.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement comment mutations**

Add to `src/mutations.ts`:

```typescript
interface CommentBlock {
  startLine: number;  // line index of {::comment}
  endLine: number;    // line index of {:/comment}
  separatorLine: number; // line index of ---
}

function findCommentBlocks(lines: string[]): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "{::comment}") {
      let separatorLine = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === "---" && separatorLine === -1) {
          separatorLine = j;
        }
        if (lines[j].trim() === "{:/comment}") {
          blocks.push({ startLine: i, endLine: j, separatorLine });
          break;
        }
      }
    }
  }
  return blocks;
}

export async function createComment(
  filePath: string,
  startLine: number,
  endLine: number,
  body: string
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const rangeLength = endLine - startLine;
  const commentBlock = [
    "{::comment}",
    `relativeLines: +0..=${rangeLength}`,
    "---",
    body,
    "{:/comment}",
  ];

  lines.splice(startLine, 0, ...commentBlock);
  await writeFile(filePath, lines.join("\n"), "utf-8");
}

export async function updateComment(
  filePath: string,
  commentIndex: number,
  body: string
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const blocks = findCommentBlocks(lines);

  if (commentIndex >= blocks.length) {
    throw new Error(`Comment index ${commentIndex} out of range (found ${blocks.length})`);
  }

  const block = blocks[commentIndex];
  // Replace everything between separator and closing tag
  const newLines = [
    ...lines.slice(0, block.separatorLine + 1),
    body,
    ...lines.slice(block.endLine),
  ];

  await writeFile(filePath, newLines.join("\n"), "utf-8");
}

export async function deleteComment(
  filePath: string,
  commentIndex: number
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const blocks = findCommentBlocks(lines);

  if (commentIndex >= blocks.length) {
    throw new Error(`Comment index ${commentIndex} out of range (found ${blocks.length})`);
  }

  const block = blocks[commentIndex];
  lines.splice(block.startLine, block.endLine - block.startLine + 1);

  await writeFile(filePath, lines.join("\n"), "utf-8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mutations.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/mutations.ts tests/mutations.test.ts
git commit -m "feat: comment CRUD file mutations"
```

---

## Task 10: Comment CRUD — Server Endpoint

**Files:**
- Modify: `src/server.ts`
- Modify: `tests/server.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add to `tests/server.test.ts`:

```typescript
import { readFile } from "node:fs/promises";

describe("comment endpoint", () => {
  it("creates a comment in a markdown file", async () => {
    await writeFile(join(testDir, "doc.md"), "Line zero\nLine one\nLine two\n");
    const app = makeApp();
    const res = await app.request("/__servmark/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/doc.md", startLine: 0, endLine: 0, body: "A note" }),
    });
    expect(res.status).toBe(200);
    const content = await readFile(join(testDir, "doc.md"), "utf-8");
    expect(content).toContain("{::comment}");
    expect(content).toContain("A note");
  });

  it("updates an existing comment", async () => {
    await writeFile(
      join(testDir, "doc.md"),
      "{::comment}\nrelativeLines: +0..=0\n---\nOld\n{:/comment}\nContent\n"
    );
    const app = makeApp();
    const res = await app.request("/__servmark/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/doc.md", commentIndex: 0, body: "New" }),
    });
    expect(res.status).toBe(200);
    const content = await readFile(join(testDir, "doc.md"), "utf-8");
    expect(content).toContain("New");
    expect(content).not.toContain("Old");
  });

  it("deletes a comment", async () => {
    await writeFile(
      join(testDir, "doc.md"),
      "{::comment}\nrelativeLines: +0..=0\n---\nGone\n{:/comment}\nContent\n"
    );
    const app = makeApp();
    const res = await app.request("/__servmark/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/doc.md", commentIndex: 0, delete: true }),
    });
    expect(res.status).toBe(200);
    const content = await readFile(join(testDir, "doc.md"), "utf-8");
    expect(content).not.toContain("{::comment}");
    expect(content).toContain("Content");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server.test.ts`
Expected: FAIL — 404

- [ ] **Step 3: Add POST /__servmark/comment endpoint**

In `src/server.ts`, add imports and endpoint:

```typescript
import { toggleCheckbox, reorderTaskItem, createComment, updateComment, deleteComment } from "./mutations.js";
```

```typescript
  // Comment CRUD endpoint
  app.post("/__servmark/comment", async (c) => {
    const body = await c.req.json<{
      path: string;
      startLine?: number;
      endLine?: number;
      body?: string;
      commentIndex?: number;
      delete?: boolean;
    }>();

    const filePath = resolveSafe(body.path);
    if (!filePath) return c.json({ error: "Forbidden" }, 403);
    if (!filePath.endsWith(".md")) return c.json({ error: "Not a markdown file" }, 400);

    try {
      if (body.delete && body.commentIndex !== undefined) {
        await deleteComment(filePath, body.commentIndex);
      } else if (body.commentIndex !== undefined && body.body !== undefined) {
        await updateComment(filePath, body.commentIndex, body.body);
      } else if (body.startLine !== undefined && body.endLine !== undefined && body.body !== undefined) {
        await createComment(filePath, body.startLine, body.endLine, body.body);
      } else {
        return c.json({ error: "Invalid request" }, 400);
      }
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.ts tests/server.test.ts
git commit -m "feat: comment CRUD server endpoint"
```

---

## Task 11: Comment Creation UI — Gutter Drag + Editor

**Files:**
- Modify: `src/style.css` (gutter, editor styles)
- Modify: `src/templates.ts` (comment creation JS)

- [ ] **Step 1: Add comment gutter + drag selection CSS**

Add to `src/style.css`:

```css
/* ============================================
   Comment Gutter
   ============================================ */

.markdown-body {
  position: relative;
}

.sm-gutter {
  position: absolute;
  left: -20px;
  top: 0;
  width: 16px;
  height: 100%;
  cursor: crosshair;
  opacity: 0;
  transition: opacity 0.15s;
}

.markdown-body:hover .sm-gutter {
  opacity: 1;
}

.sm-gutter-selection {
  position: absolute;
  left: -20px;
  width: 4px;
  background: var(--link);
  border-radius: 2px;
  opacity: 0.6;
  pointer-events: none;
}

/* Comment Editor */

.sm-comment-editor {
  background: var(--bg-secondary);
  border: 1px solid var(--link);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.sm-comment-editor textarea {
  width: 100%;
  min-height: 60px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
}

.sm-comment-editor-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.sm-comment-editor-actions button {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--border);
}

.sm-btn-save {
  background: var(--link);
  color: #fff;
  border-color: var(--link) !important;
}

.sm-btn-save:hover {
  opacity: 0.9;
}

.sm-btn-cancel {
  background: var(--bg);
  color: var(--text-secondary);
}

.sm-btn-cancel:hover {
  background: var(--hover-bg);
}

.sm-btn-delete {
  background: none;
  color: var(--danger);
  border-color: var(--danger) !important;
  margin-right: auto;
}

.sm-btn-delete:hover {
  background: var(--danger);
  color: #fff;
}
```

- [ ] **Step 2: Add comment creation + editing client JS**

Add to `src/templates.ts` a `commentEditorScript()` function:

```typescript
function commentEditorScript(): string {
  return `<script>
(function(){
  var content=document.getElementById("content");
  if(!content)return;
  var mdBody=content.querySelector(".markdown-body");
  if(!mdBody)return;

  // Add gutter element
  var gutter=document.createElement("div");
  gutter.className="sm-gutter";
  mdBody.appendChild(gutter);

  var selecting=false,startEl=null,endEl=null,selBar=null;

  function getBlockElements(){
    return Array.from(mdBody.querySelectorAll("[data-source-line]"));
  }

  function getBlockAtY(y){
    var blocks=getBlockElements();
    for(var i=0;i<blocks.length;i++){
      var r=blocks[i].getBoundingClientRect();
      if(y>=r.top&&y<=r.bottom)return blocks[i];
    }
    return null;
  }

  gutter.addEventListener("mousedown",function(e){
    var block=getBlockAtY(e.clientY);
    if(!block)return;
    selecting=true;
    startEl=block;
    endEl=block;
    selBar=document.createElement("div");
    selBar.className="sm-gutter-selection";
    mdBody.appendChild(selBar);
    updateSelBar();
    e.preventDefault();
  });

  document.addEventListener("mousemove",function(e){
    if(!selecting)return;
    var block=getBlockAtY(e.clientY);
    if(block)endEl=block;
    updateSelBar();
  });

  document.addEventListener("mouseup",function(){
    if(!selecting)return;
    selecting=false;
    if(selBar){selBar.remove();selBar=null}
    if(!startEl||!endEl)return;
    var startLine=parseInt(startEl.getAttribute("data-source-line"));
    var endLine=parseInt(endEl.getAttribute("data-source-line"));
    if(startLine>endLine){var t=startLine;startLine=endLine;endLine=t;var te=startEl;startEl=endEl;endEl=te}
    showEditor(null,startEl,startLine,endLine);
    startEl=null;endEl=null;
  });

  function updateSelBar(){
    if(!selBar||!startEl||!endEl)return;
    var r1=startEl.getBoundingClientRect();
    var r2=endEl.getBoundingClientRect();
    var top=Math.min(r1.top,r2.top);
    var bot=Math.max(r1.bottom,r2.bottom);
    var pr=mdBody.getBoundingClientRect();
    selBar.style.top=(top-pr.top)+"px";
    selBar.style.height=(bot-top)+"px";
  }

  function showEditor(commentId,beforeEl,startLine,endLine){
    var existing=mdBody.querySelector(".sm-comment-editor");
    if(existing)existing.remove();
    var editor=document.createElement("div");
    editor.className="sm-comment-editor";
    var isEdit=commentId!==null;
    var body="";
    if(isEdit){
      var card=mdBody.querySelector('.sm-comment[data-comment-id="'+commentId+'"]');
      if(card)body=card.querySelector(".sm-comment-body").textContent.trim();
    }
    editor.innerHTML='<textarea placeholder="Add a comment...">'+body+'</textarea><div class="sm-comment-editor-actions">'
      +(isEdit?'<button class="sm-btn-delete">Delete</button>':'')
      +'<button class="sm-btn-cancel">Cancel</button><button class="sm-btn-save">'+(isEdit?"Save":"Add")+'</button></div>';
    beforeEl.parentNode.insertBefore(editor,beforeEl);
    editor.querySelector("textarea").focus();

    editor.querySelector(".sm-btn-cancel").addEventListener("click",function(){editor.remove()});
    editor.querySelector(".sm-btn-save").addEventListener("click",function(){
      var text=editor.querySelector("textarea").value.trim();
      if(!text){editor.remove();return}
      var payload=isEdit
        ?{path:decodeURIComponent(window.location.pathname),commentIndex:parseInt(commentId),body:text}
        :{path:decodeURIComponent(window.location.pathname),startLine:startLine,endLine:endLine,body:text};
      fetch("/__servmark/comment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
        .then(function(){location.reload()});
    });
    if(isEdit){
      editor.querySelector(".sm-btn-delete").addEventListener("click",function(){
        fetch("/__servmark/comment",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({path:decodeURIComponent(window.location.pathname),commentIndex:parseInt(commentId),delete:true})})
          .then(function(){location.reload()});
      });
    }
  }

  // Click existing comment to edit
  mdBody.addEventListener("click",function(e){
    var card=e.target.closest(".sm-comment");
    if(!card)return;
    var id=card.getAttribute("data-comment-id");
    showEditor(id,card,null,null);
  });
})();
</script>`;
}
```

Include this script in `pageLayout()` output for both modes.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Build and test in browser**

Run: `npm run build && node dist/cli.js --docs .`
Verify:
1. Gutter appears on hover along left edge of markdown content
2. Click-drag on gutter selects a range (blue bar)
3. Releasing opens an editor above the selection
4. Typing a comment and clicking "Add" persists to file and re-renders
5. Clicking an existing comment card opens edit mode
6. Delete button removes the comment
7. Cancel dismisses the editor

- [ ] **Step 5: Commit**

```bash
git add src/style.css src/templates.ts
git commit -m "feat: comment creation and editing UI"
```

---

## Task 12: Final Integration + Polish

**Files:**
- Modify: `src/templates.ts` (wire all scripts together)
- Run full test suite

- [ ] **Step 1: Ensure all scripts are included in pageLayout()**

Review `src/templates.ts` `pageLayout()` to make sure both the docs-mode and non-docs-mode branches include all the new scripts in the correct order:

1. `sidebarToggleScript()` — only in docs mode
2. `themeToggleScript()` — both modes
3. `checkboxScript()` — both modes
4. `reorderScript()` — both modes
5. `commentHighlightScript()` — both modes
6. `commentEditorScript()` — both modes
7. `liveReloadScript()` — both modes (when enabled)

The live reload script must be last because the other scripts set up the `__smSuppressed` function it checks.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Build and run comprehensive browser test**

Run: `npm run build && node dist/cli.js --docs .`

Test checklist:
1. Breadcrumbs: all segments clickable, correct links, hover underline
2. Sticky header: stays at top on scroll
3. Sidebar toggle: slides in/out, state persists across pages
4. Content centering: centered in docs mode with and without sidebar
5. Checkboxes: click toggles and persists to disk
6. Drag reorder: grip handles, drag works, persists to disk
7. Comments: create via gutter drag, edit, delete, hover highlighting
8. Theme toggle: works in both modes
9. Live reload: file edits in editor trigger content refresh
10. Non-docs mode: breadcrumbs work, no sidebar toggle, no sidebar

- [ ] **Step 4: Lint and format**

Run the project's linter/formatter if configured:
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "feat: wire all interactive docs features together"
```
