import type { DvsAnimalLicence, DvsLicencePayment, DvsPaymentMethod } from "@/types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export async function initiateDvsLicencePayment(input: {
  petId: string;
  method: Extract<DvsPaymentMethod, "paynow" | "ecocash" | "onemoney">;
  phone?: string;
  email?: string;
}): Promise<{ payment: DvsLicencePayment; redirectUrl?: string; instructions?: string; demo?: boolean }> {
  return readJson(
    await fetch("/api/paynow/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function pollDvsLicencePayment(input: {
  paymentId?: string;
  reference?: string;
}): Promise<{ payment: DvsLicencePayment | null; licence: DvsAnimalLicence | null }> {
  return readJson(
    await fetch("/api/paynow/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
