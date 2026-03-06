import { detectEncoding } from "../utils/encoding";

/**
 * Split DTA file bytes into per-song entry groups.
 * Port of DTAParser.GetDTAEntries() from DTAParser.cs:2337.
 *
 * Each DTA "entry" is a top-level parenthesized expression.
 * We track open/close paren depth to determine boundaries.
 */
export function getDTAEntries(dtaBytes: Uint8Array): string[][] {
  const encoding = detectEncoding(dtaBytes);
  const text = new TextDecoder(encoding).decode(dtaBytes);
  const rawLines = text.split(/\r?\n/);

  const entries: string[][] = [[]];
  let open = 0;
  let closed = 0;
  let counter = 0;

  for (const rawLine of rawLines) {
    let line = rawLine;
    const trimmed = line.trim();

    // Skip commented-out lines (but keep ;;ORIG_ID= lines)
    if (trimmed.startsWith(";;") && !line.includes(";;ORIG_ID=")) continue;
    // Skip blank lines
    if (!trimmed) continue;
    // Skip HMX comments between songs
    if (trimmed.startsWith(";") && open === 0) continue;

    // Handle back-to-back entries: )( on a single line
    const noSpaces = trimmed.replace(/ /g, "");
    if (
      (noSpaces.startsWith(")(") || noSpaces.endsWith(")(")) &&
      closed + 1 === open
    ) {
      const idx = noSpaces.indexOf("(");
      entries[counter].push(noSpaces.substring(0, idx));
      counter++;
      entries.push([]);
      entries[counter].push(noSpaces.substring(idx));
      open = 1;
      closed = 0;
      continue;
    }

    const inQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');

    if (!inQuotes && line.includes(")")) {
      closed += countChar(line, ")");
    }
    if (!inQuotes && line.includes("(")) {
      open += countChar(line, "(");
    }

    // Fix known malformed entry (rock 'n roll star missing closing paren)
    if (trimmed === "(album_art TRUE") {
      line = line + ")";
      closed++;
    }

    entries[counter].push(line);

    if (closed === open && closed > 0) {
      open = 0;
      closed = 0;
      counter++;
      entries.push([]);
    }
  }

  // Remove trailing empty entry
  if (entries.length > 0 && entries[entries.length - 1].length === 0) {
    entries.pop();
  }

  return entries;
}

function countChar(str: string, ch: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count++;
  }
  return count;
}
