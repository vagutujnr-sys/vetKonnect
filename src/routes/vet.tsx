import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  PawPrint,
  ScrollText,
  Syringe,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { AppShell } from "@/components/layout/AppShell";
import { HeaderAlerts } from "@/components/layout/HeaderAlerts";
import { TagScanPanel } from "@/components/vet/TagScanPanel";
import { VetFeatureGate } from "@/components/vet/VetFeatureGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/hooks/useApp";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { isVetAccount } from "@/lib/account";
import { DVS_PROVINCES, districtsForProvince } from "@/lib/dvsRegions";
import { cn } from "@/lib/utils";
import { getRecentPatients, lookupPatientByTag, requestPracticeDashboard } from "@/services/vetService";
import {
  deleteVetPracticeNote,
  getVetDashboardSnapshot,
  issueVetRabiesCertificate,
  recordVetVaccineBatch,
  reportCaseToDvs,
  saveVetPracticeNote,
  searchDvsAnimals,
  submitAnimalHealthReport,
  type VetDashboardSnapshot,
} from "@/services/vetPracticeService";
import type { DvsHealthReportType, DvsRabiesCaseStatus, Pet } from "@/types";

export const Route = createFileRoute("/vet")({
  head: () => ({
    meta: [
      { title: "Practice Dashboard — VetKonnect" },
      { name: "description", content: "Veterinary practice dashboard for vaccinations, notes, and DVS reporting." },
    ],
  }),
  component: VetDashboard,
});

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "patients", label: "Patients", icon: PawPrint },
  { id: "vaccinations", label: "Vaccinations", icon: Syringe },
  { id: "notes", label: "Practice notes", icon: NotebookPen },
  { id: "cases", label: "Report cases", icon: ClipboardList },
  { id: "reports", label: "Health reports", icon: FileText },
  { id: "impact", label: "Impact", icon: HeartHandshake },
] as const;

type VetSection = (typeof sections)[number]["id"];

const REPORT_TYPES: { id: DvsHealthReportType; label: string }[] = [
  { id: "monthly_summary", label: "Monthly summary" },
  { id: "outbreak", label: "Outbreak" },
  { id: "notifiable_disease", label: "Notifiable disease" },
  { id: "vaccination_campaign", label: "Vaccination campaign" },
  { id: "laboratory", label: "Laboratory" },
  { id: "other", label: "Other" },
];

