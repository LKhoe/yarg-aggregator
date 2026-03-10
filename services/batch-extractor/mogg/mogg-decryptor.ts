/**
 * MOGG encryption versions.
 * Port of CryptVersion from Mogg.cs.
 */
export enum CryptVersion {
  x0A = 0x0a, // No encryption
  x0B = 0x0b, // RB1, RB1 DLC
  x0C = 0x0c, // RB2, AC/DC Live, some RB2 DLC
  x0D = 0x0d, // C3 use only
  x0E = 0x0e, // Lego, Green Day, most RB2 DLC
  x0F = 0x0f, // RBN
  x10 = 0x10, // RB3, RB3 DLC
}

const HMX_PRIVATE_KEY_0B = new Uint8Array([
  0x37, 0xb2, 0xe2, 0xb9, 0x1c, 0x74, 0xfa, 0x9e, 0x38, 0x81, 0x08, 0xea, 0x36,
  0x23, 0xdb, 0xe4,
]);

// Used for 0x0C and 0x0D versions (C3/RB2 custom)
const HMX_PRIVATE_KEY_0C = new Uint8Array([
  0x01, 0x22, 0x00, 0x38, 0xd2, 0x01, 0x78, 0x8b,
  0xdd, 0xcd, 0xd0, 0xf0, 0xfe, 0x3e, 0x24, 0x7f,
]);

// Hidden keys table (12 entries × 32 bytes = 384 bytes). Port of MoggCrypt.hiddenKeys.
const HIDDEN_KEYS = new Uint8Array([
  0x7f, 0x95, 0x5b, 0x9d, 0x94, 0xba, 0x12, 0xf1, 0xd7, 0x5a, 0x67, 0xd9, 0x16, 0x45, 0x28, 0xdd,
  0x61, 0x55, 0x55, 0xaf, 0x23, 0x91, 0xd6, 0x0a, 0x3a, 0x42, 0x81, 0x18, 0xb4, 0xf7, 0xf3, 0x04,
  0x78, 0x96, 0x5d, 0x92, 0x92, 0xb0, 0x47, 0xac, 0x8f, 0x5b, 0x6d, 0xdc, 0x1c, 0x41, 0x7e, 0xda,
  0x6a, 0x55, 0x53, 0xaf, 0x20, 0xc8, 0xdc, 0x0a, 0x66, 0x43, 0xdd, 0x1c, 0xb2, 0xa5, 0xa4, 0x0c,
  0x7e, 0x92, 0x5c, 0x93, 0x90, 0xed, 0x4a, 0xad, 0x8b, 0x07, 0x36, 0xd3, 0x10, 0x41, 0x78, 0x8f,
  0x60, 0x08, 0x55, 0xa8, 0x26, 0xcf, 0xd0, 0x0f, 0x65, 0x11, 0x84, 0x45, 0xb1, 0xa0, 0xfa, 0x57,
  0x79, 0x97, 0x0b, 0x90, 0x92, 0xb0, 0x44, 0xad, 0x8a, 0x0e, 0x60, 0xd9, 0x14, 0x11, 0x7e, 0x8d,
  0x35, 0x5d, 0x5c, 0xfb, 0x21, 0x9c, 0xd3, 0x0e, 0x32, 0x40, 0xd1, 0x48, 0xb8, 0xa7, 0xa1, 0x0d,
  0x28, 0xc3, 0x5d, 0x97, 0xc1, 0xec, 0x42, 0xf1, 0xdc, 0x5d, 0x37, 0xda, 0x14, 0x47, 0x79, 0x8a,
  0x32, 0x5c, 0x54, 0xf2, 0x72, 0x9d, 0xd3, 0x0d, 0x67, 0x4c, 0xd6, 0x49, 0xb4, 0xa2, 0xf3, 0x50,
  0x28, 0x96, 0x5e, 0x95, 0xc5, 0xe9, 0x45, 0xad, 0x8a, 0x5d, 0x64, 0x8e, 0x17, 0x40, 0x2e, 0x87,
  0x36, 0x58, 0x06, 0xfd, 0x75, 0x90, 0xd0, 0x5f, 0x3a, 0x40, 0xd4, 0x4c, 0xb0, 0xf7, 0xa7, 0x04,
  0x2c, 0x96, 0x01, 0x96, 0x9b, 0xbc, 0x15, 0xa6, 0xde, 0x0e, 0x65, 0x8d, 0x17, 0x47, 0x2f, 0xdd,
  0x63, 0x54, 0x55, 0xaf, 0x76, 0xca, 0x84, 0x5f, 0x62, 0x44, 0x80, 0x4a, 0xb3, 0xf4, 0xf4, 0x0c,
  0x7e, 0xc4, 0x0e, 0xc6, 0x9a, 0xeb, 0x43, 0xa0, 0xdb, 0x0a, 0x64, 0xdf, 0x1c, 0x42, 0x24, 0x89,
  0x63, 0x5c, 0x55, 0xf3, 0x71, 0x90, 0xdc, 0x5d, 0x60, 0x40, 0xd1, 0x4d, 0xb2, 0xa3, 0xa7, 0x0d,
  0x2c, 0x9a, 0x0b, 0x90, 0x9a, 0xbe, 0x47, 0xa7, 0x88, 0x5a, 0x6d, 0xdf, 0x13, 0x1d, 0x2e, 0x8b,
  0x60, 0x5e, 0x55, 0xf2, 0x74, 0x9c, 0xd7, 0x0e, 0x60, 0x40, 0x80, 0x1c, 0xb7, 0xa1, 0xf4, 0x02,
  0x28, 0x96, 0x5b, 0x95, 0xc1, 0xe9, 0x40, 0xa3, 0x8f, 0x0c, 0x32, 0xdf, 0x43, 0x1d, 0x24, 0x8d,
  0x61, 0x09, 0x54, 0xab, 0x27, 0x9a, 0xd3, 0x58, 0x60, 0x16, 0x84, 0x4f, 0xb3, 0xa4, 0xf3, 0x0d,
  0x25, 0x93, 0x08, 0xc0, 0x9a, 0xbd, 0x10, 0xa2, 0xd6, 0x09, 0x60, 0x8f, 0x11, 0x1d, 0x7a, 0x8f,
  0x63, 0x0b, 0x5d, 0xf2, 0x21, 0xec, 0xd7, 0x08, 0x62, 0x40, 0x84, 0x49, 0xb0, 0xad, 0xf2, 0x07,
  0x29, 0xc3, 0x0c, 0x96, 0x96, 0xeb, 0x10, 0xa0, 0xda, 0x59, 0x32, 0xd3, 0x17, 0x41, 0x25, 0xdc,
  0x63, 0x08, 0x04, 0xae, 0x77, 0xcb, 0x84, 0x5a, 0x60, 0x4d, 0xdd, 0x45, 0xb5, 0xf4, 0xa0, 0x05,
]);

