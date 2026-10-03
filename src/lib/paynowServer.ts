import { createRequire } from "node:module";
import type { DvsPaymentMethod } from "@/types";

type PaynowPayment = { add: (title: string, amount: number) => void };

type PaynowClient = {
  resultUrl: string;
  returnUrl: string;
  createPayment: (reference: string, authEmail?: string) => PaynowPayment;
  send: (payment: PaynowPayment) => Promise<{ success: boolean; redirectUrl?: string; pollUrl?: string; error?: string }>;
  sendMobile: (
    payment: PaynowPayment,
    phone: string,
    method: "ecocash" | "onemoney",
  ) => Promise<{ success: boolean; pollUrl?: string; instructions?: string; error?: string }>;
  pollTransaction: (pollUrl: string) => Promise<{ paid?: boolean; status?: string }>;
};

type PaynowCtor = new (id: string, key: string) => PaynowClient;

export function paynowConfigured(): boolean {
  return Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
}

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function normalizeZwPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("263") && digits.length >= 12) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

function loadPaynow(): PaynowCtor | null {
  try {
    const require = createRequire(import.meta.url);
    const mod = require("paynow") as { Paynow?: PaynowCtor } | PaynowCtor;
    if (typeof mod === "function") return mod;
    return mod.Paynow ?? null;
  } catch {
    return null;
  }
}

export function createPaynowClient(resultUrl: string, returnUrl: string): PaynowClient {
  const Paynow = loadPaynow();
  const id = process.env.PAYNOW_INTEGRATION_ID;
  const key = process.env.PAYNOW_INTEGRATION_KEY;
  if (!Paynow || !id || !key) {
    throw new Error("Paynow is not configured.");
  }
  const client = new Paynow(id, key);
  client.resultUrl = resultUrl;
  client.returnUrl = returnUrl;
  return client;
}

export async function startPaynowPayment(input: {
  origin: string;
  paymentId: string;
  reference: string;
  amount: number;
  description: string;
  method: DvsPaymentMethod;
  phone?: string;
  email?: string;
}): Promise<{ redirectUrl?: string; pollUrl?: string; instructions?: string; demo: boolean }> {
  if (!paynowConfigured()) {
    return {
      demo: true,
      instructions:
        "Paynow merchant keys are not configured on this environment. The council can confirm the pet registration as an office payment, or add PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.",
    };
  }

  const resultUrl = `${input.origin}/api/paynow/result`;
  const returnUrl = `${input.origin}/licence-return?paymentId=${encodeURIComponent(input.paymentId)}`;
  const client = createPaynowClient(resultUrl, returnUrl);
  const payment = client.createPayment(input.reference, input.email || "licence@vetkonnect.app");
  payment.add(input.description, Number(input.amount.toFixed(2)));

  if (input.method === "ecocash" || input.method === "onemoney") {
    if (!input.phone) throw new Error("Enter a Zimbabwe mobile number for this payment method.");
    const response = await client.sendMobile(payment, normalizeZwPhone(input.phone), input.method);
    if (!response.success) throw new Error(response.error || "Paynow mobile payment failed.");
    return {
      demo: false,
      pollUrl: response.pollUrl,
      instructions: response.instructions,
    };
  }

  const response = await client.send(payment);
  if (!response.success) throw new Error(response.error || "Paynow payment failed.");
  return {
    demo: false,
    redirectUrl: response.redirectUrl,
    pollUrl: response.pollUrl,
  };
}

export async function pollPaynowStatus(pollUrl: string): Promise<{ paid: boolean; status: string }> {
  const client = createPaynowClient("https://unused.local/result", "https://unused.local/return");
  const status = await client.pollTransaction(pollUrl);
  const raw = String(status.status ?? "").toLowerCase();
  const paid = Boolean(status.paid) || raw === "paid";
  return { paid, status: raw || (paid ? "paid" : "pending") };
}
