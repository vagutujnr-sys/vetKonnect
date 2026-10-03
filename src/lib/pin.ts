export const PIN_LENGTH = 5;

export function isPin(value: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return bytesToHex(bits);
}

export async function createPinHash(pin: string): Promise<string> {
  if (!isPin(pin)) throw new Error("Enter a 5-digit PIN.");
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const hash = await hashPin(pin, salt);
  return `${salt}:${hash}`;
}

export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || !isPin(pin)) return false;
  const actual = await hashPin(pin, salt);
  return actual === expected;
}
