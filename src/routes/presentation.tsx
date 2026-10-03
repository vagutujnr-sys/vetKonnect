import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DvsBriefingMap } from "@/components/dvs/DvsBriefingMap";
import { loadPresentationRegistry, type PresentationRegistry } from "@/lib/presentationRegistry";

const emptyRegistry: PresentationRegistry = {
  pets: [],
  certificates: [],
  vaccinations: [],
  licences: [],
};

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "VetKonnect for authorities" },
      {
        name: "description",
        content: "A public map of Zimbabwe animal demographics from the VetKonnect register.",
      },
    ],
  }),
  component: PresentationPage,
});

function PresentationPage() {
  const [registry, setRegistry] = useState<PresentationRegistry>(emptyRegistry);
  const [notice, setNotice] = useState("Loading the live register…");

  useEffect(() => {
    let cancelled = false;
    void loadPresentationRegistry()
      .then((next) => {
        if (cancelled) return;
        setRegistry(next);
        setNotice("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const record = error as { message?: string; details?: string; code?: string };
        const raw = error instanceof Error ? error.message : record?.message || record?.details || record?.code || "The live register could not be loaded.";
        const message = /failed to fetch|network/i.test(String(raw))
          ? "The live register could not be reached. The map still shows every province."
          : String(raw);
        setNotice(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      {notice ? <p className="shrink-0 bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-950">{notice}</p> : null}
      <DvsBriefingMap
        className="min-h-0 flex-1"
        pets={registry.pets}
        certificates={registry.certificates}
        vaccinations={registry.vaccinations}
        licences={registry.licences}
      />
    </div>
  );
}
