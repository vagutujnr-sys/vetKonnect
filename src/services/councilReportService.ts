import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  buildCouncilRevenueSnapshot,
  estimatePeriodLicenceRevenue,
  formatCouncilMoney,
  COUNCIL_FEE_SCHEDULE,
} from "@/lib/councilRevenue";
import { getAllPets } from "@/services/petService";
import { listAnimalControlCases, listPetLicences } from "@/services/councilService";
import { supabase } from "@/services/supabaseClient";
import type { AnimalControlCase, Pet, PetLicence } from "@/types";

export type CouncilReportPeriod = {
  from: string;
  to: string;
};

export type CouncilSystemReport = {
  generatedAt: string;
  period: CouncilReportPeriod;
  summary: {
    registeredPets: number;
    registeredDogs: number;
    petsRegisteredInPeriod: number;
    activeLicences: number;
    expiredLicences: number;
    licencesIssuedInPeriod: number;
    casesInPeriod: number;
    lostInPeriod: number;
    foundInPeriod: number;
    impoundInPeriod: number;
    incidentsInPeriod: number;
    estimatedLicenceRevenueInPeriod: number;
    estimatedUnlicensedPenaltyExposure: number;
    estimatedTotalRevenueInPeriod: number;
  };
  licencesInPeriod: PetLicence[];
  casesInPeriod: AnimalControlCase[];
  petsRegisteredInPeriod: Array<{ id: string; name: string; species: string; createdAt: string }>;
  revenue: ReturnType<typeof buildCouncilRevenueSnapshot>;
};

function inRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from.slice(0, 10) && day <= to.slice(0, 10);
}

