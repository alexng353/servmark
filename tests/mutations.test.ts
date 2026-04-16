import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { toggleCheckbox, reorderTaskItem, createComment, updateComment, deleteComment } from "../src/mutations.js";
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

describe("reorderTaskItem", () => {
  it("moves an item down within a list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await reorderTaskItem(file, 0, 0, 2);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] second\n- [ ] third\n- [ ] first\n");
  });

  it("moves an item up within a list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] first\n- [ ] second\n- [ ] third\n");
    await reorderTaskItem(file, 0, 2, 0);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] third\n- [ ] first\n- [ ] second\n");
  });

  it("preserves content around the task list", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "# Title\n\n- [ ] a\n- [ ] b\n\nFooter\n");
    await reorderTaskItem(file, 0, 0, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("# Title\n\n- [ ] b\n- [ ] a\n\nFooter\n");
  });

  it("handles multiple separate task lists (listIndex)", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] a\n- [ ] b\n\nText\n\n- [ ] c\n- [ ] d\n");
    await reorderTaskItem(file, 1, 0, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toBe("- [ ] a\n- [ ] b\n\nText\n\n- [ ] d\n- [ ] c\n");
  });

  it("throws on invalid listIndex", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "- [ ] only\n");
    await expect(reorderTaskItem(file, 5, 0, 0)).rejects.toThrow();
  });
});

describe("createComment", () => {
  it("inserts a comment block before the target line", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "Line zero\nLine one\nLine two\n");
    await createComment(file, 1, 2, "A note about these lines");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("{::comment}");
    expect(result).toContain("relativeLines: +0..=1");
    expect(result).toContain("A note about these lines");
    expect(result).toContain("{:/comment}");
    expect(result).toContain("Line one");
    expect(result).toContain("Line two");
  });

  it("calculates correct relative lines for single line", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "A\nB\nC\n");
    await createComment(file, 0, 0, "About A");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("relativeLines: +0..=0");
  });
});

describe("updateComment", () => {
  it("replaces the body of an existing comment", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "{::comment}\nrelativeLines: +0..=0\n---\nOld body\n{:/comment}\nContent\n");
    await updateComment(file, 0, "New body");
    const result = await readFile(file, "utf-8");
    expect(result).toContain("New body");
    expect(result).not.toContain("Old body");
    expect(result).toContain("relativeLines: +0..=0");
  });
});

describe("deleteComment", () => {
  it("removes an entire comment block", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "Before\n{::comment}\nrelativeLines: +0..=0\n---\nA note\n{:/comment}\nContent\nAfter\n");
    await deleteComment(file, 0);
    const result = await readFile(file, "utf-8");
    expect(result).not.toContain("{::comment}");
    expect(result).not.toContain("A note");
    expect(result).toContain("Before");
    expect(result).toContain("Content");
    expect(result).toContain("After");
  });

  it("removes the correct comment when multiple exist", async () => {
    const file = join(testDir, "test.md");
    await writeFile(file, "{::comment}\nrelativeLines: +0..=0\n---\nFirst\n{:/comment}\nA\n{::comment}\nrelativeLines: +0..=0\n---\nSecond\n{:/comment}\nB\n");
    await deleteComment(file, 1);
    const result = await readFile(file, "utf-8");
    expect(result).toContain("First");
    expect(result).not.toContain("Second");
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});
