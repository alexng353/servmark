import { watch, type FSWatcher } from "node:fs";
import { execFileSync } from "node:child_process";

export interface SseClient {
  send: (data: string) => void;
  close: () => void;
}

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private clients = new Set<SseClient>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private rootDir: string,
    private debounceMs: number = 100,
    private debug: boolean = false,
  ) {}

  start(): void {
    this.stopped = false;
    this.startWatcher();
  }

  private startWatcher(): void {
    this.watcher?.close();
    this.ignoreCache.clear();
    this.watcher = watch(
      this.rootDir,
      { recursive: true },
      (event, filename) => {
        if (!filename) return;
        const name = String(filename);
        if (this.debug) console.log(`[debug] fs.watch: ${event} "${name}"`);
        // Editors like neovim write to a temp file and rename it over the
        // original. On Linux this replaces the inode, which causes fs.watch
        // to silently stop delivering events. Restarting the watcher on
        // rename events fixes this.
        if (event === "rename" && !this.stopped) {
          this.restartWatcher();
        }
        if (this.isIgnored(name)) {
          if (this.debug) console.log(`[debug] ignored: "${name}"`);
          return;
        }
        this.handleChange(name);
      }
    );
  }

  private ignoreCache = new Map<string, boolean>();
  private useGitIgnore: boolean | null = null;
  private restartDebounce: ReturnType<typeof setTimeout> | null = null;

  private restartWatcher(): void {
    if (this.restartDebounce) clearTimeout(this.restartDebounce);
    this.restartDebounce = setTimeout(() => {
      if (!this.stopped) this.startWatcher();
    }, 200);
  }

  private isIgnored(filename: string): boolean {
    // Always ignore .git internals
    if (filename.startsWith(".git/") || filename === ".git") return true;

    const cached = this.ignoreCache.get(filename);
    if (cached !== undefined) return cached;

    // Check if we're in a git repo (once)
    if (this.useGitIgnore === null) {
      try {
        execFileSync("git", ["rev-parse", "--git-dir"], { cwd: this.rootDir, stdio: "ignore" });
        this.useGitIgnore = true;
      } catch {
        this.useGitIgnore = false;
      }
    }

    let ignored = false;
    if (this.useGitIgnore) {
      try {
        // exit code 0 = ignored, 1 = not ignored
        execFileSync("git", ["check-ignore", "-q", filename], { cwd: this.rootDir, stdio: "ignore" });
        ignored = true;
      } catch {
        ignored = false;
      }
    }

    this.ignoreCache.set(filename, ignored);
    return ignored;
  }

  handleChange(filename: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.broadcast(filename);
    }, this.debounceMs);
  }

  addClient(client: SseClient): void {
    this.clients.add(client);
  }

  removeClient(client: SseClient): void {
    this.clients.delete(client);
  }

  private broadcast(filename: string): void {
    const data = `data: ${JSON.stringify({ path: filename })}\n\n`;
    if (this.debug) console.log(`[debug] broadcast to ${this.clients.size} client(s): ${filename}`);
    for (const client of this.clients) {
      client.send(data);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.restartDebounce) clearTimeout(this.restartDebounce);
    this.watcher?.close();
    this.watcher = null;
    this.clients.clear();
  }
}
