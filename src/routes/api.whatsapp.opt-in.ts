import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/lib/paynowServer";

/** Public join instructions for the Twilio WhatsApp sandbox. No secrets. */
export const Route = createFileRoute("/api/whatsapp/opt-in")({
  server: {
    handlers: {
      GET: async () => {
        const from = String(process.env.TWILIO_WHATSAPP_FROM ?? "")
          .trim()
          .replace(/^whatsapp:/i, "");
        const joinMessage = String(process.env.TWILIO_WHATSAPP_JOIN_CODE ?? "").trim();
        return jsonResponse({
          from: from || null,
          joinMessage: joinMessage || null,
        });
      },
    },
  },
});
