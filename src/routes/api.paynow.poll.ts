import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { jsonResponse, pollPaynowStatus } from "@/lib/paynowServer";
import {
  fulfilPaidLicence,
  getLicencePaymentById,
  getLicencePaymentByReference,
  listDvsAnimalLicences,
  updateLicencePayment,
} from "@/services/dvsLicenceService";

export const Route = createFileRoute("/api/paynow/poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { paymentId?: string; reference?: string };
          const payment = body.paymentId
            ? await getLicencePaymentById(body.paymentId)
            : body.reference
              ? await getLicencePaymentByReference(body.reference)
              : null;
          if (!payment) return jsonResponse({ error: "Payment not found." }, 404);

          if (payment.status === "paid") {
            const licences = await listDvsAnimalLicences();
            return jsonResponse({
              payment,
              licence: licences.find((item) => item.id === payment.licenceId) ?? null,
            });
          }

          if (payment.pollUrl) {
            const status = await pollPaynowStatus(payment.pollUrl);
            await updateLicencePayment(payment.id, { paynowStatus: status.status });
            if (status.paid) {
              const licence = await fulfilPaidLicence(payment);
              const next = await getLicencePaymentById(payment.id);
              return jsonResponse({ payment: next ?? payment, licence });
            }
            if (status.status === "cancelled" || status.status === "canceled" || status.status === "failed") {
              const next = await updateLicencePayment(payment.id, {
                status: status.status === "failed" ? "failed" : "cancelled",
                paynowStatus: status.status,
              });
              return jsonResponse({ payment: next ?? payment, licence: null });
            }
          }

          const latest = await getLicencePaymentById(payment.id);
          return jsonResponse({ payment: latest ?? payment, licence: null });
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Could not check payment." }, 500);
        }
      },
    },
  },
});
