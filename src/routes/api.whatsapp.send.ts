import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/paynowServer";

type SendBody = {
  to?: string;
  messages?: string[];
};

function whatsappAddress(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/^whatsapp:/i, "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `whatsapp:+${digits}`;
}

/** Sends the receipt and follow-up through Twilio WhatsApp to a registered number. */
export const Route = createFileRoute("/api/whatsapp/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: SendBody;
        try {
          body = (await request.json()) as SendBody;
        } catch {
          return jsonResponse({ delivered: false, error: "Invalid request." }, 400);
        }

        const to = whatsappAddress(String(body.to ?? ""));
        const messages = (body.messages ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 2);
        if (!to || messages.length === 0 || messages.some((item) => item.length > 1600)) {
          return jsonResponse({ delivered: false, error: "Missing phone or message." }, 400);
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_WHATSAPP_FROM ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM) : null;
        if (!accountSid || !authToken || !from) {
          return jsonResponse({ delivered: false, reason: "not_configured" });
        }

        const authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
        for (const text of messages) {
          const form = new URLSearchParams({ From: from, To: to, Body: text });
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: authorization,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: form,
            },
          );
          if (!response.ok) {
            const detail = (await response.json().catch(() => null)) as { message?: string } | null;
            const message = detail?.message || "Twilio did not accept the WhatsApp message.";
            console.error("Twilio WhatsApp send failed", message);
            return jsonResponse({ delivered: false, error: message }, 502);
          }
        }

        return jsonResponse({ delivered: true });
      },
    },
  },
});
