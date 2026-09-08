import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ClipboardList, LayoutDashboard, PawPrint, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { VetFeatureGate } from "@/components/vet/VetFeatureGate";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getNotifications } from "@/services/notificationService";
import { requestPracticeDashboard } from "@/services/vetService";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — VetKonnect" },
      { name: "description", content: "Manage patients and practice stats in your VetKonnect vet workspace." },
      { property: "og:title", content: "Patients — VetKonnect" },
      { property: "og:description", content: "Patient management for verified VetKonnect practices." },
    ],
  }),
  component: PatientsScreen,
});

function PatientsScreen() {
  const { user, refreshSession } = useApp();
  const [unread, setUnread] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const verified = Boolean(user.vetVerified);
  const firstName = user.fullName?.split(" ")[0] || "Doctor";

  useEffect(() => {
    void getNotifications()
      .then((notes) => setUnread(notes.filter((n) => !n.read).length))
      .catch(() => undefined);
  }, []);

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

      <VetFeatureGate verified={verified} title="Patient management">
        <section className="mx-5 mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <Users className="size-5 text-primary" />
            <p className="mt-3 text-3xl font-extrabold">{user.patientsServed ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Patients served</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <PawPrint className="size-5 text-primary" />
            <p className="mt-3 text-3xl font-extrabold">0</p>
            <p className="mt-1 text-sm text-muted-foreground">Active patients</p>
          </div>
        </section>

        <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent">
              <LayoutDashboard className="size-5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Practice Dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Request full scheduling, records, and clinic tools once your account is verified.
              </p>
              <Button
                variant="hero"
                size="sm"
                className="mt-3"
                disabled={requesting}
                onClick={() => void requestDashboard()}
              >
                {requesting ? "Sending…" : "Request Practice Dashboard"}
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-5 mt-4 mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            <h2 className="font-extrabold">Patient list</h2>
          </div>
          <div className="mt-4 rounded-xl bg-accent/50 px-4 py-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-primary" />
            <p className="mt-3 font-semibold">No patients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connected pet owners will appear here as you start serving clients.
            </p>
          </div>
        </section>
      </VetFeatureGate>
    </AppShell>
  );
}
