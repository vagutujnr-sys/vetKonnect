import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardPlus, Heart } from "lucide-react";
import hero from "@/assets/welcome-hero.png";
import { Logo } from "@/components/brand/Logo";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to VetKonnect" },
      { name: "description", content: "Your complete pet healthcare companion — records, reminders and vet services." },
      { property: "og:title", content: "Welcome to VetKonnect" },
      { property: "og:description", content: "Your complete pet healthcare companion." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <MobileScreen className="soft-gradient">
      <div className="flex justify-center pt-10">
        <Logo size="md" />
      </div>

      <div className="mt-6 overflow-hidden">
        <img
          src={hero}
          alt="Pet owner with a golden retriever and a cat at a veterinary clinic"
          width={1024}
          height={768}
          className="h-64 w-full rounded-none object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col px-6 pb-10">
        <h1 className="text-center text-3xl font-extrabold leading-tight">
          Welcome to <span className="block text-primary">VetKonnect</span>
        </h1>
        <Heart className="mx-auto mt-3 size-5 fill-brand-light text-brand-light" />
        <p className="mt-3 text-center text-[15px] text-muted-foreground">
          Your complete pet healthcare companion. Supporting healthier, happier pets through connected care.
        </p>

        <div className="mt-6 flex items-start gap-4 rounded-2xl bg-accent/60 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card">
            <ClipboardPlus className="size-5 text-primary" />
          </span>
          <p className="text-sm leading-relaxed text-secondary-foreground">
            Manage health records, vaccinations, reminders and veterinary services in one simple app.
          </p>
        </div>

        <div className="mt-auto space-y-4 pt-10">
          <Button asChild variant="hero" size="lg" className="w-full text-base tracking-wide">
            <Link to="/register">GET STARTED</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/register" className="font-semibold text-primary">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </MobileScreen>
  );
}
