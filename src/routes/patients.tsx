import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, ClipboardList, HeartPulse, LayoutDashboard, PawPrint, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { TagScanPanel } from "@/components/vet/TagScanPanel";
import { VetFeatureGate } from "@/components/vet/VetFeatureGate";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getNotifications } from "@/services/notificationService";
import { getRecentPatients, lookupPatientByTag, requestPracticeDashboard } from "@/services/vetService";
import type { Pet } from "@/types";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — VetKonnect" },
      { name: "description", content: "Scan a pet tag to open history, prescribe treatment, and update health cards." },
      { property: "og:title", content: "Patients — VetKonnect" },
      { property: "og:description", content: "Patient management for verified VetKonnect practices." },
    ],
  }),
  component: PatientsScreen,
});

function PatientsScreen() {
  const navigate = useNavigate();
  const { user, refreshSession } = useApp();
  const [unread, setUnread] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Pet[]>([]);
  const verified = Boolean(user.vetVerified);
  const firstName = user.fullName?.split(" ")[0] || "Doctor";

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    void getNotifications()
      .then((notes) => setUnread(notes.filter((n) => !n.read).length))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!verified) return;
    void getRecentPatients()
      .then(setRecent)
      .catch((error) => console.error("Failed to load recent patients", error));
  }, [verified]);

  const requestDashboard = async () => {
    setRequesting(true);
    try {
      await requestPracticeDashboard();
      await refreshSession();
      toast.success("Practice dashboard requested", {
        description: "Admin will review your verification and follow up.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send request.");
    } finally {
      setRequesting(false);
    }
  };

  const handleScan = async (value: string) => {
    setSearching(true);
    try {
      const pet = await lookupPatientByTag(value);
      toast.success(`Found ${pet.name}`, {
        description: pet.vetConnectId || pet.collarId || "Opening health card",
      });
      void navigate({ to: "/patients/$petId", params: { petId: pet.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find that patient.");
    } finally {
      setSearching(false);
    }
  };

  if (!isVetAccount(user)) {
    return (
      <AppShell>
        <ScreenHeader title="Patients" subtitle="This workspace is for vet accounts." />
        <div className="px-5">
          <Button asChild variant="hero" className="w-full">
            <Link to="/home">Go to owner home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-start justify-between px-5 pt-8">
        <div>
          <p className="text-sm text-muted-foreground">Practice workspace</p>
          <h1 className="text-[22px] font-extrabold">
            Hie, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.practiceName?.trim() || "Your practice"} · {verified ? "Verified" : "Pending verification"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/notifications" className="relative" aria-label="Notifications">
            <Bell className="size-6 text-foreground" />
            {unread > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {!verified ? (
        <section className="mx-5 mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
              <LayoutDashboard className="size-5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Practice Dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.dashboardRequestedAt
                  ? "Your request is with VetKonnect admin. Patients and Impact unlock after they approve."
                  : "Request access so admin can verify your practice and unlock Patients and Impact."}
              </p>
              <Button
                variant="hero"
                size="sm"
                className="mt-3"
                disabled={requesting || Boolean(user.dashboardRequestedAt)}
                onClick={() => void requestDashboard()}
              >
                {requesting
                  ? "Sending…"
                  : user.dashboardRequestedAt
                    ? "Request sent"
                    : "Request Practice Dashboard"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <VetFeatureGate verified={verified} title="Patient management">
        <section className="mx-5 mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <Users className="size-5 text-primary" />
            <p className="mt-3 text-3xl font-extrabold">{user.patientsServed ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Patients served</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <PawPrint className="size-5 text-primary" />
            <p className="mt-3 text-3xl font-extrabold">{recent.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Recent lookups</p>
          </div>
        </section>

        <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <HeartPulse className="size-5 text-primary" />
            <h2 className="font-extrabold">Scan patient tag</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Scan a collar / pet tag QR, or type a VetKonnect ID or collar code to open the health card.
          </p>
          <TagScanPanel busy={searching} onScan={handleScan} />
        </section>

        <section className="mx-5 mt-4 mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            <h2 className="font-extrabold">Recent patients</h2>
          </div>
          {recent.length === 0 ? (
            <div className="mt-4 rounded-xl bg-accent/50 px-4 py-8 text-center">
              <PawPrint className="mx-auto size-8 text-primary" />
              <p className="mt-3 font-semibold">No recent lookups</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan a tag to pull patient history and prescribe treatment.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {recent.map((pet) => (
                <Link
                  key={pet.id}
                  to="/patients/$petId"
                  params={{ petId: pet.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3"
                >
                  {pet.photoUrl ? (
                    <img src={pet.photoUrl} alt={pet.name} className="size-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-full bg-accent font-bold text-primary">
                      {pet.name.charAt(0) || "P"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{pet.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {pet.vetConnectId}
                      {pet.collarId ? ` · ${pet.collarId}` : ""}
                    </span>
                  </span>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-primary">
                    {pet.healthStatus}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </VetFeatureGate>
    </AppShell>
  );
}
