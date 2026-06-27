import { isBrowserRuntime } from './imports.js'

/**
 * djb2 string hash — fast non-cryptographic hash returning a signed 32-bit int.
 * Deterministic across runtimes.
 */
export function djb2Hash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

function fnv1a64Hex(content: string, seed = 0xcbf29ce484222325n): string {
  // FNV-1a 64-bit, encoded as fixed-width hex for browser-safe sync hashing.
  let hash = seed
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn

  for (let i = 0; i < content.length; i += 1) {
    hash ^= BigInt(content.charCodeAt(i))
    hash = (hash * prime) & mask
  }

  return hash.toString(16).padStart(16, '0')
}

function browserStableHashHex(content: string): string {
  // Concatenate four salted FNV-1a passes so the browser fallback keeps a
  // 64-character output shape without depending on Node crypto.
  return [0n, 1n, 2n, 3n]
    .map(salt => fnv1a64Hex(content, 0xcbf29ce484222325n ^ salt))
    .join('')
}

/**
 * Hash arbitrary content for change detection.
 *
 * Browser runtime always uses the pure JS fallback so web UI code never
 * depends on Node crypto shims. Bun runtime keeps the fast path.
 */
export function hashContent(content: string): string {
  if (isBrowserRuntime()) {
    return browserStableHashHex(content)
  }
  if (typeof Bun !== 'undefined' && typeof Bun.hash === 'function') {
    return Bun.hash(content).toString()
  }
  return browserStableHashHex(content)
}

/**
 * Hash two strings without allocating a concatenated temp string.
 */
export function hashPair(a: string, b: string): string {
  if (isBrowserRuntime()) {
    return browserStableHashHex(`${a}\0${b}`)
  }
  if (typeof Bun !== 'undefined' && typeof Bun.hash === 'function') {
    return Bun.hash(b, Bun.hash(a)).toString()
  }
  return browserStableHashHex(`${a}\0${b}`)
}
