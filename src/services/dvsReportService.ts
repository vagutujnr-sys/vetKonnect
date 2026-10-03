import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getDvsDashboardSnapshot } from "@/services/dvsService";
import type { DvsCertificate, DvsRabiesCase, DvsVaccination } from "@/types";

export type DvsReportPeriod = { from: string; to: string };

export type DvsSystemReport = {
  generatedAt: string;
  period: DvsReportPeriod;
  summary: {
    animalsIdentified: number;
    rabiesVaccinations: number;
    vaccinationsInPeriod: number;
    activeCertificates: number;
    certificatesIssuedInPeriod: number;
    expiredCertificates: number;
    cancelledCertificates: number;
    nationalCoveragePct: number;
    suspectedRabies: number;
    confirmedRabies: number;
    qrScansInPeriod: number;
    totalAnimals: number;
    licensedAnimals: number;
    unlicensedAnimals: number;
    licenceRevenuePaid: number;
  };
  vaccinationsInPeriod: DvsVaccination[];
  certificatesInPeriod: DvsCertificate[];
  casesInPeriod: DvsRabiesCase[];
};

function inRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from.slice(0, 10) && day <= to.slice(0, 10);
}

export async function buildDvsSystemReport(period: DvsReportPeriod): Promise<DvsSystemReport> {
  const from = period.from.slice(0, 10);
  const to = period.to.slice(0, 10);
  if (!from || !to || from > to) throw new Error("Choose a valid from / to date range.");

  const snap = await getDvsDashboardSnapshot();
  const vaccinationsInPeriod = snap.vaccinations.filter((v) => inRange(v.vaccinatedAt, from, to));
  const certificatesInPeriod = snap.certificates.filter((c) => inRange(c.issuedAt, from, to));
  const casesInPeriod = snap.rabiesCases.filter((c) => inRange(c.reportedAt, from, to));
  const qrScansInPeriod = snap.scans.filter((s) => inRange(s.scannedAt, from, to)).length;

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    summary: {
      animalsIdentified: snap.stats.animalsIdentified,
      rabiesVaccinations: snap.stats.rabiesVaccinations,
      vaccinationsInPeriod: vaccinationsInPeriod.length,
      activeCertificates: snap.stats.activeCertificates,
      certificatesIssuedInPeriod: certificatesInPeriod.length,
      expiredCertificates: snap.stats.expiredCertificates,
      cancelledCertificates: snap.stats.cancelledCertificates,
      nationalCoveragePct: snap.stats.nationalCoveragePct,
      suspectedRabies: snap.stats.suspectedRabies,
      confirmedRabies: snap.stats.confirmedRabies,
      qrScansInPeriod,
      totalAnimals: snap.stats.totalAnimals,
      licensedAnimals: snap.stats.licensedAnimals,
      unlicensedAnimals: snap.stats.unlicensedAnimals,
      licenceRevenuePaid: snap.stats.licenceRevenuePaid,
    },
    vaccinationsInPeriod,
    certificatesInPeriod,
    casesInPeriod,
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

export function exportDvsReportPdf(report: DvsSystemReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DVS Animal Health Digital Report", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Period ${report.period.from} to ${report.period.to}`, 14, 26);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [["Metric", "Value"]],
    body: [
      ["Animals identified", String(report.summary.animalsIdentified)],
      ["Rabies vaccinations (all)", String(report.summary.rabiesVaccinations)],
      ["Vaccinations in period", String(report.summary.vaccinationsInPeriod)],
      ["Active certificates", String(report.summary.activeCertificates)],
      ["Certificates issued in period", String(report.summary.certificatesIssuedInPeriod)],
      ["Expired certificates", String(report.summary.expiredCertificates)],
      ["Cancelled / invalid", String(report.summary.cancelledCertificates)],
      ["National coverage", `${report.summary.nationalCoveragePct}%`],
      ["Suspected rabies", String(report.summary.suspectedRabies)],
      ["Confirmed rabies", String(report.summary.confirmedRabies)],
      ["QR verifications in period", String(report.summary.qrScansInPeriod)],
      ["National animals", String(report.summary.totalAnimals)],
      ["Licensed animals", String(report.summary.licensedAnimals)],
      ["Unlicensed animals", String(report.summary.unlicensedAnimals)],
      ["Licence revenue paid", String(report.summary.licenceRevenuePaid)],
    ],
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [["Certificate", "Animal", "Status", "Issued", "Expires", "Province"]],
    body: report.certificatesInPeriod.slice(0, 40).map((c) => [
      c.certificateNumber,
      c.petName ?? "",
      c.status,
      c.issuedAt,
      c.expiresAt,
      c.province ?? "",
    ]),
  });

  doc.save(`DVS-report-${report.period.from}-to-${report.period.to}.pdf`);
}

export function exportDvsReportExcel(report: DvsSystemReport) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([report.summary]),
    "Summary",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.certificatesInPeriod.map((c) => ({
        certificate: c.certificateNumber,
        animal: c.petName,
        microchip: c.microchip,
        owner: c.ownerName,
        veterinarian: c.veterinarianName,
        status: c.status,
        issued: c.issuedAt,
        expires: c.expiresAt,
        province: c.province,
        district: c.district,
        batch: c.batchNumber,
      })),
    ),
    "Certificates",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.vaccinationsInPeriod.map((v) => ({
        date: v.vaccinatedAt,
        province: v.province,
        district: v.district,
        status: v.status,
        petId: v.petId,
      })),
    ),
    "Vaccinations",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.casesInPeriod.map((c) => ({
        status: c.status,
        species: c.species,
        province: c.province,
        district: c.district,
        vaccination: c.vaccinationStatus,
        reported: c.reportedAt,
      })),
    ),
    "Rabies cases",
  );
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(`DVS-report-${report.period.from}-to-${report.period.to}.xlsx`, new Blob([out]));
}
