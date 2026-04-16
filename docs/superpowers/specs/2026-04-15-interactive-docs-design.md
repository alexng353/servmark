# Interactive Docs Features — Design Spec

**Date:** 2026-04-15
**Scope:** 5 features for servmark's docs mode and general page layout

---

## 1. Clickable Breadcrumbs

### Summary

The header path display (`servmark · /specs/file.md`) becomes a series of clickable segments where each directory component links to its listing page.

### Rendering

New function `breadcrumbHtml(currentPath: string)` in `templates.ts` splits the path into segments:

```html
<span class="breadcrumb">
  <a href="/">servmark</a>
  <span class="breadcrumb-sep">/</span>
  <a href="/specs/">specs</a>
  <span class="breadcrumb-sep">/</span>
  <span class="breadcrumb-current">file.md</span>
</span>
```

- `servmark` always links to `/` (root)
- Each intermediate directory segment links to that directory's listing
- Last segment (current file or directory) is a plain `<span>`, not a link
- Separator character: `/`

### Styling

```css
.breadcrumb a {
  color: var(--text-secondary);
  cursor: pointer;
}
.breadcrumb a:hover {
  color: var(--text);
  text-decoration: underline;
}
.breadcrumb-sep {
  color: var(--text-tertiary);
  margin: 0 4px;
}
.breadcrumb-current {
  color: var(--text-secondary);
}
```

### Usage

The breadcrumb component is used in both docs mode and non-docs mode header bars, replacing the current plain-text path display.

---

## 2. Unified Sticky Header + Collapsible Sidebar

### Summary

Docs mode currently has no proper header bar — the "servmark" title and theme toggle live inside the sidebar header. This design unifies the header across both modes and makes the sidebar collapsible.

### Layout (docs mode, sidebar open)

```
┌──────────────────────────────────────────────────┐
│ [☰]  servmark / specs / file.md           [🌙]  │  ← sticky header
├──────┬───────────────────────────────────────────┤
│ nav  │                                           │
│ list │       centered content (max 960px)        │
│      │                                           │
└──────┴───────────────────────────────────────────┘
```

### Layout (docs mode, sidebar collapsed)

```
┌──────────────────────────────────────────────────┐
│ [☰]  servmark / specs / file.md           [🌙]  │  ← sticky header
├──────────────────────────────────────────────────┤
│                                                  │
│            centered content (max 960px)          │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Structural Changes

The header moves **out of the sidebar** and becomes a top-level sticky element spanning full width. Both modes share the same `.page-header` element.

**Docs mode HTML:**

```html
<body>
  <header class="page-header">
    <div class="page-header-left">
      <button class="sidebar-toggle" id="sidebar-toggle">☰</button>
      <span class="breadcrumb">...</span>
    </div>
    <button class="theme-toggle">...</button>
  </header>
  <div class="docs-layout">
    <nav class="docs-sidebar">
      <ul class="sidebar-list">...</ul>
    </nav>
    <main class="docs-content">
      <div id="content">...</div>
    </main>
  </div>
</body>
```

**Non-docs mode HTML:**

```html
<body>
  <header class="page-header">
    <div class="page-header-left">
      <span class="breadcrumb">...</span>
    </div>
    <button class="theme-toggle">...</button>
  </header>
  <main class="page-content">
    <div id="content">...</div>
  </main>
