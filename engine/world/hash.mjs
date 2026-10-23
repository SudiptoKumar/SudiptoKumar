// Tiny deterministic hash (FNV-1a, 32 bit) for world signatures and markup fingerprints. Not for security.
export function h32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
