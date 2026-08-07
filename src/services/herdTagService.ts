import type { HerdTag } from "@/types";
import QRCode from "qrcode";
import { supabase } from "./supabaseClient";

const TABLE = "pet_tags";

export interface GenerateHerdTagsInput {
  type: "Collar ID" | "Pet Tag";
  prefix: string;
  quantity: number;
}

function createSerial(sequence: number) {
  return String(sequence).padStart(3, "0");
}

function createCode(prefix: string, quantity: number) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix.toUpperCase()}-${stamp}-${createSerial(quantity)}`;
}

function mapRow(row: Record<string, unknown>): HerdTag {
  return {
    id: String(row.id ?? ""),
    type: (row.type as HerdTag["type"]) ?? "Collar ID",
    prefix: String(row.prefix ?? ""),
    code: String(row.code ?? ""),
    qrDataUrl: String(row.qr_data_url ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listHerdTags(): Promise<HerdTag[]> {
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load pet tags", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function generateHerdTags({ type, prefix, quantity }: GenerateHerdTagsInput): Promise<HerdTag[]> {
  const safePrefix = prefix.trim().toUpperCase() || (type === "Pet Tag" ? "PET" : "COLLAR");
  const count = Math.min(50, Math.max(1, quantity));
  const generated: HerdTag[] = [];

  for (let index = 1; index <= count; index += 1) {
    const code = createCode(safePrefix, index);
    const payload = JSON.stringify({
      type,
      code,
      generatedAt: new Date().toISOString(),
    });

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    generated.push({
      id: `${code}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type,
      prefix: safePrefix,
      code,
      qrDataUrl,
      createdAt: new Date().toISOString(),
    });
  }

  const rows = generated.map((tag) => ({
    id: tag.id,
    type: tag.type,
    prefix: tag.prefix,
    code: tag.code,
    qr_data_url: tag.qrDataUrl,
    created_at: tag.createdAt,
  }));

  const { error } = await supabase.from(TABLE).insert(rows);
  if (error) {
    console.error("Failed to save pet tags", error.message);
    throw error;
  }

  return generated;
}
