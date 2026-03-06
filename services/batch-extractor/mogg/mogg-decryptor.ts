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

const OGGS_MAGIC = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
const HMXA_MAGIC = new Uint8Array([0x48, 0x4d, 0x58, 0x41]);

// Cached CryptoKey for AES operations (imported once, reused)
let cachedKey: CryptoKey | null = null;

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
 * Generate the full AES-ECB keystream for a given starting counter block.
 *
 * AES-ECB(block) is simulated as AES-CBC(block, zeroIV)[0..15].
 * All blocks are submitted to WebCrypto in parallel via Promise.all,
 * then the keystream is assembled synchronously — avoiding the per-chunk
 * async overhead of the original one-call-per-16-bytes approach.
 */
async function generateKeystream(
  publicKey: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await getAESKey();
  const iv = new Uint8Array(16); // zero IV
  const numBlocks = Math.ceil(length / 16);

  // Build counter blocks upfront (little-endian increment from publicKey)
  const cipherIn = new Uint8Array(16);
  cipherIn.set(publicKey.subarray(0, 16));
  const counterBlocks = new Array<Uint8Array>(numBlocks);
  for (let i = 0; i < numBlocks; i++) {
    counterBlocks[i] = cipherIn.slice();
    for (let j = 0; j < 16; j++) {
      cipherIn[j]++;
      if (cipherIn[j] !== 0) break;
    }
  }

  // Fire all AES-ECB calls in parallel — one WebCrypto round-trip instead of N
  const ciphertexts = await Promise.all(
    counterBlocks.map((block) =>
      crypto.subtle.encrypt(
        { name: "AES-CBC", iv },
        key,
        block as unknown as Uint8Array<ArrayBuffer>,
      ),
    ),
  );

  // Assemble the keystream (CBC with 16-byte input produces 32 bytes due to
  // PKCS7 padding; we only need the first 16 bytes of each block)
  const keystream = new Uint8Array(length);
  for (let i = 0; i < numBlocks; i++) {
    const ks = new Uint8Array(ciphertexts[i], 0, 16);
    const base = i * 16;
    const end = Math.min(base + 16, length);
    keystream.set(ks.subarray(0, end - base), base);
  }
  return keystream;
}

/**
 * Decrypt a MOGG file's OGG data in-place.
 * Only supports version 0x0B (static key). For other versions, use the callback hook.
 *
 * @param moggData - Raw MOGG file bytes
 * @param customDecrypt - Optional callback for versions other than 0x0B
 * @returns Decrypted MOGG data (with header), or null if decryption failed
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

  // Only 0x0B is supported with static key
  if (header.version !== CryptVersion.x0B) {
    if (customDecrypt) return await customDecrypt(moggData, header.version);
    return null; // Unsupported version
  }

  if (header.publicKey.length !== 0x10) return null;

  const oggData = new Uint8Array(header.oggData); // copy to avoid mutating input

  // Generate the full keystream in one parallel batch, then XOR synchronously
  const keystream = await generateKeystream(header.publicKey, oggData.length);
  for (let i = 0; i < oggData.length; i++) {
    oggData[i] ^= keystream[i];
  }

  // Validate decryption: check for OggS or HMXA header
  const magic = oggData.subarray(0, 4);
  if (arrEquals(magic, HMXA_MAGIC)) {
    oggData.set(OGGS_MAGIC, 0);
  } else if (!arrEquals(magic, OGGS_MAGIC)) {
    return null; // Decryption failed
  }

  // Reconstruct the full file with version 0x0A (decrypted) header
  const headerSize = moggData.length - header.oggData.length;
  const result = new Uint8Array(headerSize + oggData.length);
  new DataView(result.buffer).setInt32(0, CryptVersion.x0A, true);
  result.set(moggData.subarray(4, headerSize), 4);
  result.set(oggData, headerSize);

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
