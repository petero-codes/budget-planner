/** Domain IDs are UUID strings (compatible with SQL Server UNIQUEIDENTIFIER). */

export function newId(_prefix?: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deterministic UUID from a stable seed key (works in browser + Node).
 * Used so mock seed IDs match rows inserted into SQL Server.
 */
export function seedUuid(key: string): string {
  const input = `kengen-budget-ops:${key}`;
  const bytes = new Uint8Array(16);
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x100000;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= input.charCodeAt(i) + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  for (let i = 0; i < 8; i++) {
    bytes[i] = (h1 >>> (i * 4)) & 0xff;
    bytes[8 + i] = (h2 >>> (i * 4)) & 0xff;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