</body>
```

The only difference is the presence of the `sidebar-toggle` button and the `docs-layout` wrapper.

### Sidebar Collapse Behavior

- Clicking `sidebar-toggle` toggles a `sidebar-collapsed` class on `.docs-layout`
- Sidebar slides off-screen: `transform: translateX(-100%)` with `transition: transform 0.2s ease`
- Content area expands to fill the full width
- A floating toggle button remains visible in the sticky header to re-open
- State persisted in `localStorage("servmark-sidebar")` — remembered across reloads and page navigations

### Sticky Header CSS

```css
.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
}
```

### Content Centering in Docs Mode

The `.docs-content` area gets the same centering treatment as `.page-content` in non-docs mode:

```css
.docs-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}
.docs-content .markdown-body {
  max-width: 960px;
  width: 100%;
}
```

Content is always centered in the available space, whether the sidebar is open or closed.

---

## 3. Clickable Checkboxes with Persistence

### Summary

Task list checkboxes (`- [ ]` / `- [x]`) become interactive — clicking toggles the state and persists the change back to the markdown file on disk.

### Frontend

- The existing `markdown-it-task-lists` plugin renders `<input type="checkbox">` elements
- Remove the `disabled` attribute so they're clickable
- Add a click event listener that identifies the checkbox by its **0-based index** in DOM order (counting all task list checkboxes)
- On click: `POST /__servmark/checkbox` with `{ path, index, checked }`
- Optimistic UI: checkbox toggles immediately, no round-trip wait

### Server Endpoint

`POST /__servmark/checkbox`

```typescript
interface CheckboxRequest {
  path: string;     // file path, e.g. "/todo.md"
  index: number;    // 0-based index of the checkbox in source order
  checked: boolean; // new state
}
```

1. Read the raw markdown file
2. Find the nth occurrence of `- [ ]` or `- [x]` (matching the index, regardless of indentation)
3. Replace with the toggled state (`- [ ]` ↔ `- [x]`)
4. Write the file back to disk
5. Return `{ ok: true }`

### SSE Suppression

The file write triggers the file watcher, which would cause a live-reload SSE event. To prevent the toggling client from re-fetching (which would cause a jarring re-render and scroll reset), the client ignores SSE events for the current path within a 500ms window after a checkbox toggle.

### Index Mapping

The regex matches `- [ ]` and `- [x]` regardless of indentation depth. The positional index maps 1:1 to DOM order because markdown-it renders checkboxes in source order.

---

## 4. Drag-to-Reorder Task List Items

### Summary

Task list items get a drag handle (Lucide `grip-vertical` icon) for reordering within a contiguous list.

### Frontend

- Each task list item (`.task-list-item`) gets a grip handle SVG prepended, visible on hover
- Uses native HTML Drag and Drop API: `draggable`, `dragstart`, `dragover`, `drop`
- Visual feedback during drag: dragged item at reduced opacity, horizontal insertion line at drop target
- On drop: reorder in DOM immediately (optimistic), then `POST /__servmark/reorder`

### Server Endpoint

`POST /__servmark/reorder`

```typescript
interface ReorderRequest {
  path: string;      // file path
  fromIndex: number; // source position (0-based among task list items in the same list)
  toIndex: number;   // destination position (0-based, same list)
  listIndex: number; // which contiguous task list (0-based, in document order)
}
```

1. Read raw markdown
2. Identify all task list item lines (including any sub-items/continuation lines that belong to each item)
3. Move the full line group from `fromIndex` to `toIndex`
4. Write file back
5. Return `{ ok: true }`

### Scope Constraint

Only task list items within the **same contiguous list** are reorderable. You cannot drag a checkbox from one list into a different list.

### SSE Suppression

Same 500ms suppression window as checkbox toggle.

---

## 5. Markdown Comments

### Summary

A custom comment syntax that allows annotating specific lines of a markdown file. Comments are stored inline in the markdown source, rendered in the browser with visual indicators, and can be created/edited/deleted from the browser UI.

### Syntax

```markdown
{::comment}
relativeLines: +0..=2
---
This API is deprecated, use v2 instead.

Multiline comments work fine here.
{:/comment}
The first highlighted line (relative +0)
The second highlighted line (relative +1)
The third highlighted line (relative +2)
This line is not highlighted.
```

**Delimiters:** `{::comment}` / `{:/comment}` — borrowed from Kramdown's extension syntax, no conflict with standard markdown.

**Frontmatter** (above `---`):
- `relativeLines`: specifies which lines after the comment block are highlighted
  - `+0..=2` — lines 0, 1, 2 relative to the comment's closing tag (inclusive end, `=` required)
  - `+5..=5` — single line
  - `+0..=1, +4..=6` — discontinuous ranges

**Body** (below `---`): the comment content, arbitrary markdown rendered as markdown.

### Parsing

Custom markdown-it block-level plugin:

1. Match `{::comment}` as opening delimiter
2. Consume lines until `{:/comment}`
3. Parse frontmatter: extract `relativeLines` value
4. Parse body: everything between `---` and `{:/comment}`
5. Emit a `comment_block` token with metadata: `{ relativeLines: Array<[start, end]>, body: string, commentIndex: number }`

### Rendering

The comment renders as a card above the highlighted lines:

```html
<div class="sm-comment" data-lines="0,1,2" data-comment-id="0">
  <div class="sm-comment-body">
    <p>This API is deprecated, use v2 instead.</p>
    <p>Multiline comments work fine here.</p>
  </div>
