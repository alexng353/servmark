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

function commentHighlightScript(): string {
  return `<script>
(function(){
  var content=document.getElementById("content");
  if(!content)return;

  function initHighlights(){
    var comments=content.querySelectorAll(".sm-comment");
    comments.forEach(function(card){
      var id=card.getAttribute("data-comment-id");
      var lines=card.getAttribute("data-lines");
      if(!lines)return;
      var lineNums=lines.split(",").map(Number);

      // Collect the sibling elements that should be highlighted
      var sibling=card.nextElementSibling;
      var relIdx=0;
      var toWrap=[];
      while(sibling&&relIdx<=Math.max.apply(null,lineNums)){
        if(lineNums.indexOf(relIdx)>=0){
          toWrap.push(sibling);
        }
        relIdx++;
        sibling=sibling.nextElementSibling;
      }

      if(!toWrap.length)return;

      // Wrap all highlighted elements in a single group div
      var group=document.createElement("div");
      group.className="sm-highlight-group";
      group.setAttribute("data-comment-id",id);
      toWrap[0].parentNode.insertBefore(group,toWrap[0]);
      toWrap.forEach(function(el){group.appendChild(el)});

      // Hover: group <-> card (ignore grip-handle to avoid overlap with drag handle)
      card.addEventListener("mouseenter",function(){group.classList.add("flash")});
      card.addEventListener("mouseleave",function(){group.classList.remove("flash")});
      group.addEventListener("mouseover",function(e){
        if(e.target.closest(".grip-handle")){card.classList.remove("highlight")}
        else{card.classList.add("highlight")}
      });
      group.addEventListener("mouseleave",function(){card.classList.remove("highlight")});
    });
  }
  initHighlights();
})();
</script>`;
}

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

  function clearPending(){
    mdBody.querySelectorAll(".sm-pending-highlight").forEach(function(el){el.classList.remove("sm-pending-highlight")});
  }

  function addPending(startLine,endLine){
    if(startLine===null||endLine===null)return;
    var blocks=getBlockElements();
    blocks.forEach(function(el){
      var ln=parseInt(el.getAttribute("data-source-line"));
      if(ln>=startLine&&ln<=endLine)el.classList.add("sm-pending-highlight");
    });
  }

  function closeEditor(){
    var existing=mdBody.querySelector(".sm-comment-editor");
    if(existing)existing.remove();
    clearPending();
  }

  function submitEditor(editor,isEdit,commentId,startLine,endLine){
    var text=editor.querySelector("textarea").value.trim();
    if(!text){closeEditor();return}
    var payload=isEdit
      ?{path:decodeURIComponent(window.location.pathname),commentIndex:parseInt(commentId),body:text}
      :{path:decodeURIComponent(window.location.pathname),startLine:startLine,endLine:endLine,body:text};
    fetch("/__servmark/comment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(function(){location.reload()});
  }

  function showEditor(commentId,beforeEl,startLine,endLine){
    closeEditor();
    var editor=document.createElement("div");
    editor.className="sm-comment-editor";
    var isEdit=commentId!==null;
    var body="";
    if(isEdit){
      var card=mdBody.querySelector('.sm-comment[data-comment-id="'+commentId+'"]');
      if(card)body=card.querySelector(".sm-comment-body").textContent.trim();
    }
    editor.innerHTML='<textarea placeholder="Add a comment...">'+body.replace(/</g,"&lt;")+'</textarea><div class="sm-comment-editor-actions">'
      +(isEdit?'<button class="sm-btn-delete">Delete</button>':'')
      +'<button class="sm-btn-cancel">Cancel</button><button class="sm-btn-save">'+(isEdit?"Save":"Add")+'</button></div>';
    beforeEl.parentNode.insertBefore(editor,beforeEl);
    addPending(startLine,endLine);
    var ta=editor.querySelector("textarea");
    ta.focus();

    ta.addEventListener("keydown",function(e){
      if(e.key==="Escape"){closeEditor();e.preventDefault()}
      if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){submitEditor(editor,isEdit,commentId,startLine,endLine);e.preventDefault()}
    });
    editor.querySelector(".sm-btn-cancel").addEventListener("click",function(){closeEditor()});
    editor.querySelector(".sm-btn-save").addEventListener("click",function(){submitEditor(editor,isEdit,commentId,startLine,endLine)});
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

// Section 3: Breadcrumb, pageLayout function, and escapeHtml helper

export function breadcrumbHtml(currentPath: string): string {
  const segments = currentPath.split("/").filter(Boolean);
  let parts: string[] = [`<a href="/">servmark</a>`];

  for (let i = 0; i < segments.length; i++) {
    parts.push(`<span class="breadcrumb-sep">/</span>`);
    if (i === segments.length - 1) {
      // Last segment is plain text (current)
      parts.push(
        `<span class="breadcrumb-current">${escapeHtml(segments[i])}</span>`,
      );
    } else {
      // Intermediate segments are clickable links
      const href = "/" + segments.slice(0, i + 1).join("/") + "/";
      parts.push(
        `<a href="${escapeHtml(href)}">${escapeHtml(segments[i])}</a>`,
      );
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
  ${checkboxScript()}
  ${reorderScript()}
  ${commentHighlightScript()}
  ${commentEditorScript()}
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
  ${checkboxScript()}
  ${reorderScript()}
  ${commentHighlightScript()}
  ${commentEditorScript()}
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
  currentPath: string,
): string {
  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const rows = sorted
    .map((entry) => {
      const icon = entry.isDirectory ? FOLDER_ICON : FILE_ICON;
      const href =
        currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
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

export function docsSidebarHtml(mdFiles: string[], activePath: string): string {
  return mdFiles
    .map((file) => {
      const href = `/${file}`;
      const isActive = `/${file}` === activePath;
      const className = isActive ? ' class="active"' : "";
      return `<li><a href="${escapeHtml(href)}"${className}>${escapeHtml(file)}</a></li>`;
    })
    .join("\n");
}
