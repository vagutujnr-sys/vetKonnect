import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  Dog,
  FileSpreadsheet,
  FileText,
  LogOut,
  MapPinned,
  Monitor,
  PawPrint,
  QrCode,
  Receipt,
  ScrollText,
  Search,
  Shield,
  Stethoscope,
  Syringe,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { DvsCertificateVisual } from "@/components/dvs/DvsCertificateVisual";
import { DvsGeoMap } from "@/components/dvs/DvsGeoMap";
import { DvsRabiesMap } from "@/components/dvs/DvsRabiesMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { downloadDvsCertificatePdf } from "@/lib/dvsCertificatePdf";
import { DVS_LICENCE_FEES, formatDvsMoney } from "@/lib/dvsLicenceFees";
import { DVS_PROVINCES, districtsForProvince } from "@/lib/dvsRegions";
import { cn } from "@/lib/utils";
import {
  buildDvsSystemReport,
  exportDvsReportExcel,
  exportDvsReportPdf,
  type DvsSystemReport,
} from "@/services/dvsReportService";
import {
  clearDvsSession,
  createDvsOfficer,
  createRabiesCase,
  createVaccineBatch,
  deleteDvsOfficer,
  getDvsDashboardSnapshot,
  getDvsSessionOfficer,
  issueDvsCertificate,
  lookupOwner,
  notifyOwnerOfCertificate,
  reviewAnimalHealthReport,
  reviewVetCaseReport,
  saveDvsSettings,
  searchDvsAnimals,
  seedDvsRabiesDemoCases,
  setDvsOfficerActive,
  setRecognisedVaccineActive,
  createRecognisedVaccine,
  syncDvsRegistryFromPets,
  updateCertificateStatus,
} from "@/services/dvsService";
import {
  confirmPendingLicencePayment,
  markOfficeLicencePaid,
  revokeDvsLicence,
} from "@/services/dvsLicenceService";
import type {
  DvsAnimalRegistryRow,
  DvsCertificate,
  DvsDashboardSnapshot,
  DvsOfficer,
  DvsRabiesCaseStatus,
  Pet,
} from "@/types";

export const Route = createFileRoute("/dvs")({
  head: () => ({
    meta: [
      { title: "DVS Dashboard — VetKonnect" },
      { name: "description", content: "Department of Veterinary Services national animal-health control room." },
    ],
  }),
  component: DvsPortal,
});

const mobileTabs = [
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Rabies", icon: MapPinned },
  { id: "verify", label: "Verify", icon: QrCode },
  { id: "profile", label: "Profile", icon: User },
] as const;

const desktopSections = [
  { id: "home", label: "National overview" },
  { id: "rabies-map", label: "Rabies map" },
  { id: "vaccination", label: "Rabies vaccination" },
  { id: "identification", label: "Animal identification" },
  { id: "animals", label: "National animals" },
  { id: "licensing", label: "Animal licensing" },
  { id: "finance", label: "Licence finance" },
  { id: "certificates", label: "Certificates" },
  { id: "verify", label: "QR verification" },
  { id: "practitioners", label: "Practitioners" },
  { id: "batches", label: "Vaccine batches" },
  { id: "map", label: "Geographic map" },
  { id: "surveillance", label: "Rabies surveillance" },
  { id: "vet-reports", label: "Vet reports" },
  { id: "alerts", label: "Alerts" },
  { id: "reports", label: "Reports" },
  { id: "users", label: "Users & access" },
  { id: "audit", label: "Audit trail" },
  { id: "settings", label: "System admin" },
] as const;

type MobileTab = (typeof mobileTabs)[number]["id"];
type DesktopSection = (typeof desktopSections)[number]["id"];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Dog;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString("en-ZW");
}