// Transform used in revealKey(). Port of MoggCrypt.HvKey_transform.
const HV_KEY_TRANSFORM = new Uint8Array([
  0x39, 0xa2, 0xbf, 0x53, 0x7d, 0x88, 0x1d, 0x03, 0x35, 0x38, 0xa3, 0x80, 0x45,
  0x24, 0xee, 0xca, 0x25, 0x6d, 0xa5, 0xc2, 0x65, 0xa9, 0x94, 0x73, 0xe5, 0x74,
  0xeb, 0x54, 0xe5, 0x95, 0x3f, 0x1c,
]);

const OGGS_MAGIC = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
const HMXA_MAGIC = new Uint8Array([0x48, 0x4d, 0x58, 0x41]);

// Cached CryptoKey for AES operations (imported once, reused)
let cachedKey: CryptoKey | null = null;
let cachedDecryptKey0C: CryptoKey | null = null;

async function getAESKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = await crypto.subtle.importKey(
      "raw",
      HMX_PRIVATE_KEY_0B,
      { name: "AES-CBC" },
      false,
      ["encrypt"],
    );
  }
  return cachedKey;
}

async function getAESKey0C(): Promise<CryptoKey> {
  if (!cachedDecryptKey0C) {
    cachedDecryptKey0C = await crypto.subtle.importKey(
      "raw",
      HMX_PRIVATE_KEY_0C,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"],
    );
  }
  return cachedDecryptKey0C;
}

/**
 * AES-ECB single-block decrypt using WebCrypto (which only supports AES-CBC/CTR/etc).
 * Trick: build a 2-block input [ct, ct2] where ct2 is chosen so the last decrypted
 * block = 0x10*16 (valid PKCS7), then CBC-decrypt gives us ECB_decrypt(ct) as block 0.
 */
