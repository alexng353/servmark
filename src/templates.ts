import styles from "./style.css";

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

// Section 3: pageLayout function and escapeHtml helper

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
  <div class="docs-layout">
    <nav class="docs-sidebar">
      <div class="sidebar-header">
        <span>servmark</span>
        ${themeToggleButton()}
      </div>
      <ul class="sidebar-list">
        ${options.sidebar}
      </ul>
    </nav>
    <main class="docs-content">
      <div id="content">${options.content}</div>
    </main>
  </div>
  ${themeToggleScript()}
  ${options.liveReload ? liveReloadScript() : ""}
</body>
</html>`;
  }

  return `${head}
<body>
  <header class="page-header">
    <div class="page-header-title"><a href="/">servmark</a> · ${escapeHtml(options.currentPath || "/")}</div>
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
