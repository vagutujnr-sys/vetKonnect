import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { dvsLicenceFeeForSpecies } from "@/lib/dvsLicenceFees";
import { jsonResponse, publicOrigin, startPaynowPayment } from "@/lib/paynowServer";
import { createLicencePaymentRecord, updateLicencePayment } from "@/services/dvsLicenceService";
import { getPetRecordById } from "@/services/petService";
import type { DvsPaymentMethod } from "@/types";

export const Route = createFileRoute("/api/paynow/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            petId?: string;
            method?: DvsPaymentMethod;
            phone?: string;
            email?: string;
          };
          if (!body.petId) return jsonResponse({ error: "Missing pet." }, 400);
          const method = body.method === "ecocash" || body.method === "onemoney" ? body.method : "paynow";
          const pet = await getPetRecordById(body.petId);
          if (!pet) return jsonResponse({ error: "Animal not found." }, 404);

          const amount = dvsLicenceFeeForSpecies(pet.species);
          const payment = await createLicencePaymentRecord({
            pet,
            ownerAccountId: pet.ownerId,
            amount,
            method,
            phone: body.phone,
          });

          const started = await startPaynowPayment({
            origin: publicOrigin(request),
            paymentId: payment.id,
            reference: payment.reference,
            amount,
            description: `Council pet registration — ${pet.name}`,
            method,
            phone: body.phone,
            email: body.email,
          });

          const updated = await updateLicencePayment(payment.id, {
            pollUrl: started.pollUrl,
            redirectUrl: started.redirectUrl,
            instructions: started.instructions,
            paynowStatus: started.demo ? "demo_pending" : "sent",
          });

          return jsonResponse({
            payment: updated ?? payment,
            redirectUrl: started.redirectUrl,
            instructions: started.instructions,
            demo: started.demo,
          });
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Could not start payment." }, 500);
        }
      },
    },
  },
});
