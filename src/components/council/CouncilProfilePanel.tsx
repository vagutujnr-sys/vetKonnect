import { Building2, LogOut, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CouncilOfficial } from "@/types";

export function CouncilProfilePanel({
  official,
  onSignOut,
}: {
  official: CouncilOfficial;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-4 px-5 pb-8">
      <div>
        <h2 className="text-xl font-extrabold">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">Council field portal account</p>
      </div>

      <Card className="rounded-2xl border-slate-200 p-5 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-900">
          <Building2 className="size-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900">{official.fullName}</h3>
        {official.title ? <p className="mt-1 text-sm text-teal-800">{official.title}</p> : null}
        <p className="mt-2 text-sm text-slate-600">{official.email}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          This login is separate from owner and vet phone accounts. Admins manage officials under Admin → Council.
        </p>
      </Card>

      <Card className="rounded-2xl border-amber-200 bg-amber-50/70 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Monitor className="mt-0.5 size-5 shrink-0 text-amber-800" />
          <div>
            <p className="text-sm font-semibold text-amber-950">Full municipal dashboard</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              Licences, rabies, incidents, geography, app-wide notices, and community publishing are available on a
              desktop computer at the same address (`/council`).
            </p>
          </div>
        </div>
      </Card>

      <Button variant="secondary" className="w-full" onClick={onSignOut}>
        <LogOut className="mr-2 size-4" /> Sign out
      </Button>
    </div>
  );
}
