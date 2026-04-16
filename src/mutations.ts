import { readFile, writeFile } from "node:fs/promises";

const CHECKBOX_RE = /- \[([ x])\]/g;

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