async function aesECBDecrypt(block: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = new Uint8Array(16); // zero IV
  // ct2 = AES_CBC_encrypt(0x10*16 XOR block, key, iv=0)
  //   → so that AES_CBC_decrypt(ct2) XOR block = 0x10*16 (valid PKCS7)
  const xored = block.map((b) => b ^ 0x10);
  const ct2Buf = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, xored);
  const ct2 = new Uint8Array(ct2Buf).subarray(0, 16);
  // Combine: [block, ct2]
  const combined = new Uint8Array(32);
  combined.set(block, 0);
  combined.set(ct2, 16);
  // Decrypt: pt0 = AES_decrypt(block) XOR 0 = ECB_decrypt(block)  ✓
  //          pt1 = AES_decrypt(ct2) XOR block = 0x10*16 (stripped by PKCS7 unpad)
  const decBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, combined);
  return new Uint8Array(decBuf).subarray(0, 16);
}

export interface MoggHeader {
  version: CryptVersion;
  oggOffset: number;
  oggMapVersion: number;
  oggBuffer: number;
  chunks: Array<{ offset: number; value: number }>;
  publicKey: Uint8Array;
  oggData: Uint8Array;
}

function makeDataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function arrEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ── GenPrivateKey helpers (port of MoggCrypt from Mogg.cs) ──────────────────

function rotl8(b: number, dist: number): number {
  return (((b << dist) | (b >>> (8 - dist))) & 0xff);
}

function rotr8(b: number, dist: number): number {
  return (((b >>> dist) | (b << (8 - dist))) & 0xff);
}

