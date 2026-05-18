const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})\s*$/;

/**
 * Returns the set of line indices that fall *inside* a fenced code block.
 * Fence delimiter lines themselves are not included. Used to skip over
 * literal `{::comment}` / `{:/comment}` markers that appear in code samples.
 */
export function fencedLineIndices(lines: string[]): Set<number> {
  const inside = new Set<number>();
  let open: { char: string; len: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open) {
      const m = line.match(FENCE_CLOSE_RE);
      if (m && m[1][0] === open.char && m[1].length >= open.len) {
        open = null;
      } else {
        inside.add(i);
      }
      continue;
    }
    const m = line.match(FENCE_OPEN_RE);
    if (m) {
      open = { char: m[1][0], len: m[1].length };
    }
  }
  return inside;
}
