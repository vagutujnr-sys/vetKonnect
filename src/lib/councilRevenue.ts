import type { AnimalControlCase, Pet, PetLicence } from "@/types";

/**
 * Official Harare City Council (Dog Licensing and Control) By-laws fees.
 * Indexed to USD (or local currency at the prevailing interbank rate).
 * Licence badges require a valid Rabies Vaccination Certificate.
 */
export const COUNCIL_FEE_SCHEDULE = {
  currency: "USD",
  /** Dog (male) — annual licence */
  dogMaleLicence: 5,
  /** Bitch (female) — annual licence */
  dogFemaleLicence: 10,
  /** Replacement badge — no charge */
  replacementBadge: 0,
  /** Penalty for an unlicensed dog */
  unlicensedDogPenalty: 20,
  source: "Harare City Council (Dog Licensing and Control) By-laws",
} as const;

export type RevenuePeriod = "monthly" | "quarterly" | "biannual" | "annual";

export type CouncilRevenueSnapshot = {
  currency: string;
  /** Realised from active dog licences (annual fee run-rate). */
  activeLicenceRevenueAnnual: number;
  /** Value of expired licences (renewal opportunity). */
  expiredLicenceRevenueAnnual: number;
  /** Licence fees if every registered dog were licensed. */
  unlicensedDogsOpportunity: number;
  /** Full compliance dog-licence revenue (all dogs licensed). */
  fullComplianceDogRevenueAnnual: number;
  /** Potential penalties if unlicensed dogs were enforced. */
  unlicensedPenaltyExposure: number;
  activeLicenceCount: number;
  expiredLicenceCount: number;
  unlicensedDogCount: number;
  registeredDogs: number;
  maleDogs: number;
  femaleDogs: number;
  captureRatePct: number;
  feeSchedule: typeof COUNCIL_FEE_SCHEDULE;
};

export type CouncilRevenueProjection = {
  period: RevenuePeriod;
  label: string;
  expected: number;
  proposedFullCompliance: number;
  proposedGrowth: number;
  months: number;
};

function isFemaleDog(sex?: string | null): boolean {
  const key = String(sex ?? "").toLowerCase();
  return key === "female" || key.includes("bitch");
}

/** Official annual dog licence fee by sex. */
export function dogLicenceFee(sex?: string | null): number {
  return isFemaleDog(sex) ? COUNCIL_FEE_SCHEDULE.dogFemaleLicence : COUNCIL_FEE_SCHEDULE.dogMaleLicence;
}

function dogsById(dogs: Pet[]): Map<string, Pet> {
  return new Map(dogs.map((dog) => [dog.id, dog]));
}

function licenceFeeForRow(licence: PetLicence, pets: Map<string, Pet>): number {
  if (licence.petId && pets.has(licence.petId)) {
    return dogLicenceFee(pets.get(licence.petId)!.sex);
  }
  // Dog licences without a linked pet: use male rate as the conservative base fee.
  const species = String(licence.species ?? "").toLowerCase();
  if (species && !species.includes("dog")) return 0;
  return COUNCIL_FEE_SCHEDULE.dogMaleLicence;
}

export function formatCouncilMoney(amount: number, currency: string = COUNCIL_FEE_SCHEDULE.currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildCouncilRevenueSnapshot(input: {
  dogs: Pet[];
  licences: PetLicence[];
  cases: AnimalControlCase[];
}): CouncilRevenueSnapshot {
  const { dogs, licences } = input;
  const petMap = dogsById(dogs);
  const licensedPetIds = new Set(licences.filter((l) => l.petId).map((l) => l.petId as string));
  const active = licences.filter((l) => l.status === "active");
  const expired = licences.filter((l) => l.status === "expired");
  const unlicensedDogs = dogs.filter((d) => !licensedPetIds.has(d.id));
  const maleDogs = dogs.filter((d) => !isFemaleDog(d.sex)).length;
  const femaleDogs = dogs.filter((d) => isFemaleDog(d.sex)).length;

  const activeLicenceRevenueAnnual = active.reduce((sum, l) => sum + licenceFeeForRow(l, petMap), 0);
  const expiredLicenceRevenueAnnual = expired.reduce((sum, l) => sum + licenceFeeForRow(l, petMap), 0);
  const fullComplianceDogRevenueAnnual = dogs.reduce((sum, dog) => sum + dogLicenceFee(dog.sex), 0);
  const unlicensedDogsOpportunity = unlicensedDogs.reduce((sum, dog) => sum + dogLicenceFee(dog.sex), 0);
  const unlicensedPenaltyExposure = unlicensedDogs.length * COUNCIL_FEE_SCHEDULE.unlicensedDogPenalty;

  const captureRatePct =
    fullComplianceDogRevenueAnnual <= 0
      ? 100
      : Math.round(
          (Math.min(activeLicenceRevenueAnnual, fullComplianceDogRevenueAnnual) / fullComplianceDogRevenueAnnual) * 100,
        );

  return {
    currency: COUNCIL_FEE_SCHEDULE.currency,
    activeLicenceRevenueAnnual,
    expiredLicenceRevenueAnnual,
    unlicensedDogsOpportunity,
    fullComplianceDogRevenueAnnual,
    unlicensedPenaltyExposure,
    activeLicenceCount: active.length,
    expiredLicenceCount: expired.length,
    unlicensedDogCount: unlicensedDogs.length,
    registeredDogs: dogs.length,
    maleDogs,
    femaleDogs,
    captureRatePct,
    feeSchedule: COUNCIL_FEE_SCHEDULE,
  };
}

export function buildCouncilRevenueProjections(snapshot: CouncilRevenueSnapshot): CouncilRevenueProjection[] {
  const annualExpected = snapshot.activeLicenceRevenueAnnual;
  const annualFull = snapshot.fullComplianceDogRevenueAnnual;
  const annualGrowth = Math.round((annualExpected + annualFull) / 2);

  const periods: Array<{ period: RevenuePeriod; label: string; months: number }> = [
    { period: "monthly", label: "Monthly", months: 1 },
    { period: "quarterly", label: "Quarterly", months: 3 },
    { period: "biannual", label: "Bi-annually", months: 6 },
    { period: "annual", label: "Annually", months: 12 },
  ];

  return periods.map(({ period, label, months }) => {
    const factor = months / 12;
    return {
      period,
      label,
      months,
      expected: Math.round(annualExpected * factor),
      proposedFullCompliance: Math.round(annualFull * factor),
      proposedGrowth: Math.round(annualGrowth * factor),
    };
  });
}

export function estimatePeriodLicenceRevenue(
  licences: PetLicence[],
  dogs: Pet[],
  fromIso: string,
  toIso: string,
): number {
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  const petMap = dogsById(dogs);
  return licences
    .filter((l) => l.issuedAt >= from && l.issuedAt <= to)
    .reduce((sum, l) => sum + licenceFeeForRow(l, petMap), 0);
}
