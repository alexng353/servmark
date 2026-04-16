# Interactive Docs Test Page

This file exercises all the new features. Open it with `servmark --docs .`

## Checkboxes

Try clicking these to toggle them — changes persist to disk.

- [x] Buy groceries
- [x] Write tests
- [x] Read the spec
- [ ] Deploy to production
- [ ] Review PR

### Nested checkboxes

- [x] Parent task
  - [ ] Subtask A
  - [ ] Subtask B
  - [x] Subtask C (already done)

## Drag Reorder

Hover the checkboxes above to see grip handles. Drag them to reorder — the file updates on disk.

## Comments

{::comment}
relativeLines: +0..=2
---
This paragraph and the next two lines are annotated. Hover the blue bar on the left to flash this card, or hover this card to flash the bar.
{:/comment}
This is the first highlighted line. It has a blue bar on the left side indicating it's part of a comment thread.

This is the second highlighted line.

This is the third highlighted line. The comment above covers all three.

{::comment}
relativeLines: +0..=0
---
Single-line comment on the paragraph below.
{:/comment}
You can also comment on just a single paragraph like this one.

{::comment}
relativeLines: +0..=0, +2..=2
---
Discontinuous range — highlights the first and third paragraphs but skips the second.
{:/comment}
This paragraph is highlighted.

This paragraph is NOT highlighted (skipped by the range).

This paragraph IS highlighted again.

## Breadcrumbs

Look at the sticky header above — each path segment is clickable. Try clicking "servmark" to go to the root directory listing.

## Sidebar

Click the hamburger icon in the top-left to collapse/expand the sidebar. The state persists across page loads.

## Code Block

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const result = greet("world");
console.log(result);
```

## Table

| Feature | Status | Notes |
|---------|--------|-------|
| Breadcrumbs | Done | Clickable path segments |
| Sidebar | Done | Collapsible with animation |
| Checkboxes | Done | Click to toggle, persists |
| Drag reorder | Done | Grip handle on hover |
| Comments | Done | Gutter drag to create |

## Creating New Comments

To create a comment, hover near the left edge of the content area until you see a crosshair cursor. Click and drag vertically to select a range of paragraphs, then type your comment in the editor that appears.

Try it on the paragraphs below:

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
