/** Digits only, country code included, for wa.me and the WhatsApp Cloud API. */
export function toWhatsAppDigits(countryCode: string, phone: string): string | null {
  const country = countryCode.replace(/\D/g, "");
  let local = phone.replace(/\D/g, "");
  if (!local) return null;
  if (country && local.startsWith(country)) return local;
  if (local.startsWith("0")) local = local.slice(1);
  const digits = `${country}${local}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function whatsAppComposeUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function formatVisitWhen(date: string, time: string): string {
  const parsed = new Date(`${date}T${time || "09:00"}`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`.trim();
  return parsed.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildVisitReceipt(input: {
  petName: string;
  species?: string;
  treatment: string;
  detail: string;
  medication?: string;
  healthStatus?: string;
  vetName: string;
  practiceName?: string;
  visitedAt: string;
}): string {
  const lines = [
    "VetKonnect receipt",
    `Patient: ${input.petName}${input.species ? ` (${input.species})` : ""}`,
    `Visit: ${input.visitedAt}`,
    `Treatment: ${input.treatment}`,
    `Details: ${input.detail}`,
  ];
  if (input.medication) lines.push(`Medication today: ${input.medication}`);
  if (input.healthStatus) lines.push(`Health: ${input.healthStatus}`);
  lines.push(`Vet: ${input.vetName}`);
  if (input.practiceName) lines.push(`Practice: ${input.practiceName}`);
  return lines.join("\n");
}

export function buildVisitMeeting(input: {
  petName: string;
  when: string;
  vetName: string;
  practiceName?: string;
}): string {
  const where = [input.vetName, input.practiceName].filter(Boolean).join(", ");
  return [
    "VetKonnect follow-up",
    `Patient: ${input.petName}`,
    `Scheduled visit: ${input.when}`,
    where ? `With: ${where}` : "",
    "Please bring your animal for this visit.",
  ]
    .filter(Boolean)
    .join("\n");
}