function oFuncs(a1: number, a2: number, op: number): number {
  a1 &= 0xff; a2 &= 0xff;
  let result: number;
  switch (op) {
    case 0:  result = a2 + rotr8(a1, a2 === 0 ? 1 : 0); break;
    case 1:  result = a2 + rotr8(a1, 3); break;
    case 2:  result = a2 + rotl8(a1, 1); break;
    case 3:  result = a2 ^ ((a1 >>> (a2 & 7)) | ((a1 << (-(a2) & 7)) & 0xff)); break;
    case 4:  result = a2 ^ rotl8(a1, 4); break;
    case 5:  result = a2 + (a2 ^ rotr8(a1, 3)); break;
    case 6:  result = a2 + rotl8(a1, 2); break;
    case 7:  result = a2 + (a1 === 0 ? 1 : 0); break;
    case 8:  result = a2 ^ rotr8(a1, a2 === 0 ? 1 : 0); break;
    case 9:  result = a2 ^ (a2 + rotl8(a1, 3)); break;
    case 10: result = a2 + rotl8(a1, 3); break;
    case 11: result = a2 + rotl8(a1, 4); break;
    case 12: result = a1 ^ a2; break;
    case 13: result = a2 ^ (a1 === 0 ? 1 : 0); break;
    case 14: result = a2 ^ (a2 + rotr8(a1, 3)); break;
    case 15: result = a2 ^ rotl8(a1, 3); break;
    case 16: result = a2 ^ rotl8(a1, 2); break;
    case 17: result = a2 + (a2 ^ rotl8(a1, 3)); break;
    case 18: result = a2 + (a1 ^ a2); break;
    case 19: result = a1 + a2; break;
    case 20: result = a2 ^ rotr8(a1, 3); break;
    case 21: result = a2 ^ (a1 + a2); break;
    case 22: result = rotr8(a1, a2 === 0 ? 1 : 0); break;
    case 23: result = a2 + rotr8(a1, 1); break;
    case 24: result = (a1 >>> (a2 & 7)) | ((a1 << (-(a2) & 7)) & 0xff); break;
    case 25: result = a1 === 0 ? (a2 === 0 ? 0x80 : 0x01) : 0x00; break;
    case 26: result = a2 + rotr8(a1, 2); break;
    case 27: result = a2 ^ rotr8(a1, 1); break;
    case 28: { const na1 = (~a1) & 0xff; result = (na1 >>> (a2 & 7)) | ((na1 << (-(a2) & 7)) & 0xff); break; }
    case 29: result = a2 ^ rotr8(a1, 2); break;
    case 30: result = a2 + ((a1 >>> (a2 & 7)) | ((a1 << (-(a2) & 7)) & 0xff)); break;
    case 31: result = a2 ^ rotl8(a1, 1); break;
    // New funcs (useNewCrypt only, op >= 32)
    case 32: result = (((a1 << 8) | 0xaa | ((~a1) & 0xff)) >>> 4) ^ a2; break;
    case 33: result = ((((~a1) & 0xff) | (a1 << 8)) >>> 3) ^ a2; break;
    case 34: result = (((((a1 << 8) ^ 0xff00) | a1) >>> 2)) ^ a2; break;
    case 35: result = ((((a1 ^ 0x5c) | (a1 << 8)) >>> 5)) ^ a2; break;
    case 36: result = (((((a1 << 8) | 0x65 | (a1 ^ 0x3c)) >>> 2))) ^ a2; break;
    case 37: result = ((((a1 ^ 0x36) | (a1 << 8)) >>> 2)) ^ a2; break;
    case 38: result = ((((a1 ^ 0x36) | (a1 << 8)) >>> 4)) ^ a2; break;
    case 39: result = ((((a1 ^ 0x5c) | (a1 << 8) | 0x36) >>> 1)) ^ a2; break;
    case 40: result = (((((~a1) & 0xff) | (a1 << 8)) >>> 5)) ^ a2; break;
    case 41: result = (((((~a1) << 8) | a1) >>> 6)) ^ a2; break;
    case 42: result = ((((a1 ^ 0x5c) | (a1 << 8)) >>> 3)) ^ a2; break;
    case 43: result = ((((a1 ^ 0x3c) | 0x65 | (a1 << 8)) >>> 5)) ^ a2; break;
    case 44: result = ((((a1 ^ 0x36) | (a1 << 8)) >>> 1)) ^ a2; break;
    case 45: result = ((((a1 ^ 0x65) | (a1 << 8) | 0x3c) >>> 6)) ^ a2; break;
    case 46: result = ((((a1 ^ 0x5c) | (a1 << 8)) >>> 2)) ^ a2; break;
    case 47: result = (((((a2 ^ 0xaa) | (a2 << 8) | 0xff) >>> 3))) ^ a1; break;
    case 48: result = ((((a1 ^ 0x63) | (a1 << 8) | 0x5c) >>> 6)) ^ a2; break;
    case 49: result = ((((a1 ^ 0x5c) | (a1 << 8) | 0x36) >>> 7)) ^ a2; break;
    case 50: result = ((((a1 ^ 0x5c) | (a1 << 8)) >>> 6)) ^ a2; break;
    case 51: result = (((((a1 << 8) ^ 0xff00) | a1) >>> 3)) ^ a2; break;
    case 52: result = (((((~a1) & 0xff) | (a1 << 8)) >>> 6)) ^ a2; break;
    case 53: result = (((((a1 << 8) ^ 0xff00) | a1) >>> 5)) ^ a2; break;
    case 54: result = ((((a1 ^ 0x3c) | 0x65 | (a1 << 8)) >>> 4)) ^ a2; break;
    case 55: result = ((((a1 ^ 0x63) | (a1 << 8) | 0x5c) >>> 3)) ^ a2; break;
    case 56: result = ((((a1 ^ 0x63) | (a1 << 8) | 0x5c) >>> 5)) ^ a2; break;
    case 57: result = ((((a1 ^ 0xaf) | (a1 << 8) | 0xfa) >>> 5)) ^ a2; break;
    case 58: result = ((((a1 ^ 0x5c) | (a1 << 8) | 0x36) >>> 5)) ^ a2; break;
    case 59: result = ((((a1 ^ 0x5c) | (a1 << 8) | 0x36) >>> 3)) ^ a2; break;
    case 60: result = ((((a1 ^ 0x36) | (a1 << 8)) >>> 3)) ^ a2; break;
    case 61: result = ((((a1 ^ 0x63) | (a1 << 8) | 0x5c) >>> 4)) ^ a2; break;
    case 62: result = ((((a1 ^ 0xff) | (a1 << 8) | 0xaf) >>> 6)) ^ a2; break;
    case 63: result = (((((~a1) & 0xff) | (a1 << 8)) >>> 2)) ^ a2; break;
    default: return 0;
  }
  return result & 0xff;
}