export async function buildCouncilSystemReport(period: CouncilReportPeriod): Promise<CouncilSystemReport> {
  const from = period.from.slice(0, 10);
  const to = period.to.slice(0, 10);
  if (!from || !to || from > to) throw new Error("Choose a valid from / to date range.");

  const [pets, licences, cases, petRows] = await Promise.all([
    getAllPets(),
    listPetLicences(),
    listAnimalControlCases(),
    supabase.from("pets").select("id, name, species, created_at").order("created_at", { ascending: false }),
  ]);

  if (petRows.error && !String(petRows.error.message).toLowerCase().includes("does not exist")) {
    // Non-fatal if created_at missing shape — fall back to empty period pets.
    console.warn(petRows.error);
  }

  const petsRegisteredInPeriod = (petRows.data ?? [])
    .filter((row) => row.created_at && inRange(String(row.created_at), from, to))
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      species: String(row.species ?? ""),
      createdAt: String(row.created_at ?? "").slice(0, 10),
    }));

  const licencesInPeriod = licences.filter((l) => inRange(l.issuedAt, from, to));
  const casesInPeriod = cases.filter((c) => inRange(c.reportedAt, from, to));
  const dogs = pets.filter((p) => String(p.species).toLowerCase() === "dog");
  const revenue = buildCouncilRevenueSnapshot({ dogs, licences, cases });

  const estimatedLicenceRevenueInPeriod = estimatePeriodLicenceRevenue(licences, dogs, from, to);
  const unlicensedInPeriodPenalty =
    Math.max(0, dogs.length - licences.filter((l) => l.status === "active").length) *
    0; // penalty is exposure, not period booking — keep licence revenue as primary
  const estimatedUnlicensedPenaltyExposure = revenue.unlicensedPenaltyExposure;

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    summary: {
      registeredPets: pets.length,
      registeredDogs: dogs.length,
      petsRegisteredInPeriod: petsRegisteredInPeriod.length,
      activeLicences: licences.filter((l) => l.status === "active").length,
      expiredLicences: licences.filter((l) => l.status === "expired").length,
      licencesIssuedInPeriod: licencesInPeriod.length,
      casesInPeriod: casesInPeriod.length,
      lostInPeriod: casesInPeriod.filter((c) => c.caseType === "lost").length,
      foundInPeriod: casesInPeriod.filter((c) => c.caseType === "found").length,
      impoundInPeriod: casesInPeriod.filter((c) => c.caseType === "impound").length,
      incidentsInPeriod: casesInPeriod.filter((c) => c.caseType === "incident").length,
      estimatedLicenceRevenueInPeriod,
      estimatedUnlicensedPenaltyExposure,
      estimatedTotalRevenueInPeriod: estimatedLicenceRevenueInPeriod + unlicensedInPeriodPenalty,
    },
    licencesInPeriod,
    casesInPeriod,
    petsRegisteredInPeriod,
    revenue,
  };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCouncilReportExcel(report: CouncilSystemReport): void {
  const wb = XLSX.utils.book_new();
  const money = (n: number) => formatCouncilMoney(n, report.revenue.currency);

  const summaryRows = [
    ["City Council — VetKonnect system report"],
    ["Period", `${report.period.from} → ${report.period.to}`],
    ["Generated", report.generatedAt],
    [],
    ["Metric", "Value"],
    ["Registered pets (all time)", report.summary.registeredPets],
    ["Registered dogs (all time)", report.summary.registeredDogs],
    ["Pets registered in period", report.summary.petsRegisteredInPeriod],
    ["Active licences", report.summary.activeLicences],
    ["Expired licences", report.summary.expiredLicences],
    ["Licences issued in period", report.summary.licencesIssuedInPeriod],
    ["Cases in period", report.summary.casesInPeriod],
    ["Lost in period", report.summary.lostInPeriod],
    ["Found in period", report.summary.foundInPeriod],
    ["Impound in period", report.summary.impoundInPeriod],
    ["Incidents in period", report.summary.incidentsInPeriod],
    ["Est. licence revenue (period)", money(report.summary.estimatedLicenceRevenueInPeriod)],
    ["Unlicensed penalty exposure", money(report.summary.estimatedUnlicensedPenaltyExposure)],
    ["Est. total licence revenue (period)", money(report.summary.estimatedTotalRevenueInPeriod)],
    ["Active licence annual run-rate", money(report.revenue.activeLicenceRevenueAnnual)],
    ["Full compliance dog annual", money(report.revenue.fullComplianceDogRevenueAnnual)],
    ["Revenue capture rate %", `${report.revenue.captureRatePct}%`],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  const licenceSheet = report.licencesInPeriod.map((l) => ({
    Licence: l.licenceNumber,
    Pet: l.petName ?? "",
    Species: l.species ?? "",
    Issued: l.issuedAt,
    Expires: l.expiresAt,
    Status: l.status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(licenceSheet), "Licences");

  const caseSheet = report.casesInPeriod.map((c) => ({
    Type: c.caseType,
    Title: c.title,
    Status: c.status,
    Location: c.locationLabel ?? "",
    Reported: c.reportedAt.slice(0, 10),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caseSheet), "Cases");

  const petSheet = report.petsRegisteredInPeriod.map((p) => ({
    Name: p.name,
    Species: p.species,
    Registered: p.createdAt,
    Id: p.id,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(petSheet), "New pets");

  const fees = [
    ["Official fee schedule (Harare by-laws)", "Amount USD"],
    ["Dog (male) — annual licence", COUNCIL_FEE_SCHEDULE.dogMaleLicence],
    ["Bitch (female) — annual licence", COUNCIL_FEE_SCHEDULE.dogFemaleLicence],
    ["Replacement badge", COUNCIL_FEE_SCHEDULE.replacementBadge],
    ["Penalty for an unlicensed dog", COUNCIL_FEE_SCHEDULE.unlicensedDogPenalty],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fees), "Fee schedule");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `council-report-${report.period.from}_to_${report.period.to}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function exportCouncilReportPdf(report: CouncilSystemReport): void {
  const doc = new jsPDF();
  const money = (n: number) => formatCouncilMoney(n, report.revenue.currency);

  doc.setFontSize(16);
  doc.text("City Council — System Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Period: ${report.period.from} → ${report.period.to}`, 14, 26);
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 32);
  doc.text("In association with VetKonnect · Official Harare dog licence fees", 14, 38);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Registered pets", String(report.summary.registeredPets)],
      ["Registered dogs", String(report.summary.registeredDogs)],
      ["Pets registered in period", String(report.summary.petsRegisteredInPeriod)],
      ["Active licences", String(report.summary.activeLicences)],
      ["Licences issued in period", String(report.summary.licencesIssuedInPeriod)],
      ["Cases in period", String(report.summary.casesInPeriod)],
      ["Est. licence revenue (period)", money(report.summary.estimatedLicenceRevenueInPeriod)],
      ["Unlicensed penalty exposure", money(report.summary.estimatedUnlicensedPenaltyExposure)],
      ["Active licence annual run-rate", money(report.revenue.activeLicenceRevenueAnnual)],
      ["Full-compliance dog annual", money(report.revenue.fullComplianceDogRevenueAnnual)],
      ["Capture rate", `${report.revenue.captureRatePct}%`],
    ],
  });

  const afterSummary = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

  autoTable(doc, {
    startY: afterSummary + 8,
    head: [["Licence #", "Pet", "Species", "Issued", "Status"]],
    body: report.licencesInPeriod.slice(0, 40).map((l) => [
      l.licenceNumber,
      l.petName ?? "—",
      l.species ?? "—",
      l.issuedAt,
      l.status,
    ]),
    styles: { fontSize: 8 },
  });

  const afterLicences = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterSummary;

  autoTable(doc, {
    startY: afterLicences + 8,
    head: [["Type", "Title", "Location", "Reported", "Status"]],
    body: report.casesInPeriod.slice(0, 40).map((c) => [
      c.caseType,
      c.title,
      c.locationLabel ?? "—",
      c.reportedAt.slice(0, 10),
      c.status,
    ]),
    styles: { fontSize: 8 },
  });

  doc.save(`council-report-${report.period.from}_to_${report.period.to}.pdf`);
}

/** Convenience for revenue panels that already have snapshot inputs. */
export function petsToDogs(pets: Pet[]): Pet[] {
  return pets.filter((p) => String(p.species).toLowerCase() === "dog");
}
