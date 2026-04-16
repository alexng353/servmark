import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(__dirname, "style.css"), "utf-8");

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export interface PageOptions {
  title: string;
  content: string;
  theme: "dark" | "light" | "auto";
  liveReload: boolean;
  docsMode: boolean;
  currentPath: string;
  sidebar?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FOLDER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--icon-folder)" stroke="none"><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/></svg>`;

const FILE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--icon-file)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

const SUN_ICON = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const MOON_ICON = `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function themeToggleButton(): string {
  return `<button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">${SUN_ICON}${MOON_ICON}</button>`;
}

// Section 2: Inline scripts (theme init, theme toggle, live reload)

function themeInitScript(defaultTheme: "dark" | "light" | "auto"): string {
  return `<script>
(function(){
  var s=localStorage.getItem("servmark-theme");
  if(s){document.documentElement.setAttribute("data-theme",s);return}
  ${defaultTheme === "auto" ? `var d=window.matchMedia("(prefers-color-scheme:light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",d);` : ""}
})();
</script>`;
}

function themeToggleScript(): string {
  return `<script>
document.getElementById("theme-toggle").addEventListener("click",function(){
  var h=document.documentElement;
  var c=h.getAttribute("data-theme");
  var n=c==="dark"?"light":"dark";
  h.setAttribute("data-theme",n);
  localStorage.setItem("servmark-theme",n);
});
</script>`;
}

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

function liveReloadScript(): string {
  return `<script>
(function(){
  var es=new EventSource("/__servmark/events");
  es.onmessage=function(e){
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

// Section 3: Breadcrumb, pageLayout function, and escapeHtml helper

export function breadcrumbHtml(currentPath: string): string {
  const segments = currentPath.split("/").filter(Boolean);
  let parts: string[] = [`<a href="/">servmark</a>`];

  for (let i = 0; i < segments.length; i++) {
    parts.push(`<span class="breadcrumb-sep">/</span>`);
    if (i === segments.length - 1) {
      // Last segment is plain text (current)
      parts.push(
        `<span class="breadcrumb-current">${escapeHtml(segments[i])}</span>`
      );
    } else {
      // Intermediate segments are clickable links
      const href = "/" + segments.slice(0, i + 1).join("/") + "/";
      parts.push(`<a href="${escapeHtml(href)}">${escapeHtml(segments[i])}</a>`);
    }
  }

  return `<span class="breadcrumb">${parts.join("")}</span>`;
}

export function pageLayout(options: PageOptions): string {
  const initialTheme = options.theme === "auto" ? "dark" : options.theme;

  const head = `<!DOCTYPE html>
<html lang="en" data-theme="${initialTheme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)} — servmark</title>
  <style>${styles}</style>
  ${themeInitScript(options.theme)}
</head>`;

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

  return `${head}
<body>
  <header class="page-header">
    <div class="page-header-left">${breadcrumbHtml(options.currentPath || "/")}</div>
    ${themeToggleButton()}
  </header>
  <main class="page-content">
    <div id="content">${options.content}</div>
  </main>
  ${themeToggleScript()}
  ${options.liveReload ? liveReloadScript() : ""}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Section 4: Directory listing and 404 templates

export function directoryListingHtml(
  entries: DirEntry[],
  currentPath: string
): string {
  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const rows = sorted
    .map((entry) => {
      const icon = entry.isDirectory ? FOLDER_ICON : FILE_ICON;
      const href = currentPath === "/"
        ? `/${entry.name}`
        : `${currentPath}/${entry.name}`;
      const size = entry.isDirectory ? "—" : formatSize(entry.size);
      const date = formatDate(entry.modified);

      return `<tr>
      <td><div class="name-cell">${icon}<a href="${escapeHtml(href)}">${escapeHtml(entry.name)}</a></div></td>
      <td class="size-cell">${size}</td>
      <td class="date-cell">${date}</td>
    </tr>`;
    })
    .join("\n");

  const parentRow =
    currentPath !== "/"
      ? `<tr>
      <td><div class="name-cell">${FOLDER_ICON}<a href="${escapeHtml(currentPath.replace(/\/[^/]+$/, "") || "/")}">..</a></div></td>
      <td class="size-cell">—</td>
      <td class="date-cell">—</td>
    </tr>\n`
      : "";

  return `<div class="dir-heading">${escapeHtml(currentPath === "/" ? "/" : currentPath)}</div>
<table class="dir-listing">
  <thead><tr><th>Name</th><th>Size</th><th>Date Modified</th></tr></thead>
  <tbody>
    ${parentRow}${rows}
  </tbody>
</table>`;
}

export function notFoundHtml(path: string): string {
  return `<div class="not-found">
  <h1>404</h1>
  <p>Not found: ${escapeHtml(path)}</p>
  <a class="back-btn" href="#" onclick="if(history.length>1){history.back()}else{location.href='/'}; return false;">Go back</a>
</div>`;
}

// Section 5: Docs sidebar template

export function docsSidebarHtml(
  mdFiles: string[],
  activePath: string
): string {
  return mdFiles
    .map((file) => {
      const href = `/${file}`;
      const isActive = `/${file}` === activePath;
      const className = isActive ? ' class="active"' : "";
      return `<li><a href="${escapeHtml(href)}"${className}>${escapeHtml(file)}</a></li>`;
    })
    .join("\n");
}
