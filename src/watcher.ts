import { watch, type FSWatcher } from "node:fs";

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
    private debounceMs: number = 100
  ) {}

  start(): void {
    this.stopped = false;
    this.startWatcher();
  }

  private startWatcher(): void {
    this.watcher?.close();
    this.watcher = watch(
      this.rootDir,
      { recursive: true },
      (event, filename) => {
        if (filename) this.handleChange(String(filename));
        // Editors like neovim write to a temp file and rename it over the
        // original. On Linux this replaces the inode, which causes fs.watch
        // to silently stop delivering events. Restarting the watcher on
        // rename events fixes this.
        if (event === "rename" && !this.stopped) {
          this.restartWatcher();
        }
      }
    );
  }

  private restartDebounce: ReturnType<typeof setTimeout> | null = null;

  private restartWatcher(): void {
    if (this.restartDebounce) clearTimeout(this.restartDebounce);
    this.restartDebounce = setTimeout(() => {
      if (!this.stopped) this.startWatcher();
    }, 200);
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
