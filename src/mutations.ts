import { readFile, writeFile } from "node:fs/promises";
import { fencedLineIndices } from "./fence.js";

const CHECKBOX_RE = /- \[([ x])\]/g;
const TASK_LINE_RE = /^\s*- \[([ x])\]/;

export async function toggleCheckbox(
  filePath: string,
  index: number,
  checked: boolean
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  let matchIndex = 0;
  const result = content.replace(CHECKBOX_RE, (match) => {
    if (matchIndex++ === index) {
      return checked ? "- [x]" : "- [ ]";
    }
    return match;
  });

  if (matchIndex <= index) {
    throw new Error(`Checkbox index ${index} out of range (found ${matchIndex})`);
  }

  await writeFile(filePath, result, "utf-8");
}

export async function reorderTaskItem(
  filePath: string,
  listIndex: number,
  fromIndex: number,
  toIndex: number
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  // Find contiguous task list groups. A group is consecutive lines matching
  // TASK_LINE_RE. Non-task lines (including blank lines) break groups.
  type Group = { start: number; end: number }; // line indices, inclusive
  const groups: Group[] = [];
  let i = 0;
  while (i < lines.length) {
    if (TASK_LINE_RE.test(lines[i])) {
      const start = i;
      while (i < lines.length && TASK_LINE_RE.test(lines[i])) {
        i++;
      }
      groups.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }

  if (listIndex >= groups.length) {
    throw new Error(
      `listIndex ${listIndex} out of range (found ${groups.length} task list(s))`
    );
  }

  const group = groups[listIndex];
  const groupLines = lines.slice(group.start, group.end + 1);

  if (fromIndex < 0 || fromIndex >= groupLines.length) {
    throw new Error(
      `fromIndex ${fromIndex} out of range for list of length ${groupLines.length}`
    );
  }
  if (toIndex < 0 || toIndex >= groupLines.length) {
    throw new Error(
      `toIndex ${toIndex} out of range for list of length ${groupLines.length}`
    );
  }

  // Remove the item at fromIndex and insert at toIndex
  const [removed] = groupLines.splice(fromIndex, 1);
  groupLines.splice(toIndex, 0, removed);

  // Rebuild the full file
  const reordered = [
    ...lines.slice(0, group.start),
    ...groupLines,
    ...lines.slice(group.end + 1),
  ];

  await writeFile(filePath, reordered.join("\n"), "utf-8");
}

interface CommentBlock {
  startLine: number; // line index of {::comment}
  endLine: number; // line index of {:/comment}
  separatorLine: number; // line index of ---
}

function findCommentBlocks(lines: string[]): CommentBlock[] {
  const fenced = fencedLineIndices(lines);
  const blocks: CommentBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (fenced.has(i)) continue;
    if (lines[i].trim() === "{::comment}") {
      let separatorLine = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (fenced.has(j)) continue;
        if (lines[j].trim() === "---" && separatorLine === -1) {
          separatorLine = j;
        }
        if (lines[j].trim() === "{:/comment}") {
          blocks.push({ startLine: i, endLine: j, separatorLine });
          break;
        }
      }
    }
  }
  return blocks;
}

export async function createComment(
  filePath: string,
  startLine: number,
  endLine: number,
  body: string
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const rangeLength = endLine - startLine;
  const commentBlock = [
    "{::comment}",
    `relativeLines: +0..=${rangeLength}`,
    "---",
    body,
    "{:/comment}",
  ];

  lines.splice(startLine, 0, ...commentBlock);
  await writeFile(filePath, lines.join("\n"), "utf-8");
}

export async function updateComment(
  filePath: string,
  commentIndex: number,
  body: string
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const blocks = findCommentBlocks(lines);

  if (commentIndex >= blocks.length) {
    throw new Error(
      `Comment index ${commentIndex} out of range (found ${blocks.length})`
    );
  }

  const block = blocks[commentIndex];
  const newLines = [
    ...lines.slice(0, block.separatorLine + 1),
    body,
    ...lines.slice(block.endLine),
  ];

  await writeFile(filePath, newLines.join("\n"), "utf-8");
}

export async function deleteComment(
  filePath: string,
  commentIndex: number
): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const blocks = findCommentBlocks(lines);

  if (commentIndex >= blocks.length) {
    throw new Error(
      `Comment index ${commentIndex} out of range (found ${blocks.length})`
    );
  }

  const block = blocks[commentIndex];
  lines.splice(block.startLine, block.endLine - block.startLine + 1);

  await writeFile(filePath, lines.join("\n"), "utf-8");
}
