/**
 * Filename sanitization utilities.
 * Port of NemoTools.CleanString() and FixBadChars() from NemoTools.cs.
 */

const BAD_CHAR_MAP: [string, string][] = [
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã¨", "è"],
  ["ÃŠ", "Ê"],
  ["Ã¬", "ì"],
  ["Ã\u00AD\u00AD\u00AD", "í"],
  ["Ã¯", "ï"],
  ["Ã–", "Ö"],
  ["Ã¶", "ö"],
  ["Ã³", "ó"],
  ["Ã²", "ò"],
  ["Ãœ", "Ü"],
  ["Ã¼", "ü"],
  ["Ã¹", "ù"],
  ["Ãº", "ú"],
  ["Ã¿", "ÿ"],
  ["Ã±", "ñ"],
  ["ï¿½", ""],
  ["�", ""],
  ["E½", ""],
];

function fixBadChars(line: string): string {
  let result = line;
  for (const [bad, good] of BAD_CHAR_MAP) {
    result = result.replaceAll(bad, good);
  }
  return result;
}

/**
 * Clean a string for use as a filename.
 * Removes forbidden filesystem characters and fixes encoding artifacts.
 *
 * @param raw - The raw string to clean
 * @param removeDash - If true, removes leading/trailing dashes
 * @param dashForSlash - If true, replaces slashes with dashes instead of spaces
 */
export function cleanString(
  raw: string,
  removeDash: boolean,
  dashForSlash: boolean = false,
): string {
  let s = raw;

  // Remove forbidden filesystem characters
  s = s.replace(/"/g, "");
  s = s.replace(/>/g, " ");
  s = s.replace(/</g, " ");
  s = s.replace(/:/g, " ");
  s = s.replace(/\|/g, " ");
  s = s.replace(/\?/g, " ");
  s = s.replace(/\*/g, " ");
  s = s.replace("&#8217;", "'");
  s = s.replace(/   /g, " ");
  s = s.replace(/  /g, " ");
  s = fixBadChars(s).trim();

  if (removeDash) {
    if (s.startsWith("-")) s = s.substring(1);
    if (s.endsWith("-")) s = s.substring(0, s.length - 1);
    s = s.trim();
  }

  while (s.endsWith(".")) {
    s = s.substring(0, s.length - 1);
  }

  // C# checks if the entire string is exactly "AC/DC" — if so, leave slashes alone
  const isACDC = s === "AC/DC";
  s = s.replace(/\\/g, dashForSlash && !isACDC ? "-" : !isACDC ? " " : "");
  s = s.replace(/\//g, dashForSlash && !isACDC ? "-" : !isACDC ? " " : "");

  return s;
}