function VetDashboard() {
  const navigate = useNavigate();
  const { ready, user, signOut, refreshSession } = useApp();
  const isDesktop = useIsDesktop(1024);
  const verified = Boolean(user.vetVerified);
  const hasRequestedDashboard = Boolean(user.dashboardRequestedAt) || Boolean(user.practiceName?.trim());
  const firstName = user.fullName?.split(" ")[0] || "Doctor";

  const [section, setSection] = useState<VetSection>("overview");
  const [snap, setSnap] = useState<VetDashboardSnapshot | null>(null);
  const [recent, setRecent] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [searching, setSearching] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<Pet[]>([]);
  const [issuePet, setIssuePet] = useState<Pet | null>(null);
  const [vaccineId, setVaccineId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");
  const [batchQty, setBatchQty] = useState("0");
  const [vaxDate, setVaxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [province, setProvince] = useState("Harare");
  const [district, setDistrict] = useState("Harare Urban");
  const [vaxNotes, setVaxNotes] = useState("");
  const [issueBusy, setIssueBusy] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePetName, setNotePetName] = useState("");

  const [caseStatus, setCaseStatus] = useState<DvsRabiesCaseStatus>("suspected");
  const [caseSpecies, setCaseSpecies] = useState("Dog");
  const [casePetName, setCasePetName] = useState("");
  const [caseLocation, setCaseLocation] = useState("");
  const [caseVax, setCaseVax] = useState("Unknown");
  const [caseNotes, setCaseNotes] = useState("");

  const [reportType, setReportType] = useState<DvsHealthReportType>("monthly_summary");
  const [reportTitle, setReportTitle] = useState("");
  const [reportBody, setReportBody] = useState("");

  const districtOptions = useMemo(() => districtsForProvince(province), [province]);
  const activeVaccines = snap?.vaccines ?? [];
  const selectedVaccine = activeVaccines.find((item) => item.id === vaccineId) ?? activeVaccines[0] ?? null;

  const load = async () => {
    if (!verified) return;
    setLoading(true);
    try {
      const patients = await getRecentPatients().catch(() => [] as Pet[]);
      setRecent(patients);
      const next = await getVetDashboardSnapshot();
      setSnap(next);
      if (!vaccineId && next.vaccines[0]) setVaccineId(next.vaccines[0].id);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not load practice data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!ready) return;
    if (!isVetAccount(user)) {
      void navigate({ to: "/home" });
    }
  }, [navigate, ready, user]);

  useEffect(() => {
    if (ready && verified) void load();
  }, [ready, verified]);

  const requestDashboard = async () => {
    setRequesting(true);
    try {
      await requestPracticeDashboard();
      await refreshSession();
      toast.success("Practice dashboard requested");
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
      toast.success(`Found ${pet.name}`);
      void navigate({ to: "/patients/$petId", params: { petId: pet.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find that patient.");
    } finally {
      setSearching(false);
    }
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

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/register" });
  };

  if (!ready || !isVetAccount(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-muted-foreground">
        Loading practice dashboard…
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <AppShell>
        <header className="flex items-start justify-between px-5 pt-8">
          <div>
            <p className="text-sm text-muted-foreground">Practice workspace</p>
            <h1 className="text-[22px] font-extrabold">
              Hie, <span className="text-primary">{firstName}</span>
            </h1>
          </div>
          <HeaderAlerts />
        </header>
        {!verified ? (
          <section className="mx-5 mt-5 rounded-2xl border border-border bg-card p-4">
            <p className="font-bold">Practice Dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasRequestedDashboard
                ? "Your request is with VetKonnect admin."
                : "Request access so admin can verify your practice."}
            </p>
            <Button variant="hero" size="sm" className="mt-3" disabled={requesting || hasRequestedDashboard} onClick={() => void requestDashboard()}>
              {hasRequestedDashboard ? "Request sent" : "Request Practice Dashboard"}
            </Button>
          </section>
        ) : null}
        <VetFeatureGate verified={verified} title="Practice dashboard">
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
            <h2 className="font-extrabold">Scan patient tag</h2>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">Open a health card, or use a computer for certificates and DVS reports.</p>
            <TagScanPanel busy={searching} onScan={handleScan} />
          </section>
          <section className="mx-5 mt-4 mb-4 rounded-2xl border border-border bg-card p-4">
            <h2 className="font-extrabold">Recent patients</h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Scan a tag to pull patient history.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {recent.map((pet) => (
                  <Link
                    key={pet.id}
                    to="/patients/$petId"
                    params={{ petId: pet.id }}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-3"
                  >
                    <span className="font-bold">{pet.name}</span>
                    <span className="text-xs text-muted-foreground">{pet.vetConnectId}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </VetFeatureGate>
      </AppShell>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-slate-100">
      <aside className="fixed left-0 top-0 z-10 h-screen w-[280px] overflow-hidden border-r border-slate-200 bg-white shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex-shrink-0 p-5">
            <Logo size="md" hideSubtitle className="h-12" />
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">Practice</p>
              <h2 className="text-lg font-semibold tracking-tight">Veterinary dashboard</h2>
              <p className="text-sm leading-5 text-muted-foreground">{user.practiceName?.trim() || "Your practice"}</p>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
            <div className="space-y-2">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "impact") {
                      void navigate({ to: "/impact" });
                      return;
                    }
                    setSection(item.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium transition",
                    section === item.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-slate-800 hover:bg-slate-50",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/10 text-muted-foreground">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-4">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => void handleSignOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </aside>

      <main className="ml-[280px] min-h-screen px-6 py-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                  Veterinary
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Practice control center</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Vaccinate against rabies, keep notes, and send cases and animal health reports directly to DVS.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" className="h-10" disabled={loading} onClick={() => void load()}>
                  {loading ? "Refreshing…" : "Refresh"}
                </Button>
                <Button variant="secondary" size="sm" className="h-10" onClick={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </div>
            </div>
          </div>

          {!verified ? (
            <Card className="p-6">
              <p className="font-semibold">Practice access pending</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasRequestedDashboard
                  ? "VetKonnect admin is reviewing your verification. Patients, certificates and DVS reporting unlock after approval."
                  : "Request verification so you can issue rabies certificates and report to DVS."}
              </p>
              <Button className="mt-4" disabled={requesting || hasRequestedDashboard} onClick={() => void requestDashboard()}>
                {hasRequestedDashboard ? "Request sent" : "Request Practice Dashboard"}
              </Button>
            </Card>
          ) : null}

          {verified && section === "overview" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Users} label="Patients served" value={user.patientsServed ?? 0} />
                <StatCard icon={PawPrint} label="Recent lookups" value={recent.length} />
                <StatCard icon={ScrollText} label="Certificates issued" value={snap?.myCertificates.length ?? 0} />
                <StatCard icon={ClipboardList} label="Reports to DVS" value={(snap?.myCaseReports.length ?? 0) + (snap?.myHealthReports.length ?? 0)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="font-semibold">Quick actions</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => setSection("vaccinations")}>Issue vaccine certificate</Button>
                    <Button variant="secondary" onClick={() => setSection("cases")}>Report a case to DVS</Button>
                    <Button variant="secondary" onClick={() => setSection("reports")}>Submit health report</Button>
                    <Button variant="secondary" onClick={() => setSection("notes")}>Save a note</Button>
                  </div>
                </Card>
                <Card className="p-5">
                  <h3 className="font-semibold">DVS recognised vaccines</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Select one of these products when you vaccinate.</p>
                  <div className="mt-3 space-y-2">
                    {activeVaccines.slice(0, 6).map((vaccine) => (
                      <div key={vaccine.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-medium">{vaccine.name}</span>
                        <span className="text-xs text-muted-foreground">{vaccine.vaccineType}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          ) : null}

          {verified && section === "patients" ? (
            <Card className="space-y-4 p-5">
              <h3 className="font-semibold">Patients</h3>
              <TagScanPanel busy={searching} onScan={handleScan} />
              <div className="flex gap-2">
                <Input placeholder="Name, microchip, VetKonnect ID" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                <Button variant="secondary" onClick={() => void runSearch()}>Search</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Animal</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(searchHits.length ? searchHits : recent).map((pet) => (
                    <TableRow key={pet.id}>
                      <TableCell className="font-medium">{pet.name}</TableCell>
                      <TableCell className="font-mono text-xs">{pet.vetConnectId}</TableCell>
                      <TableCell>{pet.healthStatus}</TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="secondary" asChild>
                          <Link to="/patients/$petId" params={{ petId: pet.id }}>Health card</Link>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setIssuePet(pet);
                            setSection("vaccinations");
                          }}
                        >
                          Vaccinate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          {verified && section === "vaccinations" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="space-y-3 p-5">
                <h3 className="font-semibold">Record vaccine batch</h3>
                <p className="text-sm text-muted-foreground">Enter the batch you are using. DVS sees it against the recognised product.</p>
                <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={selectedVaccine?.id ?? ""} onChange={(e) => setVaccineId(e.target.value)}>
                  {activeVaccines.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name} · {vaccine.vaccineType} · {vaccine.manufacturer}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 md:grid-cols-3">
                  <Input placeholder="Batch number" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
                  <Input type="date" value={batchExpiry} onChange={(e) => setBatchExpiry(e.target.value)} />
                  <Input placeholder="Quantity on hand" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!selectedVaccine) return;
                    try {
                      await recordVetVaccineBatch({
                        vaccine: selectedVaccine,
                        batchNumber: batchNo,
                        expiryDate: batchExpiry || undefined,
                        quantityReceived: Number(batchQty) || 0,
                      });
                      toast.success("Batch saved for this practice");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not save batch");
                    }
                  }}
                >
                  Save batch
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaccine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.myBatches ?? []).slice(0, 12).map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.vaccineName}</TableCell>
                        <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
                        <TableCell>{batch.expiryDate || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Card className="space-y-3 p-5">
                <h3 className="font-semibold">Issue rabies certificate</h3>
                <p className="text-sm text-muted-foreground">Select the recognised vaccine you administered. The certificate feeds DVS and the owner app.</p>
                {issuePet ? (
                  <p className="text-sm font-medium text-primary">Selected: {issuePet.name} ({issuePet.vetConnectId})</p>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="Find animal" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                    <Button variant="secondary" onClick={() => void runSearch()}>Find</Button>
                  </div>
                )}
                {searchHits.length && !issuePet ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {searchHits.map((pet) => (
                      <button key={pet.id} type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-50" onClick={() => setIssuePet(pet)}>
                        {pet.name} · {pet.vetConnectId}
                      </button>
                    ))}
                  </div>
                ) : null}
                <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={selectedVaccine?.id ?? ""} onChange={(e) => setVaccineId(e.target.value)}>
                  {activeVaccines.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name} · {vaccine.vaccineType}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Batch number used" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
                  <Input type="date" value={vaxDate} onChange={(e) => setVaxDate(e.target.value)} />
                  <select
                    className="h-9 rounded-md border bg-transparent px-3 text-sm"
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setDistrict(districtsForProvince(e.target.value)[0] ?? "");
                    }}
                  >
                    {DVS_PROVINCES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={district} onChange={(e) => setDistrict(e.target.value)}>
                    {districtOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <Textarea placeholder="Clinical notes (optional)" value={vaxNotes} onChange={(e) => setVaxNotes(e.target.value)} />
                <Button
                  disabled={issueBusy}
                  onClick={async () => {
                    if (!issuePet || !selectedVaccine) {
                      toast.error("Select an animal and a recognised vaccine.");
                      return;
                    }
                    setIssueBusy(true);
                    try {
                      const cert = await issueVetRabiesCertificate({
                        pet: issuePet,
                        vaccine: selectedVaccine,
                        batchNumber: batchNo,
                        batchExpiry: batchExpiry || undefined,
                        vaccinatedAt: vaxDate,
                        province,
                        district,
                        notes: vaxNotes,
                      });
                      toast.success(`Certificate ${cert.certificateNumber} issued and sent to DVS`);
                      setIssuePet(null);
                      setVaxNotes("");
                      await load();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not issue certificate");
                    } finally {
                      setIssueBusy(false);
                    }
                  }}
                >
                  {issueBusy ? "Issuing…" : "Issue certificate"}
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Animal</TableHead>
                      <TableHead>Vaccine</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(snap?.myCertificates ?? []).slice(0, 8).map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-mono text-xs">{cert.certificateNumber}</TableCell>
                        <TableCell>{cert.petName}</TableCell>
                        <TableCell>{cert.vaccineName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ) : null}

          {verified && section === "notes" ? (
            <Card className="space-y-3 p-5">
              <h3 className="font-semibold">Practice notes</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <Input placeholder="Title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
                <Input placeholder="Linked animal (optional)" value={notePetName} onChange={(e) => setNotePetName(e.target.value)} />
              </div>
              <Textarea placeholder="Clinical or practice note" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <Button
                onClick={async () => {
                  try {
                    await saveVetPracticeNote({ title: noteTitle, body: noteBody, petName: notePetName });
                    setNoteTitle("");
                    setNoteBody("");
                    setNotePetName("");
                    toast.success("Note saved");
                    await load();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not save note");
                  }
                }}
              >
                Save note
              </Button>
              <div className="space-y-2">
                {(snap?.notes ?? []).map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{note.title}</p>
                        {note.petName ? <p className="text-xs text-muted-foreground">{note.petName}</p> : null}
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => void deleteVetPracticeNote(note.id).then(() => load())}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {verified && section === "cases" ? (
            <Card className="space-y-3 p-5">
              <h3 className="font-semibold">Report a case to DVS</h3>
              <p className="text-sm text-muted-foreground">Suspected or confirmed rabies cases go onto the national DVS map immediately.</p>
              <div className="grid gap-2 md:grid-cols-3">
                <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={caseStatus} onChange={(e) => setCaseStatus(e.target.value as DvsRabiesCaseStatus)}>
                  <option value="suspected">Suspected</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="negative">Negative</option>
                </select>
                <Input value={caseSpecies} onChange={(e) => setCaseSpecies(e.target.value)} placeholder="Species" />
                <Input value={casePetName} onChange={(e) => setCasePetName(e.target.value)} placeholder="Animal / herd name" />
                <select
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={province}
                  onChange={(e) => {
                    setProvince(e.target.value);
                    setDistrict(districtsForProvince(e.target.value)[0] ?? "");
                  }}
                >
                  {DVS_PROVINCES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {districtOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <Input value={caseLocation} onChange={(e) => setCaseLocation(e.target.value)} placeholder="Suburb / farm" />
                <Input value={caseVax} onChange={(e) => setCaseVax(e.target.value)} placeholder="Vaccination status" />
              </div>
              <Textarea placeholder="Clinical findings, bite history, sample status" value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} />
              <Button
                className="bg-rose-700 text-white hover:bg-rose-800"
                onClick={async () => {
                  try {
                    await reportCaseToDvs({
                      status: caseStatus,
                      species: caseSpecies,
                      petName: casePetName,
                      province,
                      district,
                      locationLabel: caseLocation,
                      vaccinationStatus: caseVax,
                      notes: caseNotes,
                    });
                    toast.success("Case sent to DVS");
                    setCaseNotes("");
                    await load();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not report case");
                  }
                }}
              >
                Send to DVS
              </Button>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>DVS review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(snap?.myCaseReports ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{new Date(item.reportedAt).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{item.caseStatus}</TableCell>
                      <TableCell>{[item.province, item.district].filter(Boolean).join(" · ")}</TableCell>
                      <TableCell><Badge variant="secondary">{item.reviewStatus.replace("_", " ")}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          {verified && section === "reports" ? (
            <Card className="space-y-3 p-5">
              <h3 className="font-semibold">Submit an animal health report</h3>
              <p className="text-sm text-muted-foreground">Monthly summaries, outbreaks and notifiable disease reports appear on the DVS control room.</p>
              <div className="grid gap-2 md:grid-cols-2">
                <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={reportType} onChange={(e) => setReportType(e.target.value as DvsHealthReportType)}>
                  {REPORT_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <Input placeholder="Report title" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
              </div>
              <Textarea placeholder="Findings, numbers vaccinated, laboratory results, recommended action" value={reportBody} onChange={(e) => setReportBody(e.target.value)} />
              <Button
                onClick={async () => {
                  try {
                    await submitAnimalHealthReport({
                      reportType,
                      title: reportTitle,
                      body: reportBody,
                      province,
                      district,
                    });
                    setReportTitle("");
                    setReportBody("");
                    toast.success("Report submitted to DVS");
                    await load();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not submit report");
                  }
                }}
              >
                Submit to DVS
              </Button>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>DVS review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(snap?.myHealthReports ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{new Date(item.submittedAt).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{item.reportType.replace(/_/g, " ")}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell><Badge variant="secondary">{item.reviewStatus}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold">{value}</p>
      </div>
    </Card>
  );
}
