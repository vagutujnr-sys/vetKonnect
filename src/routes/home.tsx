import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarPlus,
  CalendarDays,
  FilePlus2,
  HeartPulse,
  MapPin,
  MessageCircle,
  Heart,
  PawPrint,
  Phone,
  QrCode,
  ShieldPlus,
  Weight,
  Pill,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { getPosts, getServices } from "@/services/contentService";
import { getNotifications } from "@/services/notificationService";
import type { CommunityPost, ServiceListing } from "@/types";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — VetKonnect" },
      { name: "description", content: "Your pet health dashboard: health summary, reminders, services and community." },
      { property: "og:title", content: "Home — VetKonnect" },
      { property: "og:description", content: "Keep your pets happy and healthy with connected care." },
    ],
  }),
  component: HomeScreen,
});

const quickActions = [
  { label: "New Pet", icon: PawPrint, to: "/pets/new" as const },
  { label: "Appointment", icon: CalendarPlus, to: "/discover" as const },
  { label: "Records", icon: FilePlus2, to: "/pets" as const },
  { label: "Scan QR", icon: QrCode, to: "/pets" as const },
];

function HomeScreen() {
  const { user, pets, activePetId } = useApp();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    void Promise.all([getServices(), getPosts(), getNotifications()])
      .then(([servicesData, postsData, notes]) => {
        setServices(servicesData);
        setPosts(postsData);
        setUnread(notes.filter((n) => !n.read).length);
      })
      .catch((error) => console.error("Failed to load home content", error));
  }, []);

  const pet = pets.find((p) => p.id === activePetId) ?? pets[0];
  const firstName = user.fullName?.split(" ")[0] || "there";

  return (
    <AppShell>
      <header className="flex items-start justify-between px-5 pt-8">
        <div>
          <h1 className="text-[22px] font-extrabold">
            Hie, <span className="text-primary">{firstName}</span>
          </h1>
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
          <Link
            to="/profile"
            className="flex size-10 items-center justify-center rounded-full bg-accent font-bold text-primary"
          >
            {firstName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {pet ? (
        <section className="mx-5 mt-5 card-surface p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex gap-4">
            <img
              src={pet.photoUrl || undefined}
              alt={pet.name}
              loading="lazy"
              className="mt-[-4px] size-24 rounded-full border-2 border-primary object-cover p-1 bg-accent"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="flex-1 pt-1">
                  <h2 className="truncate text-2xl font-extrabold">{pet.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{pet.breed || "0.0"}</p>
                  <p className="text-sm text-muted-foreground">Age: {pet.ageYears || "0.0"} Years</p>
                </div>
                <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <HeartPulse className="size-4" />
                  {pet.healthStatus || "0.0"}
                </span>
              </div>
            </div>
          </div>

          <hr className="my-4 border-border" />
          <p className="text-sm font-semibold text-primary">Today's Health Summary</p>
          <div className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
            <Stat icon={CalendarDays} label="Next Vaccine" value={pet.nextVaccine || "0.0"} />
            <Stat icon={Weight} label="Weight" value={`${Number(pet.weightKg || 0).toFixed(1)} kg`} />
            <Stat icon={Pill} label="Medication" value={pet.medicationToday || "0.0"} />
          </div>

          <Link
            to="/pets/$petId"
            params={{ petId: pet.id }}
            className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-accent/60 py-3 text-sm font-semibold text-primary"
          >
            View Health Passport <ChevronRight className="size-4" />
          </Link>
        </section>
      ) : (
        <section className="mx-5 mt-5 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-accent/80 to-card p-6 text-center shadow-[var(--shadow-card)] animate-in fade-in zoom-in-95 duration-500">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-brand)]">
            <PawPrint className="size-8" />
          </span>
          <p className="mt-4 text-xl font-extrabold text-primary">Add your first pet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Create a digital health passport so VetKonnect can track vaccines, weight and care reminders.
          </p>
          <Button asChild variant="hero" className="mt-5 w-full">
            <Link to="/pets/new">Register a pet</Link>
          </Button>
        </section>
      )}

      <section className="mt-6">
        <h3 className="px-5 text-lg font-bold">Quick Actions</h3>
        <div className="mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
          {quickActions.map(({ label, icon: Icon, to }) => {
            const isQr = label === "Scan QR";
            return (
              <Link
                key={label}
                to={to}
                className="flex w-[124px] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                <Icon className={cn("text-primary", isQr ? "size-10" : "size-6")} />
                {!isQr ? <span className="text-sm font-semibold leading-tight">{label}</span> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-5 mt-4 flex items-center gap-4 rounded-2xl bg-accent/50 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card">
          <CalendarDays className="size-5 text-primary" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-primary">Upcoming</p>
          <p className="text-lg font-bold leading-tight">{pet ? "Vaccination" : "No reminders yet"}</p>
          <p className="text-sm text-muted-foreground">
            {pet ? `${pet.nextVaccine || "0.0"} · Add clinic details anytime` : "Register a pet to unlock reminders"}
          </p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ChevronRight className="size-5" />
        </span>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-5">
          <h3 className="text-lg font-bold">Nearby Services</h3>
          <Link to="/discover" className="flex items-center text-sm font-semibold text-primary">
            View All <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
          {services.map((s) => (
            <Link
              key={s.id}
              to="/discover"
              className="w-[160px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
            >
              {s.imageUrl ? (
                <img src={s.imageUrl} alt={s.name} loading="lazy" className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-accent text-primary">
                  <MapPin className="size-6" />
                </div>
              )}
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{s.category}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" /> {s.distanceKm} km away
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-5">
          <h3 className="text-lg font-bold">Community Updates</h3>
          <Link to="/community" className="flex items-center text-sm font-semibold text-primary">
            View All <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="mx-5 mt-3 space-y-3">
          {posts.slice(0, 2).map((post) => (
            <article key={post.id} className="flex gap-3 card-surface p-3">
              {post.imageUrl ? (
                <img src={post.imageUrl} alt="" loading="lazy" className="size-20 rounded-xl object-cover" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-xl bg-accent text-primary">
                  <MessageCircle className="size-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {post.author} <span className="font-normal text-muted-foreground">· {post.timeAgo}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="size-3.5" /> {post.comments}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-5 my-6 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/15">
          <ShieldPlus className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-bold">Emergency Vet</p>
          <p className="text-sm opacity-80">24/7 Assistance</p>
        </div>
        <a
          href="tel:+263000000"
          className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-semibold text-primary"
        >
          <Phone className="size-4" /> Call Now
        </a>
      </section>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="px-1">
      <Icon className="mx-auto size-5 text-primary" />
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}
