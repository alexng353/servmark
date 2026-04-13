# servmark — Design Spec

A static file server with first-class markdown rendering, syntax highlighting, and a docs mode.

## CLI Interface

```
servmark [directory] [flags]

Arguments:
  directory        Path to serve (default: cwd)

Flags:
  --port, -p       Port number (default: 3000, auto-increments if taken)
  --docs           Enable docs mode (sidebar with markdown file list + folder browser)
  --dark           Force dark theme (this is the default if no system preference)
  --light          Force light theme
  --no-reload      Disable live reload / file watching
  --browser        Open the URL in the default browser on start (default: true)
  --no-browser     Disable auto-opening the browser
```

Distributed as an npm package with a `bin` entry. Invoked via `npx servmark`, `bunx servmark`, or installed globally.

Flag parsing uses `node:util` `parseArgs` (stable since Node 18). No manual parsing, no third-party CLI framework.

## Architecture

Single process, four modules:

### 1. CLI (`src/cli.ts`)

- Parses args and flags via `parseArgs`
- Resolves the target directory (positional arg or cwd)
- Finds an available port (tries `--port` first, then increments)
- Initializes and starts the Hono server
- Opens the browser via the `open` package unless `--no-browser`
- Prints the serving URL to stdout

### 2. Server (`src/server.ts`)

Hono application with these routes:

| Route | Purpose |
|---|---|
| `GET /*` | Main route. If path is a directory: render browsable listing. If `.md` file: render as HTML. Otherwise: serve raw file with correct MIME type. |
| `GET /__servmark/events` | SSE endpoint for live reload notifications |
| `GET /__servmark/content?path=...` | Returns only the rendered content HTML for a given path (used by the live-reload script to hot-swap content without full page reload) |
| `GET /__servmark/style.css` | Serves the stylesheet |

In docs mode (`--docs`), all HTML pages include the sidebar layout. In default mode, pages are full-width.

Path traversal outside the served directory is rejected (return 403).

### 3. Renderer (`src/render.ts`)

Responsible for producing HTML strings. No template engine — uses tagged template literals.

**Markdown rendering:**
- `markdown-it` with GFM plugins for tables, strikethrough, task lists, autolinks
- Shiki for fenced code block syntax highlighting, run server-side
- Shiki renders dual themes (`github-dark` and `github-light`) into the HTML simultaneously using CSS-based theme switching — no re-render on theme toggle

**Page types:**
- **Directory listing:** Clean table with file/folder icons, name, size, modified date. Folders sort first. Links are relative.
- **Markdown page:** Rendered prose with GitHub-flavored styling. Wrapped in the page layout (with sidebar in docs mode).
- **404 page:** Styled, themed, centered message. "Go back" button that calls `history.back()` with a fallback to `/` if there's no history.
- **Docs layout:** Sidebar (left) + content area (right). Sidebar contains a flat list of all `.md` files found recursively in the served directory.

### 4. Watcher (`src/watcher.ts`)

- Uses `fs.watch` with `{ recursive: true }` on the served directory
- Debounces rapid change events (50-100ms window)
- Maintains a set of connected SSE clients
- On file change, pushes a JSON event `{ path: "<relative-path>" }` to all clients
- Disabled when `--no-reload` is passed

## Live Reload

Client-side: a small inline `<script>` (no external JS file needed) that:

1. Opens an `EventSource` connection to `/__servmark/events`
2. On receiving a change event, checks if the changed path matches the currently viewed file
3. If it matches, fetches `/__servmark/content?path=...` and swaps the innerHTML of the content container
4. Scroll position is preserved because only the inner content div is replaced, not the full page
5. Reconnects automatically on connection drop (EventSource does this natively)

When `--no-reload` is active, the script tag is omitted entirely.

## Styling & Themes

### Theme System

Two themes controlled by a CSS class on `<html>`: `data-theme="dark"` or `data-theme="light"`.

All colors use CSS custom properties, so theme switching is instant — just swap the attribute.

**Resolution order:**
1. CLI flag (`--dark` / `--light`) sets the initial theme attribute in the served HTML
2. If no CLI flag, a small inline script checks `localStorage` for a user preference from a previous toggle
3. If no stored preference, falls back to `prefers-color-scheme` media query
4. If no system preference, defaults to dark

### Theme Toggle

A sun/moon icon button in the top-right corner of every page (default mode) or in the sidebar header (docs mode). Clicking it:
- Swaps `data-theme` on `<html>`
- Stores the choice in `localStorage`

### Color Palettes

- **Dark:** GitHub-dark-inspired. Dark background, light text, muted borders, subtle hover states.
- **Light:** GitHub-light-inspired. White background, dark text, clean borders.

### Syntax Highlighting

Shiki dual-theme rendering: both `github-dark` and `github-light` CSS is present in the HTML. The active theme is selected by CSS rules scoped to `[data-theme="dark"]` / `[data-theme="light"]`. Zero JS involved in switching code highlight themes.

### CSS

Single file: `src/style.css`, served at `/__servmark/style.css`. Covers:
- Base layout and typography
- Directory listing table
- Markdown prose (similar to `github-markdown-css`)
- Docs sidebar
- 404 page
- Theme toggle button
- Both color palettes via custom properties

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `hono` | HTTP framework |
| `@hono/node-server` | Node.js adapter for Hono |
| `markdown-it` | Markdown to HTML |
| `shiki` | Syntax highlighting (server-side, dual theme) |
| `open` | Cross-platform browser opener (`xdg-open` / `open`) |

GFM support via `markdown-it` plugins (tables, strikethrough, task lists — specific plugins to be determined during implementation, likely `markdown-it-*` family).

### Dev / Build

| Package | Purpose |
|---|---|
| `typescript` | Source language |
| `tsup` | Bundles to a single JS file for npm distribution |

### Not Used

- No frontend framework (vanilla inline scripts)
- No template engine (string template literals)
- No WebSocket library (SSE via standard web APIs)
- No CLI framework (`node:util` `parseArgs` is sufficient)

## File Structure

```
servmark/
  src/
    cli.ts          CLI entrypoint, flag parsing, port finding, browser open
    server.ts       Hono app, route definitions
    render.ts       Markdown rendering, HTML generation, page templates
    watcher.ts      fs.watch + SSE broadcast
    style.css       All styles, both themes
  package.json
  tsconfig.json
  tsup.config.ts
```

`tsup` bundles everything into `dist/cli.js` which is the `bin` entry in `package.json`.

## Security

- Path traversal protection: all resolved paths are checked to be within the served directory before serving. Requests for paths outside the root return 403.
- The `/__servmark/*` namespace is reserved and cannot collide with user files (if a user happens to have a `__servmark` directory, the server routes take precedence).
