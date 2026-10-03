import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { councilFacingText } from "@/lib/dvsLicenceFees";
import { pollDvsLicencePayment } from "@/lib/dvsLicenceClient";
import type { DvsAnimalLicence, DvsLicencePayment } from "@/types";

type Search = { paymentId?: string; reference?: string };

export const Route = createFileRoute("/licence-return")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    paymentId: typeof search.paymentId === "string" ? search.paymentId : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Council pet registration — VetKonnect" },
      { name: "description", content: "Confirm your city council pet registration payment." },
    ],
  }),
  component: LicenceReturn,
});

function LicenceReturn() {
  const search = Route.useSearch();
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "failed">("checking");
  const [payment, setPayment] = useState<DvsLicencePayment | null>(null);
  const [licence, setLicence] = useState<DvsAnimalLicence | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!search.paymentId && !search.reference) {
      setStatus("failed");
      setError("Missing payment details.");
      return;
    }
    void pollDvsLicencePayment({ paymentId: search.paymentId, reference: search.reference })
      .then((result) => {
        setPayment(result.payment);
        setLicence(result.licence);
        if (result.licence || result.payment?.status === "paid") setStatus("paid");
        else if (result.payment?.status === "failed" || result.payment?.status === "cancelled") setStatus("failed");
        else setStatus("pending");
      })
      .catch((err) => {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Could not confirm payment.");
      });
  }, [search.paymentId, search.reference]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        {status === "checking" ? <Clock3 className="mx-auto size-10 text-emerald-800" /> : null}
        {status === "paid" ? <CheckCircle2 className="mx-auto size-10 text-emerald-700" /> : null}
        {status === "pending" ? <Clock3 className="mx-auto size-10 text-amber-600" /> : null}
        {status === "failed" ? <ShieldAlert className="mx-auto size-10 text-rose-700" /> : null}
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {status === "checking"
            ? "Checking Paynow…"
            : status === "paid"
              ? "Council pet registration received"
              : status === "pending"
                ? "Payment still pending"
                : "Payment not confirmed"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {licence
            ? `${licence.petName ?? "Your animal"} is registered with the city council until ${licence.expiresAt}. Registration ${councilFacingText(licence.licenceNumber)}.`
            : payment
              ? `Reference ${councilFacingText(payment.reference)}. ${payment.instructions ? councilFacingText(payment.instructions) : "If you completed EcoCash or OneMoney, wait a moment then open the pet passport again."}`
              : error || "Return to the pet passport to try again."}
        </p>
        <Button asChild className="mt-5 bg-[#123524]">
          <Link to="/pets">Back to my pets</Link>
        </Button>
      </div>
    </div>
  );
}