function DvsPortal() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop(1024);
  const [officer, setOfficer] = useState<DvsOfficer | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("search");
  const [section, setSection] = useState<DesktopSection>("home");
  const [snap, setSnap] = useState<DvsDashboardSnapshot | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<Pet[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [previewCert, setPreviewCert] = useState<DvsCertificate | null>(null);

  const [issuePet, setIssuePet] = useState<Pet | null>(null);
  const [issueOwnerName, setIssueOwnerName] = useState("");
  const [issueOwnerPhone, setIssueOwnerPhone] = useState("");
  const [issueVet, setIssueVet] = useState("");
  const [issuePractice, setIssuePractice] = useState("");
  const [issueBatchId, setIssueBatchId] = useState("");
  const [issueVaccineId, setIssueVaccineId] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [issueProvince, setIssueProvince] = useState("Harare");
  const [issueDistrict, setIssueDistrict] = useState("Harare Urban");
  const [issueNotes, setIssueNotes] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);

  const [batchMfr, setBatchMfr] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [batchQty, setBatchQty] = useState("0");
  const [batchExpiry, setBatchExpiry] = useState("");
  const [batchVaccineId, setBatchVaccineId] = useState("");

  const [vaccineName, setVaccineName] = useState("");
  const [vaccineType, setVaccineType] = useState("Inactivated injectable");
  const [vaccineMfr, setVaccineMfr] = useState("");
  const [vaccineSpecies, setVaccineSpecies] = useState("Dogs, cats");
  const [vaccineStrain, setVaccineStrain] = useState("");

  const [caseStatus, setCaseStatus] = useState<DvsRabiesCaseStatus>("suspected");
  const [caseSpecies, setCaseSpecies] = useState("Dog");
  const [caseProvince, setCaseProvince] = useState("Harare");
  const [caseDistrict, setCaseDistrict] = useState("Harare Urban");
  const [caseVax, setCaseVax] = useState("Unknown");

  const [officerName, setOfficerName] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [officerPassword, setOfficerPassword] = useState("");
  const [officerTitle, setOfficerTitle] = useState("");

  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportBusy, setReportBusy] = useState(false);
  const [reportPreview, setReportPreview] = useState<DvsSystemReport | null>(null);

  const [validityDays, setValidityDays] = useState("365");
  const [coverageThreshold, setCoverageThreshold] = useState("70");
  const [expiryDays, setExpiryDays] = useState("30");
  const [animalQ, setAnimalQ] = useState("");
  const [licenceFilter, setLicenceFilter] = useState<"all" | DvsAnimalRegistryRow["licenceStatus"]>("all");
  const [licenceBusyId, setLicenceBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const next = await getDvsDashboardSnapshot();
      setSnap(next);
      setValidityDays(String(next.settings.certificateValidityDays));
      setCoverageThreshold(String(next.settings.coverageAlertThreshold));
      setExpiryDays(String(next.settings.expiryWarningDays));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not load DVS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const session = await getDvsSessionOfficer();
      if (!session) {
        void navigate({ to: "/dvs-login" });
        return;
      }
      setOfficer(session);
      setReady(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready]);

  const signOut = () => {
    clearDvsSession();
    void navigate({ to: "/dvs-login" });
  };

  const runSearch = async () => {
    try {
      const hits = await searchDvsAnimals(searchQ);
      setSearchHits(hits);
      if (!hits.length) toast.message("No matching animals");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    }
  };

  const selectIssuePet = async (pet: Pet) => {
    setIssuePet(pet);
    if (pet.ownerId) {
      const owner = await lookupOwner(pet.ownerId);
      setIssueOwnerName(owner?.fullName ?? "");
      setIssueOwnerPhone(owner?.phone ?? "");
    } else {
      setIssueOwnerName("");
      setIssueOwnerPhone("");
    }
    setSection("certificates");
  };

  const licenceAtOffice = async (pet: Pet) => {
    setLicenceBusyId(pet.id);
    try {
      await markOfficeLicencePaid(pet, officer?.fullName);
      toast.success(`${pet.name} licensed for ${DVS_LICENCE_FEES.validityDays} days`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not issue licence");
    } finally {
      setLicenceBusyId(null);
    }
  };

  const issue = async () => {
    if (!issuePet) {
      toast.error("Search and select an animal first.");
      return;
    }
    if (!issueVet.trim() || !issuePractice.trim()) {
      toast.error("Veterinarian and practice are required.");
      return;
    }
    setIssueBusy(true);
    try {
      const batch = snap?.batches.find((item) => item.id === issueBatchId) ?? null;
      const vaccine = snap?.recognisedVaccines.find((item) => item.id === issueVaccineId) ?? null;
      const cert = await issueDvsCertificate({
        pet: issuePet,
        ownerName: issueOwnerName,
        ownerPhone: issueOwnerPhone,
        veterinarianName: issueVet,
        practiceName: issuePractice,
        batch,
        vaccine,
        vaccinatedAt: issueDate,
        province: issueProvince,
        district: issueDistrict,
        notes: issueNotes,
        notifyOwner: true,
      });
      toast.success(`Certificate ${cert.certificateNumber} issued and sent to the owner app`);
      setPreviewCert(cert);
      setIssuePet(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not issue certificate");
    } finally {
      setIssueBusy(false);
    }
  };

  const coverageByProvince = snap?.coverage ?? [];
  const districtOptions = useMemo(() => districtsForProvince(issueProvince), [issueProvince]);
  const animalRegistry = useMemo(() => {
    const q = animalQ.trim().toLowerCase();
    return (snap?.animalRegistry ?? []).filter((row) => {
      if (licenceFilter !== "all" && row.licenceStatus !== licenceFilter) return false;
      if (!q) return true;
      return [row.pet.name, row.pet.species, row.pet.breed, row.pet.microchip, row.pet.vetConnectId, row.pet.collarId, row.ownerName, row.ownerPhone, row.licenceNumber]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [animalQ, licenceFilter, snap?.animalRegistry]);
  const speciesCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pet of snap?.pets ?? []) {
      const key = pet.species || "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [snap?.pets]);

  if (!ready || !officer) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading DVS portal…
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="min-h-dvh w-full bg-surface">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background pb-28">
          <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">DVS field</p>
              <h1 className="text-xl font-extrabold text-slate-900">Animal health</h1>
            </div>
            <Logo size="sm" markOnly />
          </header>
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-900">
            <Monitor className="mt-0.5 size-4 shrink-0" />
            Full national dashboard is desktop-only — same login at `/dvs` on a computer.
          </div>
          <div className="mx-5 mb-3">
            <Button className="w-full bg-rose-700 text-white hover:bg-rose-800" onClick={() => setMobileTab("map")}>
              <MapPinned className="mr-2 size-4" /> Map rabies cases
            </Button>
          </div>

          {mobileTab === "search" ? (
            <div className="space-y-3 px-5">
              <Input placeholder="Name, microchip, VetKonnect ID" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              <Button className="w-full bg-[#123524]" onClick={() => void runSearch()}>
                Search animal
              </Button>
              {searchHits.map((pet) => {
                const row = snap?.animalRegistry.find((item) => item.pet.id === pet.id);
                return (
                <Card key={pet.id} className="p-3">
                  <p className="font-semibold">{pet.name}</p>
                  <p className="text-xs text-slate-500">
                    {pet.species} · {pet.vetConnectId} · chip {pet.microchip || "—"}
                  </p>
                  <p className="mt-1 text-xs capitalize text-emerald-800">{row?.licenceStatus ?? "unlicensed"}</p>
                </Card>
                );
              })}
            </div>
          ) : null}

          {mobileTab === "map" ? (
            <div className="px-5 pb-4">
              <p className="mb-2 text-xs text-slate-500">Red confirmed · amber suspected · teal negative</p>
              <DvsRabiesMap cases={snap?.rabiesCases ?? []} className="h-[420px] rounded-2xl" />
            </div>
          ) : null}

          {mobileTab === "verify" ? (
            <div className="space-y-3 px-5">
              <Input placeholder="Certificate or verification code" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} />
              <Button
                className="w-full bg-[#123524]"
                onClick={() => {
                  if (!verifyCode.trim()) return;
                  window.location.href = `/certificate/${verifyCode.trim()}`;
                }}
              >
                Verify certificate
              </Button>
            </div>
          ) : null}

          {mobileTab === "profile" ? (
            <div className="space-y-3 px-5">
              <p className="font-semibold">{officer.fullName}</p>
              <p className="text-sm text-slate-500">{officer.email}</p>
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </div>
          ) : null}

          <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
            <div className="pointer-events-auto flex w-full max-w-[398px] items-center justify-between rounded-full bg-[#123524] px-2 py-2 shadow-[var(--shadow-float)]">
              {mobileTabs.map(({ id, label, icon: Icon }) => {
                const active = mobileTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMobileTab(id)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                      active ? "text-white" : "text-white/65 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-6", active ? "stroke-[2.5]" : "stroke-[1.5]")} />
                    {active ? label : null}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    );
  }

  const stats = snap?.stats;

  return (
    <div className="min-h-dvh bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[240px] flex-col border-r border-white/10 bg-[#123524] text-emerald-50">
        <div className="border-b border-white/10 px-4 py-4">
          <Logo size="sm" markOnly invert className="h-9" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">DVS Zimbabwe</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Animal Health</h1>
          <p className="mt-1 text-xs text-emerald-100/70">{officer.fullName}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
          {desktopSections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                section === item.id ? "bg-white/15 text-white" : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Button variant="secondary" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {section === "rabies-map" ? (
        <main className="relative ml-[240px] h-dvh overflow-hidden bg-slate-200">
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-sm rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
            <p className="font-semibold text-slate-900">Rabies cases — Zimbabwe</p>
            <p className="mt-0.5">
              <span className="font-medium text-red-700">Red confirmed</span>
              {" · "}
              <span className="font-medium text-amber-600">amber suspected</span>
              {" · "}
              <span className="font-medium text-teal-700">teal negative</span>
            </p>
            <p className="mt-1 text-slate-500">
              {(snap?.rabiesCases ?? []).filter((item) => item.latitude != null).length} mapped cases
            </p>
          </div>
          <div className="absolute left-3 top-[92px] z-10 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  const created = await seedDvsRabiesDemoCases();
                  toast.success(`Loaded ${created} rabies cases with genuine locations`);
                  await load();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not seed rabies cases");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Seed demo cases
            </Button>
            <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <DvsRabiesMap cases={snap?.rabiesCases ?? []} className="h-full min-h-0 rounded-none" />
        </main>
      ) : section === "map" ? (
        <main className="relative ml-[240px] h-dvh overflow-hidden bg-slate-200">
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
            <p className="font-semibold text-slate-900">National coverage</p>
            <p className="mt-0.5">Teal province coverage · red rabies cases</p>
          </div>
          <Button variant="secondary" size="sm" className="absolute right-3 top-3 z-10" disabled={loading} onClick={() => void load()}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <DvsGeoMap points={snap?.mapPoints ?? []} className="h-full min-h-0 rounded-none" />
        </main>
      ) : (
        <main className="ml-[240px] min-h-dvh px-4 py-4 lg:px-5">
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  <Shield className="size-3.5" /> DVS animal health digital dashboard
                </div>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">National control room</h2>
              </div>
              <div className="flex gap-2">
                <Button className="bg-rose-700 text-white hover:bg-rose-800" size="sm" onClick={() => setSection("rabies-map")}>
                  <MapPinned className="mr-2 size-4" /> Map rabies cases
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const result = await syncDvsRegistryFromPets();
                      toast.success(
                        `Synced ${result.certificates} certificates, ${result.vaccinations} vaccinations, ${result.batches} batches, ${result.cases} cases (skipped if data already exists).`,
                      );
                      await load();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Sync failed — apply migration 019_dvs_dashboard.sql in Supabase first.",
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Sync live registry
                </Button>
                {section !== "reports" ? (
                  <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
                    {loading ? "Refreshing…" : "Refresh"}
                  </Button>
                ) : null}
              </div>
            </div>

            {section === "home" && stats ? (
              <>
                <button
                  type="button"
                  onClick={() => setSection("rabies-map")}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-700 px-4 py-3 text-left text-white shadow-sm transition hover:bg-rose-800"
                >
                  <span className="inline-flex items-center text-base font-semibold">
                    <MapPinned className="mr-2 size-5 shrink-0" /> Map rabies cases
                  </span>
                  <span className="text-sm text-rose-100">
                    {(snap?.rabiesCases ?? []).filter((item) => item.latitude != null).length} mapped across Zimbabwe · red confirmed · amber suspected · teal negative
                  </span>
                </button>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={PawPrint} label="National animals" value={formatCount(stats.totalAnimals)} hint="Every companion animal on VetKonnect" />
                  <StatCard icon={BadgeCheck} label="Licensed animals" value={formatCount(stats.licensedAnimals)} hint={`${formatCount(stats.unlicensedAnimals)} unlicensed`} />
                  <StatCard icon={CircleDollarSign} label="Licence revenue" value={formatDvsMoney(stats.licenceRevenuePaid)} hint="Paid Paynow and office licences" />
                  <StatCard icon={Dog} label="Animals identified" value={formatCount(stats.animalsIdentified)} hint={`${formatCount(stats.microchippedAnimals)} microchipped`} />
                  <StatCard icon={Syringe} label="Rabies vaccinations" value={formatCount(stats.rabiesVaccinations)} />
                  <StatCard icon={ScrollText} label="Active certificates" value={formatCount(stats.activeCertificates)} />
                  <StatCard icon={AlertTriangle} label="Expired certificates" value={formatCount(stats.expiredCertificates)} />
                  <StatCard icon={AlertTriangle} label="Cancelled / invalid" value={formatCount(stats.cancelledCertificates)} />
                  <StatCard icon={Stethoscope} label="Active veterinary practices" value={formatCount(stats.activePractices)} />
                  <StatCard icon={BadgeCheck} label="Authorised veterinarians" value={formatCount(stats.authorisedVeterinarians)} />
                  <StatCard icon={MapPinned} label="National coverage" value={`${stats.nationalCoveragePct}%`} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900">Alerts</h3>
                    <div className="mt-3 space-y-2">
                      {(snap?.alerts ?? []).map((alert) => (
                        <button
                          key={alert.id}
                          type="button"
                          className="flex w-full items-start justify-between rounded-lg bg-slate-50 px-3 py-2 text-left"
                          onClick={() => setSection(alert.id === "unlicensed" ? "animals" : alert.id === "vet-cases" || alert.id === "vet-reports" ? "vet-reports" : "alerts")}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {alert.severity === "red" ? "🔴" : alert.severity === "orange" ? "🟠" : "🟡"} {alert.title}
                            </p>
                            <p className="text-xs text-slate-500">{alert.detail}</p>
                          </div>
                          <Badge variant="secondary">{alert.count}</Badge>
                        </button>
                      ))}
                      {snap?.alerts.length === 0 ? <p className="text-sm text-slate-500">No exceptions right now.</p> : null}
                    </div>
                  </Card>
                  <Card className="overflow-hidden rounded-xl shadow-sm">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-semibold">Geographical coverage</h3>
                    </div>
                    <DvsGeoMap points={snap?.mapPoints ?? []} className="h-[280px] rounded-none" />
                  </Card>
                </div>

                <Card className="p-4">
                  <h3 className="font-semibold">Rabies coverage by province</h3>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Province</TableHead>
                        <TableHead>Animals</TableHead>
                        <TableHead>Vaccinated</TableHead>
                        <TableHead>Identified</TableHead>
                        <TableHead>Coverage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverageByProvince.map((row) => (
                        <TableRow key={row.province}>
                          <TableCell>{row.province}</TableCell>
                          <TableCell>{row.animals}</TableCell>
                          <TableCell>{row.vaccinated}</TableCell>
                          <TableCell>{row.identified}</TableCell>
                          <TableCell className="font-semibold">{row.coveragePct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold">Quick actions</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className="bg-rose-700 text-white hover:bg-rose-800" onClick={() => setSection("rabies-map")}>
                      <MapPinned className="mr-2 size-4" /> Map rabies cases
                    </Button>
                    <Button variant="secondary" onClick={() => setSection("animals")}>National animals</Button>
                    <Button variant="secondary" onClick={() => setSection("licensing")}>Animal licensing</Button>
                    <Button variant="secondary" onClick={() => setSection("finance")}>Licence finance</Button>
                    <Button variant="secondary" onClick={() => setSection("identification")}>Search animal</Button>
                    <Button variant="secondary" onClick={() => setSection("verify")}>Verify certificate</Button>
                    <Button variant="secondary" onClick={() => setSection("vaccination")}>View vaccination</Button>
                    <Button variant="secondary" onClick={() => setSection("practitioners")}>View veterinarian</Button>
                    <Button variant="secondary" onClick={() => setSection("reports")}>Generate report</Button>
                    <Button className="bg-[#123524]" onClick={() => setSection("certificates")}>Issue certificate</Button>
                  </div>
                </Card>
              </>
            ) : null}

            {section === "vaccination" ? (
              <div className="space-y-4">
                <Card className="space-y-3 p-4">
                  <div>
                    <h3 className="font-semibold">Recognised rabies vaccines</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Types and product names authorised for veterinary use. Practices select from this list when issuing a rabies certificate.
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-5">
                    <Input placeholder="Vaccine name" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} />
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={vaccineType} onChange={(e) => setVaccineType(e.target.value)}>
                      <option>Inactivated injectable</option>
                      <option>Live oral</option>
                      <option>Recombinant oral</option>
                    </select>
                    <Input placeholder="Manufacturer" value={vaccineMfr} onChange={(e) => setVaccineMfr(e.target.value)} />
                    <Input placeholder="Species" value={vaccineSpecies} onChange={(e) => setVaccineSpecies(e.target.value)} />
                    <Input placeholder="Strain (optional)" value={vaccineStrain} onChange={(e) => setVaccineStrain(e.target.value)} />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await createRecognisedVaccine({
                          name: vaccineName,
                          vaccineType,
                          manufacturer: vaccineMfr,
                          species: vaccineSpecies,
                          strain: vaccineStrain,
                        });
                        setVaccineName("");
                        setVaccineMfr("");
                        setVaccineStrain("");
                        toast.success("Recognised vaccine added");
                        await load();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not save vaccine");
                      }
                    }}
                  >
                    Add recognised vaccine
                  </Button>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Species</TableHead>
                        <TableHead>Strain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.recognisedVaccines ?? []).map((vaccine) => (
                        <TableRow key={vaccine.id}>
                          <TableCell className="font-medium">{vaccine.name}</TableCell>
                          <TableCell>{vaccine.vaccineType}</TableCell>
                          <TableCell>{vaccine.manufacturer}</TableCell>
                          <TableCell>{vaccine.species}</TableCell>
                          <TableCell>{vaccine.strain || "—"}</TableCell>
                          <TableCell>{vaccine.active ? "Active" : "Withdrawn"}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void setRecognisedVaccineActive(vaccine.id, !vaccine.active)
                                  .then(() => load())
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Update failed"));
                              }}
                            >
                              {vaccine.active ? "Withdraw" : "Restore"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold">Rabies vaccinations administered</h3>
                  <p className="mt-1 text-sm text-slate-500">By date, province, recognised product and status — sourced from DVS and veterinary practices.</p>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Province</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Vaccine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.vaccinations ?? []).slice(0, 80).map((row) => {
                        const vaccine = snap?.recognisedVaccines.find((item) => item.id === row.vaccineId);
                        const batch = snap?.batches.find((item) => item.id === row.batchId);
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{row.vaccinatedAt}</TableCell>
                            <TableCell>{row.province || "—"}</TableCell>
                            <TableCell>{row.district || "—"}</TableCell>
                            <TableCell>{vaccine?.name || batch?.vaccineName || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{batch?.batchNumber || row.batchId?.slice(0, 8) || "—"}</TableCell>
                            <TableCell className="capitalize">{row.status}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            ) : null}

            {section === "identification" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">Animal identification</h3>
                <p className="text-sm text-slate-500">
                  Live VetKonnect registry — {formatCount(snap?.pets.length ?? 0)} animals. Search name, microchip, collar or VetKonnect ID.
                </p>
                <div className="flex gap-2">
                  <Input placeholder="Search name, microchip, VetKonnect ID" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                  <Button onClick={() => void runSearch()}>Search</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Animal</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Microchip</TableHead>
                      <TableHead>VetKonnect ID</TableHead>
                      <TableHead>Licence</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(searchHits.length
                      ? searchHits.map((pet) => snap?.animalRegistry.find((row) => row.pet.id === pet.id) ?? { pet, licenceStatus: "unlicensed" as const })
                      : (snap?.animalRegistry ?? [])
                    ).map((row) => (
                      <TableRow key={row.pet.id}>
                        <TableCell className="font-medium">{row.pet.name}</TableCell>
                        <TableCell>{row.pet.species}</TableCell>
                        <TableCell className="text-sm">{row.ownerName || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.pet.microchip || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{row.pet.vetConnectId}</TableCell>
                        <TableCell className="capitalize">{row.licenceStatus}</TableCell>
                        <TableCell className="space-x-1 whitespace-nowrap">
                          <Button size="sm" variant="secondary" onClick={() => void selectIssuePet(row.pet)}>
                            Issue certificate
                          </Button>
                          {row.licenceStatus !== "licensed" ? (
                            <Button size="sm" className="bg-[#123524]" disabled={licenceBusyId === row.pet.id} onClick={() => void licenceAtOffice(row.pet)}>
                              {licenceBusyId === row.pet.id ? "Licensing…" : "Licence"}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "animals" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={PawPrint} label="Animals on VetKonnect" value={formatCount(snap?.stats.totalAnimals ?? 0)} />
                  <StatCard icon={BadgeCheck} label="Licensed" value={formatCount(snap?.stats.licensedAnimals ?? 0)} />
                  <StatCard icon={AlertTriangle} label="Unlicensed" value={formatCount(snap?.stats.unlicensedAnimals ?? 0)} />
                  <StatCard icon={Receipt} label="Species groups" value={formatCount(speciesCounts.length)} hint={speciesCounts.map(([name, count]) => `${name} ${count}`).join(" · ") || "None"} />
                </div>
                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold">National animal registry</h3>
                  <p className="text-sm text-slate-500">Every pet registered in VetKonnect, with owner contact and DVS licence status.</p>
                  <div className="flex flex-wrap gap-2">
                    <Input className="max-w-sm" placeholder="Search animal, owner, chip, licence" value={animalQ} onChange={(e) => setAnimalQ(e.target.value)} />
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={licenceFilter} onChange={(e) => setLicenceFilter(e.target.value as typeof licenceFilter)}>
                      <option value="all">All licence statuses</option>
                      <option value="licensed">Licensed</option>
                      <option value="unlicensed">Unlicensed</option>
                      <option value="expired">Expired</option>
                      <option value="revoked">Revoked</option>
                    </select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Animal</TableHead>
                        <TableHead>Species</TableHead>
                        <TableHead>Sex</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>VetKonnect ID</TableHead>
                        <TableHead>Licence</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalRegistry.map((row) => (
                        <TableRow key={row.pet.id}>
                          <TableCell className="font-medium">{row.pet.name}</TableCell>
                          <TableCell>{row.pet.species}</TableCell>
                          <TableCell>{row.pet.sex || "—"}</TableCell>
                          <TableCell>{row.ownerName || "—"}</TableCell>
                          <TableCell>{row.ownerPhone || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.pet.vetConnectId}</TableCell>
                          <TableCell className="capitalize">{row.licenceStatus}</TableCell>
                          <TableCell>{row.licenceExpiresAt || "—"}</TableCell>
                          <TableCell>
                            {row.licenceStatus !== "licensed" ? (
                              <Button size="sm" className="bg-[#123524]" disabled={licenceBusyId === row.pet.id} onClick={() => void licenceAtOffice(row.pet)}>
                                {licenceBusyId === row.pet.id ? "Licensing…" : "Licence at office"}
                              </Button>
                            ) : (
                              <span className="font-mono text-xs">{row.licenceNumber}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {animalRegistry.length === 0 ? <p className="text-sm text-slate-500">No animals match this filter.</p> : null}
                </Card>
              </div>
            ) : null}

            {section === "licensing" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">Animal licences</h3>
                <p className="text-sm text-slate-500">
                  Annual DVS companion-animal licences. Owners pay from the VetKonnect pet passport via Paynow (EcoCash, OneMoney or web). Officers can also licence at the counter.
                </p>
                <p className="text-xs text-slate-500">
                  Fees: dog {formatDvsMoney(DVS_LICENCE_FEES.dog)} · cat {formatDvsMoney(DVS_LICENCE_FEES.cat)} · other {formatDvsMoney(DVS_LICENCE_FEES.other)} · {DVS_LICENCE_FEES.validityDays} days.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Licence</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.licences ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.licenceNumber}</TableCell>
                        <TableCell>
                          {item.petName} · {item.species}
                        </TableCell>
                        <TableCell>{item.ownerName || "—"}</TableCell>
                        <TableCell>{item.issuedAt}</TableCell>
                        <TableCell>{item.expiresAt}</TableCell>
                        <TableCell>{formatDvsMoney(item.amount, item.currency)}</TableCell>
                        <TableCell className="capitalize">{item.status}</TableCell>
                        <TableCell>
                          {item.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void revokeDvsLicence(item.id, "Revoked by DVS")
                                  .then(() => load())
                                  .then(() => toast.success("Licence revoked"))
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Revoke failed"));
                              }}
                            >
                              Revoke
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(snap?.licences ?? []).length === 0 ? <p className="text-sm text-slate-500">No licences issued yet. Owners pay in the app, or licence an animal from National animals.</p> : null}
              </Card>
            ) : null}

            {section === "finance" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon={CircleDollarSign} label="Paid licence revenue" value={formatDvsMoney(snap?.licenceFinance.paidAmount ?? 0)} hint={`${snap?.licenceFinance.paidCount ?? 0} paid payments`} />
                  <StatCard icon={Receipt} label="Year to date" value={formatDvsMoney(snap?.licenceFinance.yearToDatePaid ?? 0)} hint={String(new Date().getFullYear())} />
                  <StatCard icon={AlertTriangle} label="Pending Paynow" value={formatDvsMoney(snap?.licenceFinance.pendingAmount ?? 0)} hint={`${snap?.licenceFinance.pendingCount ?? 0} awaiting confirmation`} />
                  <StatCard icon={PawPrint} label="Unlicensed animals" value={formatCount(snap?.licenceFinance.unlicensedAnimals ?? 0)} hint={`${snap?.licenceFinance.activeLicences ?? 0} active licences`} />
                </div>
                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold">Licence payments</h3>
                  <p className="text-sm text-slate-500">Paynow EcoCash, OneMoney, web checkout and DVS office collections.</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paynow</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.licencePayments ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{new Date(item.paidAt || item.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                          <TableCell className="capitalize">{item.method}</TableCell>
                          <TableCell>{formatDvsMoney(item.amount, item.currency)}</TableCell>
                          <TableCell className="capitalize">{item.status}</TableCell>
                          <TableCell className="text-xs">{item.paynowStatus || "—"}</TableCell>
                          <TableCell>
                            {item.status === "pending" ? (
                              <Button
                                size="sm"
                                className="bg-[#123524]"
                                disabled={licenceBusyId === item.id}
                                onClick={() => {
                                  setLicenceBusyId(item.id);
                                  void confirmPendingLicencePayment(item.id, officer.fullName)
                                    .then(() => load())
                                    .then(() => toast.success("Payment confirmed and licence issued"))
                                    .catch((error) => toast.error(error instanceof Error ? error.message : "Confirm failed"))
                                    .finally(() => setLicenceBusyId(null));
                                }}
                              >
                                Confirm paid
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {(snap?.licencePayments ?? []).length === 0 ? <p className="text-sm text-slate-500">No licence payments yet.</p> : null}
                </Card>
              </div>
            ) : null}

            {section === "certificates" ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold">Issue official certificate</h3>
                  <p className="text-sm text-slate-500">
                    One traceable record: animal + microchip + owner + veterinarian + vaccination + certificate. The owner sees it in the VetKonnect app as soon as it is issued.
                  </p>
                  <div className="flex gap-2">
                    <Input placeholder="Find animal to certify" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                    <Button variant="secondary" onClick={() => void runSearch()}>Find</Button>
                  </div>
                  {searchHits.length ? (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                      {searchHits.map((pet) => (
                        <button key={pet.id} type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-50" onClick={() => void selectIssuePet(pet)}>
                          {pet.name} · {pet.vetConnectId} · {pet.microchip || "no chip"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {issuePet ? (
                    <p className="text-sm font-medium text-emerald-800">
                      Selected: {issuePet.name} ({issuePet.vetConnectId})
                    </p>
                  ) : null}
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input placeholder="Owner name" value={issueOwnerName} onChange={(e) => setIssueOwnerName(e.target.value)} />
                    <Input placeholder="Owner phone" value={issueOwnerPhone} onChange={(e) => setIssueOwnerPhone(e.target.value)} />
                    <Input placeholder="Veterinarian" value={issueVet} onChange={(e) => setIssueVet(e.target.value)} />
                    <Input placeholder="Veterinary practice" value={issuePractice} onChange={(e) => setIssuePractice(e.target.value)} />
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={issueVaccineId} onChange={(e) => setIssueVaccineId(e.target.value)}>
                      <option value="">Recognised vaccine</option>
                      {(snap?.recognisedVaccines ?? []).filter((item) => item.active).map((vaccine) => (
                        <option key={vaccine.id} value={vaccine.id}>
                          {vaccine.name} · {vaccine.vaccineType}
                        </option>
                      ))}
                    </select>
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={issueBatchId} onChange={(e) => setIssueBatchId(e.target.value)}>
                      <option value="">Vaccine batch</option>
                      {(snap?.batches ?? []).map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber} · {batch.vaccineName} · {batch.manufacturer}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border bg-transparent px-3 text-sm"
                      value={issueProvince}
                      onChange={(e) => {
                        setIssueProvince(e.target.value);
                        setIssueDistrict(districtsForProvince(e.target.value)[0] ?? "");
                      }}
                    >
                      {DVS_PROVINCES.map((province) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={issueDistrict} onChange={(e) => setIssueDistrict(e.target.value)}>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                  <Textarea placeholder="Notes (optional)" value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} />
                  <Button className="bg-[#123524]" disabled={issueBusy} onClick={() => void issue()}>
                    {issueBusy ? "Issuing…" : "Generate certificate & notify owner"}
                  </Button>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Animal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.certificates ?? []).slice(0, 60).map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-mono text-xs">{cert.certificateNumber}</TableCell>
                          <TableCell>{cert.petName}</TableCell>
                          <TableCell className="capitalize">{cert.status}</TableCell>
                          <TableCell>{cert.expiresAt}</TableCell>
                          <TableCell className="space-x-1">
                            <Button size="sm" variant="secondary" onClick={() => setPreviewCert(cert)}>View</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void downloadDvsCertificatePdf(cert).catch((error) =>
                                  toast.error(error instanceof Error ? error.message : "PDF failed"),
                                );
                              }}
                            >
                              PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void notifyOwnerOfCertificate(cert)
                                  .then(() => toast.success("Sent to owner app"))
                                  .catch((error) => toast.error(error instanceof Error ? error.message : "Send failed"));
                              }}
                            >
                              Send
                            </Button>
                            {cert.status === "valid" ? (
                              <Button size="sm" variant="ghost" onClick={() => void updateCertificateStatus(cert.id, "cancelled").then(() => load())}>
                                Cancel
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
                <div className="space-y-3">
                  {previewCert ? (
                    <>
                      <DvsCertificateVisual certificate={previewCert} />
                      <Button
                        className="w-full"
                        onClick={() => {
                          void downloadDvsCertificatePdf(previewCert).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "PDF failed"),
                          );
                        }}
                      >
                        Download PDF
                      </Button>
                    </>
                  ) : (
                    <Card className="p-6 text-sm text-slate-500">Select or issue a certificate to preview the official visual.</Card>
                  )}
                </div>
              </div>
            ) : null}

            {section === "verify" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">QR verification activity</h3>
                <div className="flex gap-2">
                  <Input placeholder="Verification or certificate number" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} />
                  <Button onClick={() => verifyCode.trim() && (window.location.href = `/certificate/${verifyCode.trim()}`)}>Verify now</Button>
                </div>
                <p className="text-sm text-slate-500">Today: {snap?.stats.scansToday ?? 0} scans</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Context</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.scans ?? []).slice(0, 80).map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell className="text-xs">{new Date(scan.scannedAt).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{scan.verificationCode}</TableCell>
                        <TableCell className="capitalize">{scan.result.replace("_", " ")}</TableCell>
                        <TableCell>{scan.scannerContext}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "practitioners" ? (
              <Card className="p-4">
                <h3 className="font-semibold">Veterinary practitioners & practices</h3>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Practice</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Certificates</TableHead>
                      <TableHead>Vaccinations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.practitioners ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.practiceName}</TableCell>
                        <TableCell>{row.verified ? "Yes" : "No"}</TableCell>
                        <TableCell>{row.certificatesIssued}</TableCell>
                        <TableCell>{row.vaccinationsRecorded}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "batches" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">Vaccine & batch tracking</h3>
                <div className="grid gap-2 md:grid-cols-5">
                  <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={batchVaccineId} onChange={(e) => setBatchVaccineId(e.target.value)}>
                    <option value="">Recognised vaccine</option>
                    {(snap?.recognisedVaccines ?? []).filter((item) => item.active).map((vaccine) => (
                      <option key={vaccine.id} value={vaccine.id}>
                        {vaccine.name}
                      </option>
                    ))}
                  </select>
                  <Input placeholder="Manufacturer" value={batchMfr} onChange={(e) => setBatchMfr(e.target.value)} />
                  <Input placeholder="Batch number" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
                  <Input placeholder="Quantity" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
                  <Input type="date" value={batchExpiry} onChange={(e) => setBatchExpiry(e.target.value)} />
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const vaccine = snap?.recognisedVaccines.find((item) => item.id === batchVaccineId);
                      await createVaccineBatch({
                        manufacturer: batchMfr || vaccine?.manufacturer || "",
                        batchNumber: batchNo,
                        vaccineName: vaccine?.name,
                        vaccineId: vaccine?.id,
                        quantityReceived: Number(batchQty) || 0,
                        expiryDate: batchExpiry || undefined,
                      });
                      setBatchMfr("");
                      setBatchNo("");
                      toast.success("Batch recorded");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not save batch");
                    }
                  }}
                >
                  Record batch
                </Button>
                <Table>
                  <TableHeader>
                      <TableRow>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Vaccine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Linked vaccinations</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.batches ?? []).map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.manufacturer}</TableCell>
                        <TableCell>{batch.vaccineName}</TableCell>
                        <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.quantityReceived}</TableCell>
                        <TableCell>{batch.expiryDate || "—"}</TableCell>
                        <TableCell className="capitalize">{batch.source || "dvs"}</TableCell>
                        <TableCell>{snap?.vaccinations.filter((v) => v.batchId === batch.id).length ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "surveillance" ? (
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Rabies surveillance</h3>
                  <Button className="bg-rose-700 text-white hover:bg-rose-800" size="sm" onClick={() => setSection("rabies-map")}>
                    <MapPinned className="mr-2 size-4" /> Map rabies cases
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-5">
                  <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={caseStatus} onChange={(e) => setCaseStatus(e.target.value as DvsRabiesCaseStatus)}>
                    <option value="suspected">Suspected</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="negative">Negative</option>
                  </select>
                  <Input value={caseSpecies} onChange={(e) => setCaseSpecies(e.target.value)} />
                  <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={caseProvince} onChange={(e) => setCaseProvince(e.target.value)}>
                    {DVS_PROVINCES.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  <Input value={caseDistrict} onChange={(e) => setCaseDistrict(e.target.value)} />
                  <Input value={caseVax} onChange={(e) => setCaseVax(e.target.value)} placeholder="Vaccination status" />
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await createRabiesCase({
                        status: caseStatus,
                        species: caseSpecies,
                        province: caseProvince,
                        district: caseDistrict,
                        vaccinationStatus: caseVax,
                      });
                      toast.success("Case recorded");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not save case");
                    }
                  }}
                >
                  Record case
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Vaccination</TableHead>
                      <TableHead>Reported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.rabiesCases ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="capitalize">{item.status}</TableCell>
                        <TableCell>{item.species}</TableCell>
                        <TableCell>{item.province} {item.district}</TableCell>
                        <TableCell>{item.vaccinationStatus}</TableCell>
                        <TableCell className="text-xs">{new Date(item.reportedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "vet-reports" ? (
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold">Rabies cases reported by veterinarians</h3>
                  <p className="mt-1 text-sm text-slate-500">These feed the national rabies map as soon as a practice submits them.</p>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Veterinarian</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Animal</TableHead>
                        <TableHead>Review</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.vetCaseReports ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{new Date(item.reportedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <p className="font-medium">{item.veterinarianName || "Veterinarian"}</p>
                            <p className="text-xs text-slate-500">{item.practiceName}</p>
                          </TableCell>
                          <TableCell className="capitalize">{item.caseStatus}</TableCell>
                          <TableCell>{[item.province, item.district].filter(Boolean).join(" · ") || "—"}</TableCell>
                          <TableCell>{item.petName || item.species || "—"}</TableCell>
                          <TableCell className="capitalize">{item.reviewStatus.replace("_", " ")}</TableCell>
                          <TableCell className="space-x-1">
                            {item.reviewStatus === "submitted" ? (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => void reviewVetCaseReport(item.id, "under_review").then(() => load())}>Review</Button>
                                <Button size="sm" className="bg-[#123524]" onClick={() => void reviewVetCaseReport(item.id, "acknowledged").then(() => load())}>Acknowledge</Button>
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {(snap?.vetCaseReports ?? []).length === 0 ? <p className="mt-3 text-sm text-slate-500">No practice case reports yet.</p> : null}
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold">Animal health reports from practices</h3>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Veterinarian</TableHead>
                        <TableHead>Review</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.healthReports ?? []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{new Date(item.submittedAt).toLocaleString()}</TableCell>
                          <TableCell className="capitalize">{item.reportType.replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            <p className="font-medium">{item.title}</p>
                            <p className="line-clamp-2 text-xs text-slate-500">{item.body}</p>
                          </TableCell>
                          <TableCell>{item.veterinarianName}</TableCell>
                          <TableCell className="capitalize">{item.reviewStatus}</TableCell>
                          <TableCell className="space-x-1">
                            {item.reviewStatus === "submitted" ? (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => void reviewAnimalHealthReport(item.id, "acknowledged").then(() => load())}>Acknowledge</Button>
                                <Button size="sm" className="bg-[#123524]" onClick={() => void reviewAnimalHealthReport(item.id, "actioned").then(() => load())}>Mark actioned</Button>
                              </>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {(snap?.healthReports ?? []).length === 0 ? <p className="mt-3 text-sm text-slate-500">No animal health reports from vets yet.</p> : null}
                </Card>
              </div>
            ) : null}

            {section === "alerts" ? (
              <div className="grid gap-3 md:grid-cols-2">
                {(snap?.alerts ?? []).map((alert) => (
                  <Card key={alert.id} className="p-4">
                    <p className="text-sm font-semibold">
                      {alert.severity === "red" ? "🔴" : alert.severity === "orange" ? "🟠" : "🟡"} {alert.title}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{alert.detail}</p>
                    <p className="mt-3 text-2xl font-bold">{alert.count}</p>
                  </Card>
                ))}
                {snap?.alerts.length === 0 ? <Card className="p-6 text-sm text-slate-500">No alerts.</Card> : null}
              </div>
            ) : null}

            {section === "reports" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">Reports & analytics</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">From <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} /></label>
                  <label className="text-sm">To <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} /></label>
                  <Button
                    disabled={reportBusy}
                    onClick={async () => {
                      setReportBusy(true);
                      try {
                        const report = await buildDvsSystemReport({ from: reportFrom, to: reportTo });
                        setReportPreview(report);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Report failed");
                      } finally {
                        setReportBusy(false);
                      }
                    }}
                  >
                    Preview
                  </Button>
                  <Button variant="secondary" disabled={!reportPreview} onClick={() => reportPreview && exportDvsReportPdf(reportPreview)}>
                    <FileText className="mr-2 size-4" /> PDF
                  </Button>
                  <Button variant="secondary" disabled={!reportPreview} onClick={() => reportPreview && exportDvsReportExcel(reportPreview)}>
                    <FileSpreadsheet className="mr-2 size-4" /> Excel
                  </Button>
                </div>
                {reportPreview ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {Object.entries(reportPreview.summary).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs uppercase text-slate-500">{key.replace(/([A-Z])/g, " $1")}</p>
                        <p className="font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}

            {section === "users" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">User & access management</h3>
                <p className="text-sm text-slate-500">DVS officers. Veterinary practitioners are managed in VetKonnect Admin; local authorities use the Council portal.</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Full name" value={officerName} onChange={(e) => setOfficerName(e.target.value)} />
                  <Input placeholder="Title" value={officerTitle} onChange={(e) => setOfficerTitle(e.target.value)} />
                  <Input type="email" placeholder="Email" value={officerEmail} onChange={(e) => setOfficerEmail(e.target.value)} />
                  <Input type="password" placeholder="Password" value={officerPassword} onChange={(e) => setOfficerPassword(e.target.value)} />
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await createDvsOfficer({
                        fullName: officerName,
                        email: officerEmail,
                        password: officerPassword,
                        title: officerTitle || undefined,
                      });
                      setOfficerName("");
                      setOfficerEmail("");
                      setOfficerPassword("");
                      toast.success("Officer registered");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not create officer");
                    }
                  }}
                >
                  Register DVS officer
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.officers ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.fullName}</TableCell>
                        <TableCell>{item.email}</TableCell>
                        <TableCell>{item.role}</TableCell>
                        <TableCell>{item.active ? "Active" : "Inactive"}</TableCell>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="secondary" onClick={() => void setDvsOfficerActive(item.id, !item.active).then(() => load())}>
                            {item.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void deleteDvsOfficer(item.id).then(() => load())}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "audit" ? (
              <Card className="p-4">
                <h3 className="font-semibold">Audit trail</h3>
                <p className="mt-1 text-sm text-slate-500">Who created, changed, verified, cancelled or accessed a certificate/record.</p>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.audit ?? []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">{new Date(row.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{row.actorName || row.actorType}</TableCell>
                        <TableCell>{row.action}</TableCell>
                        <TableCell className="text-xs">{row.entityType} {row.entityId ? `· ${row.entityId.slice(0, 8)}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}

            {section === "settings" ? (
              <Card className="space-y-3 p-4">
                <h3 className="font-semibold">System administration</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm">Certificate validity (days)
                    <Input value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
                  </label>
                  <label className="text-sm">Low-coverage alert (%)
                    <Input value={coverageThreshold} onChange={(e) => setCoverageThreshold(e.target.value)} />
                  </label>
                  <label className="text-sm">Expiry warning (days)
                    <Input value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
                  </label>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await saveDvsSettings(
                        {
                          certificateValidityDays: Number(validityDays) || 365,
                          coverageAlertThreshold: Number(coverageThreshold) || 70,
                          expiryWarningDays: Number(expiryDays) || 30,
                          verificationEnabled: true,
                        },
                        officer,
                      );
                      toast.success("Settings saved");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not save settings");
                    }
                  }}
                >
                  Save configuration
                </Button>
              </Card>
            ) : null}

          </div>
        </main>
      )}
    </div>
  );
}