</div>
```

The highlighted lines get wrapped/annotated with `data-comment-id` attributes and a left-bar visual indicator.

### Highlight Styling

- Highlighted lines: `border-left: 4px solid var(--link)` with left padding
- Hovering over the left bar: flashes a highlight (background pulse) on the corresponding comment card
- Hovering over the comment card: highlights the left bar more prominently
- CSS transitions for both hover directions

### Comment Card Styling

- Background: `var(--bg-secondary)`
- Small font size, left-aligned with content
- Subtle border and rounded corners
- Collapsible (click to expand/collapse body)

### Creating Comments from the Browser

1. A thin gutter runs along the left edge of the content area, invisible until hover
2. User clicks and drags vertically on the gutter to select a range of rendered lines
3. During drag: translucent blue selection bar along the gutter
4. On release: comment editor appears above the selected lines (textarea for comment body)
5. Submit: `POST /__servmark/comment` with `{ path, startLine, endLine, body }`
   - `startLine` / `endLine` are **source line numbers** (from `data-source-line` attributes on rendered block elements, provided by markdown-it's `token.map`)
6. Server inserts a `{::comment}...{:/comment}` block at the correct position, calculating `relativeLines` based on insertion point

### Editing and Deleting

- Clicking a comment card opens edit mode (same textarea UI)
- Update: `POST /__servmark/comment` with `{ path, commentIndex, body }`
- Delete: `POST /__servmark/comment` with `{ path, commentIndex, delete: true }`

### Server Endpoint

`POST /__servmark/comment`

```typescript
// Create
interface CommentCreate {
  path: string;
  startLine: number;  // source line number (0-based)
  endLine: number;    // source line number (0-based, inclusive)
  body: string;
}

// Update
interface CommentUpdate {
  path: string;
  commentIndex: number;
  body: string;
}

// Delete
interface CommentDelete {
  path: string;
  commentIndex: number;
  delete: true;
}
```

**Create flow:**
1. Read the raw markdown
2. Insert `{::comment}...{:/comment}` block immediately before `startLine`
3. Calculate `relativeLines` — the distance from the end of the inserted block to the target lines
4. Write file back

**Update flow:**
1. Find the nth `{::comment}...{:/comment}` block
2. Replace the body content (between `---` and `{:/comment}`)
3. Write file back

**Delete flow:**
1. Find the nth `{::comment}...{:/comment}` block
2. Remove the entire block
3. Write file back

### Source Line Mapping

markdown-it provides `token.map` giving `[startLine, endLine]` for block-level tokens. The renderer outputs `data-source-line="N"` attributes on block-level HTML elements. This lets browser JS map DOM positions back to source line numbers for comment creation.

---

## Shared Infrastructure

### New Server Endpoints Summary

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/__servmark/checkbox` | Toggle checkbox state |
| `POST` | `/__servmark/reorder` | Reorder task list items |
| `POST` | `/__servmark/comment` | Create/update/delete comments |

All endpoints:
- Accept JSON body
- Return `{ ok: true }` on success, `{ error: string }` on failure
- Validate that the target path is within `rootDir` (reuse `resolveSafe()`)
- Write changes to the markdown file on disk
- The file watcher picks up the change and broadcasts to other connected clients

### SSE Suppression Pattern

All write-back features (checkbox, reorder, comment) use the same client-side pattern: after initiating a write, ignore SSE events for the current path within a 500ms window to prevent self-triggered re-renders.

### Dependencies

No new npm packages required. The features use:
- Existing `markdown-it` (custom plugin for comments)
- Existing `markdown-it-task-lists` (checkbox rendering)
- Native HTML Drag and Drop API (reorder)
- Lucide `grip-vertical` SVG (inlined, no package needed)
- Existing Hono routing (new POST endpoints)
- Existing `fs` read/write (file mutations)
