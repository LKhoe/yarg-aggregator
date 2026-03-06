/**
 * Detect the text encoding of a byte buffer.
 * Port of DTAParser.DetectEncoding() from DTAParser.cs:2299.
 *
 * Returns a TextDecoder-compatible encoding string.
 */
export function detectEncoding(bytes: Uint8Array): string {
  // 1. BOM detection
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // Big-endian UTF-16 — handle as utf-16le after byte-swapping in the tokenizer.
    // For DTA files, this case is extremely rare. Fall through to UTF-8 check.
    return "utf-16le";
  }

  // 2. Test UTF-8 (no BOM) — check for invalid sequences
  if (isValidUTF8(bytes)) {
    return "utf-8";
  }

  // 3. Fallback to latin1 (similar to Windows-1252 for most chars)
  return "latin1";
}

function isValidUTF8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b <= 0x7f) {
      i++;
    } else if ((b & 0xe0) === 0xc0) {
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xc0) !== 0x80) return false;
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      if (
        i + 2 >= bytes.length ||
        (bytes[i + 1] & 0xc0) !== 0x80 ||
        (bytes[i + 2] & 0xc0) !== 0x80
      )
        return false;
      i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      if (
        i + 3 >= bytes.length ||
        (bytes[i + 1] & 0xc0) !== 0x80 ||
        (bytes[i + 2] & 0xc0) !== 0x80 ||
        (bytes[i + 3] & 0xc0) !== 0x80
      )
        return false;
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}
