import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { DvsCertificate } from "@/types";

function line(value?: string | null, fallback = "—") {
  const text = (value ?? "").trim();
  return text || fallback;
}

export async function downloadDvsCertificatePdf(certificate: DvsCertificate): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(18, 53, 36);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFillColor(201, 162, 39);
  doc.rect(0, 38, pageW, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPUBLIC OF ZIMBABWE", pageW / 2, 12, { align: "center" });
  doc.setFontSize(16);
  doc.text("DEPARTMENT OF VETERINARY SERVICES", pageW / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Official Rabies Vaccination Certificate", pageW / 2, 30, { align: "center" });

  doc.setTextColor(18, 53, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Certificate No.  ${certificate.certificateNumber}`, margin, 50);
  doc.setFontSize(11);
  doc.text(`Status:  ${certificate.status.toUpperCase()}`, pageW - margin, 50, { align: "right" });

  const qrUrl = certificate.qrPayload || (typeof window === "undefined" ? "" : `${window.location.origin}/certificate/${certificate.verificationCode}`);
  try {
    const qr = await QRCode.toDataURL(qrUrl || certificate.verificationCode, { margin: 1, width: 280 });
    doc.addImage(qr, "PNG", pageW - margin - 42, 56, 42, 42);
  } catch {
    /* QR optional */
  }

  const block = (title: string, y: number, rows: Array<[string, string]>) => {
    doc.setFillColor(241, 245, 241);
    doc.roundedRect(margin, y, pageW - margin * 2 - 48, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(18, 53, 36);
    doc.text(title, margin + 3, y + 5.5);
    let cursor = y + 16;
    doc.setFontSize(10);
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin + 3, cursor);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(value, margin + 48, cursor);
      cursor += 7;
    }
    return cursor + 4;
  };

  let y = 58;
  y = block("ANIMAL", y, [
    ["Name", line(certificate.petName)],
    ["Species / breed", `${line(certificate.species)} · ${line(certificate.breed)}`],
    ["Microchip", line(certificate.microchip, "Not recorded")],
    ["VetKonnect ID", line(certificate.vetconnectId)],
  ]);
  y = block("OWNER", y, [
    ["Name", line(certificate.ownerName)],
    ["Phone", line(certificate.ownerPhone)],
  ]);
  y = block("VACCINATION", y, [
    ["Vaccine", line(certificate.vaccineName, "Rabies vaccine")],
    ["Manufacturer", line(certificate.manufacturer)],
    ["Batch number", line(certificate.batchNumber)],
    ["Date given", line(certificate.issuedAt)],
    ["Valid until", line(certificate.expiresAt)],
  ]);
  y = block("VETERINARIAN", y, [
    ["Practitioner", line(certificate.veterinarianName)],
    ["Practice", line(certificate.practiceName)],
    ["Province / district", `${line(certificate.province)} · ${line(certificate.district)}`],
  ]);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Scan the QR code to verify this certificate in real time with the Department of Veterinary Services.", margin, y + 4);
  doc.text(`Verification code: ${certificate.verificationCode}`, margin, y + 10);

  doc.setFillColor(18, 53, 36);
  doc.rect(0, 277, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Issued on the VetKonnect platform. DVS retains regulatory control of official records.", pageW / 2, 285, {
    align: "center",
  });
  doc.text("Powered by VetKonnect", pageW / 2, 291, { align: "center" });

  doc.save(`${certificate.certificateNumber}.pdf`);
}
