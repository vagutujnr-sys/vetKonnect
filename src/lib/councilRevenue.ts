import type { AnimalControlCase, Pet, PetLicence } from "@/types";

/** Proposed municipal fee schedule (USD). Adjust when Council finalises rates. */
export const COUNCIL_FEE_SCHEDULE = {
  currency: "USD",
  dogLicenceAnnual: 25,
  catLicenceAnnual: 15,
  otherLicenceAnnual: 10,
  impoundFee: 40,
  incidentAdminFee: 50,
  newRegistrationFee: 10,
} as const;

export type RevenuePeriod = "monthly" | "quarterly" | "biannual" | "annual";

export type CouncilRevenueSnapshot = {
  currency: string;
  /** Realised / booked from active licences (annual fee run-rate). */
  activeLicenceRevenueAnnual: number;
  /** Lost / at risk from expired licences. */
  expiredLicenceRevenueAnnual: number;
  /** Gap if every registered dog were licensed. */
  unlicensedDogsOpportunity: number;
  /** Full compliance dog-licence revenue (all dogs licensed). */
  fullComplianceDogRevenueAnnual: number;
  /** Open impound cases × impound fee (recoverable). */
  openImpoundRecoverable: number;
  /** Open incidents × admin fee (proposed). */
  openIncidentFees: number;
  /** Active licence count used in calc. */
  activeLicenceCount: number;
  expiredLicenceCount: number;
  unlicensedDogCount: number;
  registeredDogs: number;
  /** Share of dog-licence opportunity currently captured. */
  captureRatePct: number;
  feeSchedule: typeof COUNCIL_FEE_SCHEDULE;
};

export type CouncilRevenueProjection = {
  period: RevenuePeriod;
  label: string;
  /** Based on current active licences (run-rate). */
  expected: number;
  /** If compliance rises to 100% of registered dogs. */
  proposedFullCompliance: number;
  /** Mid case: halfway between expected and full compliance. */
  proposedGrowth: number;
  months: number;
};

function licenceAnnualFee(species?: string | null): number {
  const key = String(species ?? "").toLowerCase();
  if (key.includes("dog")) return COUNCIL_FEE_SCHEDULE.dogLicenceAnnual;
  if (key.includes("cat")) return COUNCIL_FEE_SCHEDULE.catLicenceAnnual;
  return COUNCIL_FEE_SCHEDULE.otherLicenceAnnual;
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
  const { dogs, licences, cases } = input;
  const licensedPetIds = new Set(licences.filter((l) => l.petId).map((l) => l.petId as string));
  const active = licences.filter((l) => l.status === "active");
  const expired = licences.filter((l) => l.status === "expired");
  const unlicensedDogs = dogs.filter((d) => !licensedPetIds.has(d.id));

  const activeLicenceRevenueAnnual = active.reduce((sum, l) => sum + licenceAnnualFee(l.species), 0);
  const expiredLicenceRevenueAnnual = expired.reduce((sum, l) => sum + licenceAnnualFee(l.species), 0);
  const fullComplianceDogRevenueAnnual = dogs.length * COUNCIL_FEE_SCHEDULE.dogLicenceAnnual;
  const unlicensedDogsOpportunity = unlicensedDogs.length * COUNCIL_FEE_SCHEDULE.dogLicenceAnnual;

  const openImpound = cases.filter((c) => c.caseType === "impound" && c.status === "open").length;
  const openIncidents = cases.filter((c) => c.caseType === "incident" && c.status === "open").length;

  const captureRatePct =
    fullComplianceDogRevenueAnnual <= 0
      ? 100
      : Math.round((Math.min(activeLicenceRevenueAnnual, fullComplianceDogRevenueAnnual) / fullComplianceDogRevenueAnnual) * 100);

  return {
    currency: COUNCIL_FEE_SCHEDULE.currency,
    activeLicenceRevenueAnnual,
    expiredLicenceRevenueAnnual,
    unlicensedDogsOpportunity,
    fullComplianceDogRevenueAnnual,
    openImpoundRecoverable: openImpound * COUNCIL_FEE_SCHEDULE.impoundFee,
    openIncidentFees: openIncidents * COUNCIL_FEE_SCHEDULE.incidentAdminFee,
    activeLicenceCount: active.length,
    expiredLicenceCount: expired.length,
    unlicensedDogCount: unlicensedDogs.length,
    registeredDogs: dogs.length,
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
  fromIso: string,
  toIso: string,
): number {
  const from = fromIso.slice(0, 10);
  const to = toIso.slice(0, 10);
  return licences
    .filter((l) => l.issuedAt >= from && l.issuedAt <= to)
    .reduce((sum, l) => sum + licenceAnnualFee(l.species), 0);
}
