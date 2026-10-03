export const DVS_LICENCE_FEES = {
  currency: "USD",
  dog: 8,
  cat: 5,
  other: 6,
  validityDays: 365,
  source: "City council — annual pet registration",
} as const;

export function dvsLicenceFeeForSpecies(species?: string | null): number {
  const key = String(species ?? "").toLowerCase();
  if (key.includes("cat")) return DVS_LICENCE_FEES.cat;
  if (key.includes("dog")) return DVS_LICENCE_FEES.dog;
  return DVS_LICENCE_FEES.other;
}

export function formatDvsMoney(amount: number, currency = DVS_LICENCE_FEES.currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** Owner-facing payment copy. Internal record prefixes stay in the database. */
export function councilFacingText(value: string): string {
  return value
    .replace(/Department of Veterinary Services/gi, "City council")
    .replace(/ZW-DVS-LIC/g, "ZW-COUNCIL-REG")
    .replace(/DVS-LIC/g, "COUNCIL-REG")
    .replace(/\bDVS\b/g, "Council");
}

export function addLicenceDays(isoDate: string, days = DVS_LICENCE_FEES.validityDays): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
