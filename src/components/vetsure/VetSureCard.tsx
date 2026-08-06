import { BadgeCheck, CalendarClock, Scissors, ShieldPlus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";

const benefits = [
  { icon: CalendarClock, label: "Reminders" },
  { icon: ShieldPlus, label: "Healthcare" },
  { icon: Scissors, label: "Grooming" },
  { icon: Tag, label: "Partner Offers" },
];

export function VetSureCard() {
  const { user, joinVetSure } = useApp();

  if (user.vetSureMember) {
    return (
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-[var(--shadow-brand)]">
        <div className="flex items-center gap-3">
          <BadgeCheck className="size-7" />
          <div>
            <p className="text-lg font-bold">VetSure Member</p>
            <p className="text-sm opacity-85">Active · Renews 12 July 2027</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
          {benefits.map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl bg-primary-foreground/12 py-3">
              <Icon className="mx-auto size-5" />
              <p className="mt-1 opacity-90">{label}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent bg-accent/40 p-5">
      <div className="flex gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl brand-gradient text-primary-foreground shadow-[var(--shadow-brand)]">
          <ShieldPlus className="size-7" />
        </span>
        <div>
          <h3 className="text-lg font-bold text-primary">Protect your pet with VetSure</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Health reminders, grooming benefits, vet discounts and exclusive partner offers.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1 text-center text-[10px] text-muted-foreground">
          {benefits.map(({ icon: Icon, label }) => (
            <div key={label}>
              <Icon className="mx-auto size-5 text-primary" />
              <p className="mt-1">{label}</p>
            </div>
          ))}
        </div>
        <Button variant="hero" onClick={joinVetSure}>
          Join VetSure
        </Button>
      </div>
    </section>
  );
}
