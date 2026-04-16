import { readFile, writeFile } from "node:fs/promises";

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