/** Port of MoggCrypt.grind_array. useNewCrypt=false for 0x0C/0x0D. */
function grindArray(a1Raw: number, a2Raw: number, bar: Uint8Array, useNewCrypt: boolean): Uint8Array {
  // 32-bit signed LCG: a1 = 0x19660D * a1 + 0x3C6EF35F
  const lcg = (n: number): number => (Math.imul(0x19660d, n) + 0x3c6ef35f) | 0;

  const hashmap5 = new Int32Array(256);
  const hashmap6 = new Int32Array(256);
  let a1 = a1Raw | 0;
  let a2 = a2Raw | 0;

  // hashTo5Bits
  for (let i = 0; i < 256; i++) {
    hashmap5[i] = (a1 & 0xff) >>> 3;
    a1 = lcg(a1);
  }
  // hashTo6Bits
  a1 = a2;
  for (let i = 0; i < 256; i++) {
    hashmap6[i] = ((a1 & 0xff) >>> 2) & 0x3f;
    a1 = lcg(a1);
  }

  const usedSlots = new Uint8Array(64);
  const O69funcs = new Uint8Array(64);
  a2 = a2Raw | 0;
  if (a2 === 0) a2 = 0x303f;

  for (let i = 0; i < 32; i++) {
    let op: number;
    do {
      a2 = lcg(a2);
      op = (a2 >> 2) & 0x1f;
    } while (usedSlots[op] !== 0);
    O69funcs[i] = op;
    usedSlots[op] = 1;
  }

  let moggUnk0 = a1Raw | 0;
  if (useNewCrypt) {
    for (let i = 32; i < 64; i++) {
      let op: number;
      do {
        moggUnk0 = lcg(moggUnk0);
        op = ((moggUnk0 >> 2) & 0x1f) + 32;
      } while (usedSlots[op] !== 0);
      O69funcs[i] = op;
      usedSlots[op] = 1;
    }
  }

  const hashmap = useNewCrypt ? hashmap6 : hashmap5;
  const out = new Uint8Array(bar);

  for (let j = 0; j < 16; j++) {
    let ix = 0;
    let foo = out[j];
    for (let i = 0; i < 8; i++) {
      const op = O69funcs[hashmap[out[ix]] & (useNewCrypt ? 63 : 31)];
      foo = oFuncs(foo, out[ix + 1], op);
      ix += 2;
    }
    out[j] = foo;
  }
  return out;
}

/** Port of MoggCrypt.revealKey. Applies 14× superShuffle then XOR with transform. */
function revealKey(transform: Uint8Array, buf: Uint8Array): Uint8Array {
  const b = new Uint8Array(buf); // work on a copy
  const sw = (i: number, j: number) => { const t = b[i]; b[i] = b[j]; b[j] = t; };

  for (let iter = 0; iter < 14; iter++) {
    sw(19, 2);  sw(22, 1);  sw(23, 6);  sw(26, 5);  sw(27, 10); sw(30, 9);
    sw(31, 14); sw(2, 13);  sw(3, 18);  sw(6, 17);  sw(7, 22);  sw(10, 21);
    sw(11, 26); sw(14, 25); sw(15, 30); sw(18, 29);
    sw(29, 2);  sw(28, 3);  sw(25, 6);  sw(24, 7);  sw(21, 10); sw(20, 11);
    sw(17, 14); sw(16, 15); sw(13, 18); sw(12, 19); sw(9, 22);  sw(8, 23);
    sw(5, 26);  sw(4, 27);  sw(1, 30);  sw(0, 31);
    sw(16, 2);  sw(28, 3);  sw(12, 6);  sw(24, 7);  sw(8, 10);  sw(20, 11);
    sw(4, 14);  sw(16, 15); sw(0, 18);  sw(12, 19); sw(28, 22); sw(8, 23);
    sw(24, 26); sw(4, 27);  sw(20, 30); sw(0, 31);
    sw(29, 2);  sw(15, 3);  sw(25, 6);  sw(11, 7);  sw(21, 10); sw(7, 11);
    sw(17, 14); sw(3, 15);  sw(13, 18); sw(31, 19); sw(9, 22);  sw(27, 23);
    sw(5, 26);  sw(23, 27); sw(1, 30);  sw(19, 31);
    sw(29, 21); sw(28, 3);  sw(25, 25); sw(24, 7);  sw(21, 29); sw(20, 11);
    sw(17, 1);  sw(16, 15); sw(13, 5);  sw(12, 19); sw(9, 9);   sw(8, 23);
    sw(5, 13);  sw(4, 27);  sw(1, 17);  sw(0, 31);
    sw(29, 2);  sw(28, 22); sw(25, 6);  sw(24, 26); sw(21, 10); sw(20, 30);
    sw(17, 14); sw(16, 2);  sw(13, 18); sw(12, 6);  sw(9, 22);  sw(8, 10);
    sw(5, 26);  sw(4, 14);  sw(1, 30);  sw(0, 18);
  }
  for (let i = 0; i < 32; i++) b[i] ^= transform[i];
  return b;
}

