import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { toggleCheckbox } from "../src/mutations.js";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "servmark-mut-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("toggleCheckbox", () => {
  it("checks an unchecked box by index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await toggleCheckbox(file, 1, true);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] first\n- [x] second\n- [ ] third\n");
  });

  it("unchecks a checked box by index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [x] first\n- [x] second\n");
    await toggleCheckbox(file, 0, false);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] first\n- [x] second\n");
  });

  it("handles indented checkboxes", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] top\n  - [ ] nested\n  - [ ] nested2\n");
    await toggleCheckbox(file, 1, true);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] top\n  - [x] nested\n  - [ ] nested2\n");
  });

  it("handles mixed content around checkboxes", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "# Title\n\nSome text\n\n- [ ] task one\n- [x] task two\n\nMore text\n");
    await toggleCheckbox(file, 0, true);
    const result = await readFile(file, "utf-8");
    expect(result).toContain("- [x] task one");
    expect(result).toContain("- [x] task two");
  });

  it("throws on invalid index", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] only one\n");
    await expect(toggleCheckbox(file, 5, true)).rejects.toThrow();
  });
});
