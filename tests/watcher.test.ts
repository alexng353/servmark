import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileWatcher } from "../src/watcher.js";

describe("FileWatcher", () => {
  let watcher: FileWatcher;

  beforeEach(() => {
    watcher = new FileWatcher("/tmp/test-dir", 50);
  });

  afterEach(() => {
    watcher.stop();
  });

  it("broadcasts changes to connected clients", async () => {
    const received: string[] = [];
    const client = {
      send: (data: string) => received.push(data),
      close: () => {},
    };
    watcher.addClient(client);

    watcher.handleChange("file.md");
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
    expect(received[0]).toContain("file.md");
  });

  it("debounces rapid changes to the same effect", async () => {
    const received: string[] = [];
    const client = {
      send: (data: string) => received.push(data),
      close: () => {},
    };
    watcher.addClient(client);

    watcher.handleChange("file.md");
    watcher.handleChange("file.md");
    watcher.handleChange("file.md");
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
  });

  it("removes disconnected clients", async () => {
    const received: string[] = [];
    const client = {
      send: (data: string) => received.push(data),
      close: () => {},
    };
    watcher.addClient(client);
    watcher.removeClient(client);

    watcher.handleChange("file.md");
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(0);
  });

  it("broadcasts to multiple clients", async () => {
    const received1: string[] = [];
    const received2: string[] = [];
    watcher.addClient({ send: (d) => received1.push(d), close: () => {} });
    watcher.addClient({ send: (d) => received2.push(d), close: () => {} });

    watcher.handleChange("test.md");
    await new Promise((r) => setTimeout(r, 100));

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