/** Port of MoggCrypt.hex_string_to_bytes. Converts 32-byte ASCII-hex buffer to 16 bytes. */
function hexStringToBytes(h: Uint8Array): Uint8Array {
  const hexNibble = (c: number): number => {
    if (c > 96) return c - 87; // 'a'-'f'
    if (c > 64) return c - 55; // 'A'-'F'
    if (c > 47) return c - 48; // '0'-'9'
    return 0;
  };
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = (hexNibble(h[i * 2]) << 4) | hexNibble(h[i * 2 + 1]);
  }
  return out;
}

/**
 * Port of MoggCrypt.GenPrivateKey. Derives the CTR private key for versions 0x0C/0x0D.
 * hvKey = HMX_PRIVATE_KEY_0C, useNewCrypt = false for 0x0C and 0x0D.
 */
async function genPrivateKey(moggData: Uint8Array, useNewCrypt: boolean): Promise<Uint8Array> {
  const view = new DataView(moggData.buffer, moggData.byteOffset, moggData.byteLength);
  const numEntries = view.getInt32(16, true);
  const pubKeyStart = 20 + numEntries * 8;

  // fileKey = moggData[pubKeyStart + 16 + 32 .. +16]
  const fileKey = new Uint8Array(moggData.buffer, moggData.byteOffset + pubKeyStart + 48, 16).slice();

  // AES-ECB decrypt fileKey with HMX_PRIVATE_KEY_0C
  const key0C = await getAESKey0C();
  const decryptedKey = await aesECBDecrypt(fileKey, key0C);

  // tableOffset = (raw % 6) + 6 → range [1..11] (both JS and C# % preserve sign)
  const tableOffsetRaw = view.getInt32(pubKeyStart + 64, true);
  const tableOffset = (tableOffsetRaw % 6) + 6;

  // a4 and a5
  const a4 = view.getInt32(pubKeyStart + 16, true);
  const a5 = view.getInt32(pubKeyStart + 24, true);

  // Extract 32-byte hidden key from table
  const hiddenKey = new Uint8Array(HIDDEN_KEYS.buffer, tableOffset * 32, 32).slice();

  // Transform the hidden key
  const revealed = revealKey(HV_KEY_TRANSFORM, hiddenKey);

  // Decode as 32-char ASCII hex string → 16 bytes
  const groundBytes = grindArray(a4, a5, hexStringToBytes(revealed), useNewCrypt);

  // XOR with decrypted file key
  const retKey = new Uint8Array(16);
  for (let i = 0; i < 16; i++) retKey[i] = groundBytes[i] ^ decryptedKey[i];
  return retKey;
}

// ── End GenPrivateKey helpers ────────────────────────────────────────────────

/**
 * Parse the MOGG file structure to extract header info and OGG data.
 */
export function parseMoggHeader(data: Uint8Array): MoggHeader {
  const view = makeDataView(data);
  let pos = 0;
  const version = view.getInt32(pos, true) as CryptVersion;
  pos += 4;
  const oggOffset = view.getInt32(pos, true);
  pos += 4;
  const oggMapVersion = view.getInt32(pos, true);
  pos += 4;
  const oggBuffer = view.getInt32(pos, true);
  pos += 4;
  const entryCount = view.getInt32(pos, true);
  pos += 4;

  const chunks: Array<{ offset: number; value: number }> = [];
  for (let i = 0; i < entryCount; i++) {
    const offset = view.getInt32(pos, true);
    pos += 4;
    const value = view.getInt32(pos, true);
    pos += 4;
    chunks.push({ offset, value });
  }

  let publicKey = new Uint8Array(0);
  if (version !== CryptVersion.x0A) {
    const keySize = version === CryptVersion.x0B ? 0x10 : 0x48;
    publicKey = data.slice(pos, pos + keySize);
    pos += keySize;
  }

  const oggData = data.slice(pos);

  return {
    version,
    oggOffset,
    oggMapVersion,
    oggBuffer,
    chunks,
    publicKey,
    oggData,
  };
}

