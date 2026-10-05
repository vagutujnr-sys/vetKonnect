export const PIN_LENGTH = 5;

const FAST_PREFIX = "sha256";
const LEGACY_ITERATIONS = 120_000;

export function isPin(value: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(value);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

/** Older PINs used a slow PBKDF2 hash that could freeze the tab before a session was saved. */
export function isLegacyPinHash(stored: string): boolean {
  return Boolean(stored) && !stored.startsWith(`${FAST_PREFIX}:`);
}

async function legacyPbkdf2Hex(pin: string, saltHex: string): Promise<string> {
  if (typeof Worker === "undefined") {
    throw new Error("Could not check that PIN on this browser. Try again.");
  }

  const source = `
    self.onmessage = async (event) => {
      try {
        const { pin, saltHex, iterations } = event.data;
        const pairs = saltHex.match(/.{1,2}/g) || [];
        const salt = new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
          key,
          256,
        );
        const hex = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
        self.postMessage({ hex });
      } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : "Could not check that PIN." });
      }
    };
  `;
  const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
  return await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("PIN check took too long. Try again."));
    }, 4000);
    worker.onmessage = (event: MessageEvent<{ hex?: string; error?: string }>) => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data?.hex) resolve(event.data.hex);
      else reject(new Error(event.data?.error || "Could not check that PIN."));
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error("Could not check that PIN."));
    };
    worker.postMessage({ pin, saltHex, iterations: LEGACY_ITERATIONS });
  });
}

export async function createPinHash(pin: string): Promise<string> {
  if (!isPin(pin)) throw new Error("Enter a 5-digit PIN.");
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await sha256Hex(`${salt}:${pin}`);
  return `${FAST_PREFIX}:${salt}:${hash}`;
}

export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  if (!isPin(pin) || !stored) return false;

  if (stored.startsWith(`${FAST_PREFIX}:`)) {
    const [, salt, expected] = stored.split(":");
    if (!salt || !expected) return false;
    const actual = await sha256Hex(`${salt}:${pin}`);
    return actual === expected;
  }

  const [salt, expected] = stored.split(":");
  if (!salt || !expected || stored.split(":").length !== 2) return false;
  const actual = await legacyPbkdf2Hex(pin, salt);
  return actual === expected;
}
