import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Camera,
  ChevronRight,
  HelpCircle,
  ImagePlus,
  LogOut,
  PawPrint,
  Settings,
  ShieldCheck,
  ShieldPlus,
  SlidersHorizontal,
  Stethoscope,
  Lock,
  Unplug,
} from "lucide-react";
import { useRef, useState } from "react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { VetSureCard } from "@/components/vetsure/VetSureCard";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { uploadProfilePhoto } from "@/services/userService";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — VetKonnect" },
      { name: "description", content: "Manage your account, pets, VetSure membership and app preferences." },
      { property: "og:title", content: "Profile — VetKonnect" },
      { property: "og:description", content: "Your VetKonnect account and settings." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user, pets, signOut, unbindDevice, updateUser } = useApp();
  const navigate = useNavigate();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const initials = (user.fullName || "VC")
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const changePhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setPickerOpen(false);
    setUploading(true);
    try {
      const avatarUrl = await uploadProfilePhoto(file);
      await updateUser({ avatarUrl });
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update photo.");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const rows = isVetAccount(user)
    ? [
        {
          icon: Stethoscope,
          label: "Patients",
          value: user.vetVerified ? `${user.patientsServed ?? 0} served` : "Pending verify",
          to: "/patients" as const,
        },
        {
          icon: ShieldCheck,
          label: "Verification",
          value: user.vetVerified ? "Verified" : "Awaiting admin",
          to: "/patients" as const,
        },
        { icon: Bell, label: "Notifications", value: user.notificationsEnabled === false ? "Off" : "On", to: "/notifications" as const },
        { icon: Settings, label: "Settings", value: "", to: "/settings" as const },
      ]
    : [
        { icon: PawPrint, label: "My pets", value: `${pets.length}`, to: "/pets" as const },
        { icon: SlidersHorizontal, label: "Customize modules", value: `${user.modules.length} active`, to: "/modules" as const },
        { icon: Bell, label: "Notifications", value: user.notificationsEnabled === false ? "Off" : "On", to: "/notifications" as const },
        { icon: Settings, label: "Settings", value: "", to: "/settings" as const },
      ];

  return (
    <AppShell>
      <ScreenHeader title="Profile" />

      <section className="mx-5 card-surface flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName || "Profile"}
              className="size-16 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-extrabold text-primary">
              {initials}
            </span>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => setPickerOpen((open) => !open)}
            className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[var(--shadow-card)]"
            aria-label={user.avatarUrl ? "Change profile photo" : "Add profile photo"}
          >
            <Camera className="size-3.5" />
          </button>

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void changePhoto(e.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void changePhoto(e.target.files?.[0] ?? null)}
          />

          {pickerOpen ? (
            <div className="absolute left-0 top-[4.5rem] z-20 min-w-[10rem] overflow-hidden rounded-2xl border border-border bg-white shadow-[var(--shadow-card)]">
              <button
                type="button"
                disabled={uploading}
                onClick={() => galleryRef.current?.click()}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-primary"
              >
                <ImagePlus className="size-4" />
                Gallery
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm font-semibold text-primary"
              >
                <Camera className="size-4" />
                Camera
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{user.fullName || "VetKonnect user"}</p>
          <p className="text-sm text-muted-foreground">
            {user.countryCode} {user.phone || "—"}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-primary">
            <Lock className="size-3.5" /> Device-bound account
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => setPickerOpen((open) => !open)}
            className="mt-2 text-sm font-semibold text-primary"
          >
            {uploading ? "Uploading…" : user.avatarUrl ? "Change photo" : "Add profile photo"}
          </button>
        </div>
      </section>

      {!isVetAccount(user) ? (
        <>
          <div className="mx-5 mt-4">
            <VetSureCard />
          </div>

          <section className="mx-5 mt-4 rounded-2xl border border-accent bg-accent/40 p-5">
            <div className="flex items-center gap-3">
              {user.vetSureMember ? <ShieldCheck className="size-6 text-primary" /> : <ShieldPlus className="size-6 text-primary" />}
              <div className="flex-1">
                <p className="font-bold text-primary">Membership overview</p>
                <p className="text-sm text-muted-foreground">
                  {user.vetSureMember ? "Active · all pets covered" : "Join VetSure from the card above"}
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="mx-5 mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Stethoscope className="size-6 text-primary" />
            <div className="flex-1">
              <p className="font-bold text-primary">{user.practiceName?.trim() || "Practice profile"}</p>
              <p className="text-sm text-muted-foreground">
                {user.vetVerified ? "Verified vet account" : "Pending admin verification"}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mx-5 mt-4 card-surface divide-y divide-border">
        {rows.map(({ icon: Icon, label, value, to }) => (
          <Link key={label} to={to} className="flex items-center gap-3 px-4 py-4">
            <Icon className="size-5 text-primary" />
            <span className="flex-1 font-medium">{label}</span>
            {value ? <span className="text-sm text-muted-foreground">{value}</span> : null}
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
        <button type="button" className="flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left">
          <HelpCircle className="size-5 text-primary" />
          <span className="flex-1 font-medium">Help and support</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>

      <Button
        variant="outline"
        size="lg"
        className="mx-5 mt-6 gap-2"
        onClick={async () => {
          await unbindDevice();
          toast.success("Device unbound", {
            description: "This account can now be signed in on another device.",
          });
          void navigate({ to: "/register" });
        }}
      >
        <Unplug className="size-4" /> Unbind this device
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="mx-5 my-4 gap-2 text-destructive"
        onClick={async () => {
          await signOut();
          void navigate({ to: "/register" });
        }}
      >
        <LogOut className="size-4" /> Sign out
      </Button>
    </AppShell>
  );
}