/**
 * Decrypt data in-place using AES-ECB-simulated CTR with a little-endian counter.
 * Generates keystream in batches of 65536 blocks to cap memory use on large files.
 * AES-ECB is simulated as AES-CBC(block, key, zeroIV)[0..15].
 */
async function decryptStream(
  data: Uint8Array,
  publicKeyShort: Uint8Array,
  aesKey: CryptoKey,
): Promise<void> {
  const iv = new Uint8Array(16);
  const numBlocks = Math.ceil(data.length / 16);
  // Batch size: 65536 blocks = 1 MB of keystream per round (few await points)
  const BATCH = 65536;
  const ctr = new Uint8Array(publicKeyShort.subarray(0, 16));

  for (let bStart = 0; bStart < numBlocks; bStart += BATCH) {
    const bEnd = Math.min(bStart + BATCH, numBlocks);
    const bLen = bEnd - bStart;

    // Pre-build all counter blocks for this batch
    const ctrs = new Uint8Array(bLen * 16);
    for (let i = 0; i < bLen; i++) {
      ctrs.set(ctr, i * 16);
      for (let j = 0; j < 16; j++) { if (++ctr[j]) break; }
    }

    // Encrypt all counter blocks in parallel
    const promises: Promise<Uint8Array>[] = new Array(bLen);
    for (let i = 0; i < bLen; i++) {
      promises[i] = crypto.subtle.encrypt(
        { name: "AES-CBC", iv },
        aesKey,
        ctrs.subarray(i * 16, (i + 1) * 16) as unknown as Uint8Array<ArrayBuffer>,
      ).then((buf) => new Uint8Array(buf, 0, 16));
    }
    const ks = await Promise.all(promises);

    // XOR data in-place with the keystream
    for (let i = 0; i < bLen; i++) {
      const base = (bStart + i) * 16;
      const len = Math.min(16, data.length - base);
      for (let j = 0; j < len; j++) data[base + j] ^= ks[i][j];
    }
  }
}

/**
 * Fix the HMXA → OggS magic conversion for versions that use it.
 * Port of MoggFile.FixHMXAHeader (decrypt path only).
 */
function fixHmxaHeader(oggData: Uint8Array, publicKey: Uint8Array): void {
  if (publicKey.length >= 0x48) {
    const serial = ((oggData[0x0c] << 24) | (oggData[0x0d] << 16) | (oggData[0x0e] << 8) | oggData[0x0f]) >>> 0;
    const checksum = ((oggData[0x14] << 24) | (oggData[0x15] << 16) | (oggData[0x16] << 8) | oggData[0x17]) >>> 0;

    const mogg0x18 = new DataView(publicKey.buffer, publicKey.byteOffset + 0x18, 4).getUint32(0, true);
    const mogg0x10 = new DataView(publicKey.buffer, publicKey.byteOffset + 0x10, 4).getUint32(0, true);

    const checksumCrypt = (((Math.imul(mogg0x18 ^ 0x36363636, 0x00190000 + 0x0000660d) >>> 0) + 0x3c6f0000 - 0xca1) >>> 0);
    let serialCrypt = (((Math.imul(mogg0x10 ^ 0x5c5c5c5c, 0x00190000 + 0x0000660d) >>> 0) + 0x3c6f0000 - 0xca1) >>> 0);
    serialCrypt = (((Math.imul(serialCrypt, 0x00190000 + 0x660d) >>> 0) + 0x3c6f0000 - 0xca1) >>> 0);

    const newSerial = (serialCrypt ^ serial) >>> 0;
    const newChecksum = (checksumCrypt ^ checksum) >>> 0;

    // Write OggS magic
    oggData.set(OGGS_MAGIC, 0);
    // Write serial (big-endian) at 0x0C
    oggData[0x0c] = (newSerial >>> 24) & 0xff;
    oggData[0x0d] = (newSerial >>> 16) & 0xff;
    oggData[0x0e] = (newSerial >>> 8) & 0xff;
    oggData[0x0f] = (newSerial) & 0xff;
    // Write checksum (big-endian) at 0x14
    oggData[0x14] = (newChecksum >>> 24) & 0xff;
    oggData[0x15] = (newChecksum >>> 16) & 0xff;
    oggData[0x16] = (newChecksum >>> 8) & 0xff;
    oggData[0x17] = (newChecksum) & 0xff;
  } else {
    // Simple replacement
    oggData.set(OGGS_MAGIC, 0);
  }
}

