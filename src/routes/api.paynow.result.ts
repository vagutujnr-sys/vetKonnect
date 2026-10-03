import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { pollPaynowStatus } from "@/lib/paynowServer";
import {
  fulfilPaidLicence,
  getLicencePaymentById,
  getLicencePaymentByReference,
  updateLicencePayment,
} from "@/services/dvsLicenceService";

async function settleFromPaynow(raw: Record<string, string>): Promise<void> {
  const reference = raw.reference || raw.Reference || raw.paynowreference || "";
  const paymentId = raw.paymentId || "";
  const payment = paymentId
    ? await getLicencePaymentById(paymentId)
    : reference
      ? await getLicencePaymentByReference(reference)
      : null;
  if (!payment) return;
  if (payment.status === "paid") return;
  const pollUrl = raw.pollurl || raw.pollUrl || payment.pollUrl;
  if (!pollUrl) return;
  const status = await pollPaynowStatus(pollUrl);
  await updateLicencePayment(payment.id, { paynowStatus: status.status, pollUrl });
  if (status.paid) await fulfilPaidLicence({ ...payment, pollUrl });
}

export const Route = createFileRoute("/api/paynow/result")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = Object.fromEntries(url.searchParams.entries());
        try {
          await settleFromPaynow(raw);
        } catch (error) {
          console.error("Paynow result GET failed", error);
        }
        return new Response("OK");
      },
      POST: async ({ request }) => {
        try {
          const text = await request.text();
          const raw = Object.fromEntries(new URLSearchParams(text).entries());
          await settleFromPaynow(raw);
        } catch (error) {
          console.error("Paynow result POST failed", error);
        }
        return new Response("OK");
      },
    },
  },
});
