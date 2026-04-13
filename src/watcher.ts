import { watch, type FSWatcher } from "node:fs";

export interface SseClient {
  send: (data: string) => void;
  close: () => void;
}

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private clients = new Set<SseClient>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private rootDir: string,
    private debounceMs: number = 100
  ) {}

  start(): void {
    this.watcher = watch(
      this.rootDir,
      { recursive: true },
      (_event, filename) => {
        if (filename) this.handleChange(String(filename));
      }
    );
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
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.watcher?.close();
    this.watcher = null;
    this.clients.clear();
  }
}