/**
 * Decrypt a MOGG file's OGG data.
 * Supports 0x0B (static key) and 0x0C/0x0D (derived key).
 * For other versions, use the customDecrypt callback.
 *
 * Port of MoggFile.Decrypt + SaveToFile(includeHeader=true, includeKey=false).
 *
 * @param moggData - Raw MOGG file bytes
 * @param customDecrypt - Optional callback for unsupported versions
 * @returns Decrypted MOGG data (public key stripped from header), or null if failed
 */
export async function decryptMogg(
  moggData: Uint8Array,
  customDecrypt?: (
    moggData: Uint8Array,
    version: number,
  ) => Promise<Uint8Array | null> | Uint8Array | null,
): Promise<Uint8Array | null> {
  const header = parseMoggHeader(moggData);

  // Not encrypted
  if (header.version === CryptVersion.x0A) return moggData;

  let privateKey: Uint8Array;
  let stripPublicKey: boolean;

  if (header.version === CryptVersion.x0B) {
    if (header.publicKey.length !== 0x10) return null;
    privateKey = HMX_PRIVATE_KEY_0B;
    stripPublicKey = false; // 0x0B: keep the 16-byte key in header (matches C# default)
  } else if (header.version === CryptVersion.x0C || header.version === CryptVersion.x0D) {
    if (header.publicKey.length !== 0x48) return null;
    privateKey = await genPrivateKey(moggData, false);
    stripPublicKey = true; // strip the 0x48-byte key from output header
  } else {
    if (customDecrypt) return await customDecrypt(moggData, header.version);
    return null;
  }

  const publicKeyShort = header.publicKey.subarray(0, 16);
  const aesKey =
    header.version === CryptVersion.x0B
      ? await getAESKey()
      : await crypto.subtle.importKey("raw", privateKey as unknown as Uint8Array<ArrayBuffer>, { name: "AES-CBC" }, false, ["encrypt"]);

  const oggData = new Uint8Array(header.oggData); // copy to avoid mutating input
  await decryptStream(oggData, publicKeyShort, aesKey);

  // Validate: check for OggS or HMXA magic
  const magic = oggData.subarray(0, 4);
  if (arrEquals(magic, HMXA_MAGIC)) {
    fixHmxaHeader(oggData, header.publicKey);
  } else if (!arrEquals(magic, OGGS_MAGIC)) {
    return null; // Decryption failed
  }

  // Reconstruct output header (version 0x0A, optionally without public key)
  const encHeaderSize = moggData.length - header.oggData.length;
  const pubKeySize = stripPublicKey ? header.publicKey.length : 0;
  const newOggOffset = header.oggOffset - pubKeySize;
  const newHeaderSize = encHeaderSize - pubKeySize;

  const result = new Uint8Array(newHeaderSize + oggData.length);
  const dv = new DataView(result.buffer);
  dv.setInt32(0, CryptVersion.x0A, true); // version = 0x0A
  dv.setInt32(4, newOggOffset, true); // updated oggOffset
  // Copy OggMapVersion, OggBuffer, entryCount, chunks (bytes 8..encHeaderSize-pubKeySize)
  result.set(moggData.subarray(8, encHeaderSize - pubKeySize), 8);
  // Copy decrypted OGG data after the new header
  result.set(oggData, newHeaderSize);

  return result;
}

/**
 * Check if a MOGG file is encrypted.
 */
export function isMoggEncrypted(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  const version = makeDataView(data).getInt32(0, true);
  return version !== CryptVersion.x0A;
}

/**
 * Get the encryption version of a MOGG file.
 */
export function getMoggVersion(data: Uint8Array): CryptVersion {
  if (data.length < 4) return CryptVersion.x0A;
  return makeDataView(data).getInt32(0, true) as CryptVersion;
}
