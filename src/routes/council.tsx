import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Compass,
  Dog,
  FileSpreadsheet,
  FileText,
  FileWarning,
  LogOut,
  MapPinned,
  MessageSquarePlus,
  Monitor,
  PawPrint,
  QrCode,
  ShieldCheck,
  Syringe,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { CouncilCommunityPanel } from "@/components/council/CouncilCommunityPanel";
import { CouncilDiscoverPanel } from "@/components/council/CouncilDiscoverPanel";
import { CouncilFieldScan } from "@/components/council/CouncilFieldScan";
import { CouncilGeoMap } from "@/components/council/CouncilGeoMap";
import { CouncilProfilePanel } from "@/components/council/CouncilProfilePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  buildCouncilRevenueProjections,
  buildCouncilRevenueSnapshot,
  formatCouncilMoney,
  type CouncilRevenueSnapshot,
} from "@/lib/councilRevenue";
import { cn } from "@/lib/utils";
import {
  broadcastCouncilNotification,
  clearCouncilSession,
  createCouncilCommunityPost,
  getCouncilDashboardSnapshot,
  getCouncilSessionOfficial,
  uploadCouncilCommunityMedia,
} from "@/services/councilService";
import {
  buildCouncilSystemReport,
  exportCouncilReportExcel,
  exportCouncilReportPdf,
  type CouncilSystemReport,
} from "@/services/councilReportService";
import type {
  AnimalControlCase,
  CommunityPost,
  CouncilDashboardStats,
  CouncilMapPoint,
  CouncilOfficial,
  MediaType,
  Pet,
  PetLicence,
} from "@/types";

export const Route = createFileRoute("/council")({
  head: () => ({
    meta: [
      { title: "Council Portal — VetKonnect" },
      {
        name: "description",
        content: "City Council field portal and municipal animal-control dashboard.",
      },
    ],
  }),
  component: CouncilPortal,
});

const mobileTabs = [
  { id: "scan", label: "Scan", icon: QrCode },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "community", label: "Community", icon: Users },
  { id: "profile", label: "Profile", icon: User },
] as const;

const desktopSections = [
  { id: "overview", label: "Overview" },
  { id: "revenue", label: "Revenue" },
  { id: "projections", label: "Projections" },
  { id: "reports", label: "Reports" },
  { id: "licences", label: "Licences" },
  { id: "cases", label: "Cases" },
  { id: "rabies", label: "Rabies" },
  { id: "map", label: "Geography" },
  { id: "notify", label: "Notify app" },
  { id: "publish", label: "Post community" },
  { id: "scan", label: "Field scan" },
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
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

function CouncilPortal() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop(1024);
  const [official, setOfficial] = useState<CouncilOfficial | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("scan");
  const [section, setSection] = useState<DesktopSection>("revenue");
  const [stats, setStats] = useState<CouncilDashboardStats | null>(null);
  const [licences, setLicences] = useState<PetLicence[]>([]);
  const [cases, setCases] = useState<AnimalControlCase[]>([]);
  const [rabiesMissing, setRabiesMissing] = useState<Pet[]>([]);
  const [mapPoints, setMapPoints] = useState<CouncilMapPoint[]>([]);
  const [dogs, setDogs] = useState<Pet[]>([]);

  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeBusy, setNoticeBusy] = useState(false);

  const [postBody, setPostBody] = useState("");
  const [postTag, setPostTag] = useState<CommunityPost["tag"]>("Education");
  const [postNotify, setPostNotify] = useState(true);
  const [postBusy, setPostBusy] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportBusy, setReportBusy] = useState(false);
  const [reportPreview, setReportPreview] = useState<CouncilSystemReport | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getCouncilDashboardSnapshot();
      setStats(snap.stats);
      setLicences(snap.licences);
      setCases(snap.cases);
      setRabiesMissing(snap.rabiesMissingDogs);
      setMapPoints(snap.mapPoints);
      setDogs(snap.dogs);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not load council data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const session = await getCouncilSessionOfficial();
      if (!session) {
        void navigate({ to: "/council-login" });
        return;
      }
      setOfficial(session);
      setReady(true);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!ready || !isDesktop) return;
    void load();
  }, [ready, isDesktop]);

  const openCases = useMemo(() => cases.filter((c) => c.status === "open"), [cases]);
  const activeLicences = useMemo(() => licences.filter((l) => l.status === "active"), [licences]);
  const expiredLicences = useMemo(() => licences.filter((l) => l.status === "expired"), [licences]);

  const revenue: CouncilRevenueSnapshot | null = useMemo(() => {
    if (!isDesktop) return null;
    return buildCouncilRevenueSnapshot({ dogs, licences, cases });
  }, [cases, dogs, isDesktop, licences]);

  const projections = useMemo(
    () => (revenue ? buildCouncilRevenueProjections(revenue) : []),
    [revenue],
  );

  const signOut = () => {
    clearCouncilSession();
    void navigate({ to: "/council-login" });
  };

  const sendNotice = async () => {
    setNoticeBusy(true);
    try {
      const count = await broadcastCouncilNotification({ title: noticeTitle, body: noticeBody });
      toast.success(`Notice sent to ${count} accounts across the app`);
      setNoticeTitle("");
      setNoticeBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send notice");
    } finally {
      setNoticeBusy(false);
    }
  };

  const publishPost = async () => {
    setPostBusy(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: MediaType | undefined;
      if (mediaFile) {
        const uploaded = await uploadCouncilCommunityMedia(mediaFile);
        mediaUrl = uploaded.url;
        mediaType = uploaded.mediaType;
      }
      await createCouncilCommunityPost({
        body: postBody,
        tag: postTag,
        mediaUrl,
        mediaType,
        notifyAppWide: postNotify,
      });
      toast.success(postNotify ? "Community post live and app notified" : "Community post published");
      setPostBody("");
      setMediaFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish post");
    } finally {
      setPostBusy(false);
    }
  };

  if (!ready || !official) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading council portal…
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="min-h-dvh w-full bg-surface">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background pb-28">
          <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-800">Council field</p>
              <h1 className="text-xl font-extrabold text-slate-900">Animal control</h1>
            </div>
            <Logo size="sm" markOnly />
          </header>

          <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2.5 text-xs text-teal-900">
            <Monitor className="mt-0.5 size-4 shrink-0" />
            Full analytics dashboard is desktop-only — same login at `/council` on a computer.
          </div>

          {mobileTab === "scan" ? <CouncilFieldScan /> : null}
          {mobileTab === "discover" ? <CouncilDiscoverPanel /> : null}
          {mobileTab === "community" ? <CouncilCommunityPanel /> : null}
          {mobileTab === "profile" ? <CouncilProfilePanel official={official} onSignOut={signOut} /> : null}

          <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5">
            <div className="pointer-events-auto flex w-full max-w-[398px] items-center justify-between rounded-full bg-[#0f3d3a] px-2 py-2 shadow-[var(--shadow-float)]">
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

  return (
    <div className="min-h-dvh bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[240px] flex-col border-r border-white/10 bg-[#0f3d3a] text-teal-50">
        <div className="border-b border-white/10 px-4 py-4">
          <Logo size="sm" markOnly invert className="h-9" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/80">City Council</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Animal Control</h1>
          <p className="mt-1 text-xs text-teal-100/70">{official.fullName}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
          {desktopSections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                section === item.id ? "bg-white/15 text-white" : "text-teal-100/80 hover:bg-white/10 hover:text-white"
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

      {section === "map" ? (
        <main className="relative ml-[240px] h-dvh overflow-hidden bg-slate-200">
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
            <p className="font-semibold text-slate-900">Geographic distribution</p>
            <p className="mt-0.5">Teal registered · amber lost · blue found · purple impound · red incident</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="absolute right-3 top-3 z-10"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <CouncilGeoMap points={mapPoints} className="h-full min-h-0 rounded-none" />
        </main>
      ) : (
      <main className="ml-[240px] min-h-dvh px-4 py-4 lg:px-5">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
                <Building2 className="size-3.5" /> Municipal planning
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Council animal-control dashboard
              </h2>
            </div>
            {section !== "notify" && section !== "publish" && section !== "scan" && section !== "reports" ? (
              <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
            ) : null}
          </div>

          {section === "overview" && stats && revenue ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={Wallet}
                  label="Licence run-rate (annual)"
                  value={formatCouncilMoney(revenue.activeLicenceRevenueAnnual)}
                  hint={`${revenue.activeLicenceCount} active licences`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Full-compliance potential"
                  value={formatCouncilMoney(revenue.fullComplianceDogRevenueAnnual)}
                  hint={`${revenue.captureRatePct}% capture rate`}
                />
                <StatCard
                  icon={FileWarning}
                  label="Unlicensed opportunity"
                  value={formatCouncilMoney(revenue.unlicensedDogsOpportunity)}
                  hint={`${revenue.unlicensedDogCount} dogs without licence`}
                />
                <StatCard
                  icon={Wallet}
                  label="Open recoverable fees"
                  value={formatCouncilMoney(revenue.unlicensedPenaltyExposure)}
                  hint="Unlicensed dog penalties"
                />
                <StatCard icon={Dog} label="Registered dogs" value={stats.registeredDogs} hint={`${stats.registeredPets} pets total`} />
                <StatCard icon={ShieldCheck} label="Active licences" value={stats.activeLicences} />
                <StatCard icon={AlertTriangle} label="Lost / found open" value={`${stats.lostOpen} / ${stats.foundOpen}`} />
                <StatCard icon={MapPinned} label="Impounded / incidents" value={`${stats.impoundedOpen} / ${stats.incidentsOpen}`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Open animal-control cases</h3>
                  <div className="mt-3 space-y-2">
                    {openCases.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="text-xs capitalize text-slate-500">
                            {item.caseType}
                            {item.locationLabel ? ` · ${item.locationLabel}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">{item.status}</Badge>
                      </div>
                    ))}
                    {openCases.length === 0 ? (
                      <p className="text-sm text-slate-500">No open cases yet.</p>
                    ) : null}
                  </div>
                </Card>
                <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="font-semibold text-slate-900">Geographic distribution</h3>
                  </div>
                  <CouncilGeoMap points={mapPoints} className="h-[280px] rounded-none" />
                </Card>
              </div>
            </>
          ) : null}

          {section === "revenue" && revenue ? (
            <div className="space-y-4">
              <Card className="rounded-xl border-teal-200 bg-teal-50/50 p-4 shadow-sm">
                <p className="text-sm text-teal-950">
                  Figures follow the official{" "}
                  <span className="font-semibold">Harare City Council (Dog Licensing and Control) By-laws</span> —
                  USD-indexed (or local currency at the interbank rate). A valid rabies vaccination certificate is
                  required for a licence badge.
                </p>
              </Card>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={Wallet}
                  label="Active licence revenue (annual)"
                  value={formatCouncilMoney(revenue.activeLicenceRevenueAnnual)}
                  hint={`${revenue.activeLicenceCount} active`}
                />
                <StatCard
                  icon={FileWarning}
                  label="Expired licence renewals"
                  value={formatCouncilMoney(revenue.expiredLicenceRevenueAnnual)}
                  hint={`${revenue.expiredLicenceCount} expired`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Unlicensed licence opportunity"
                  value={formatCouncilMoney(revenue.unlicensedDogsOpportunity)}
                  hint={`${revenue.unlicensedDogCount} of ${revenue.registeredDogs} dogs`}
                />
                <StatCard
                  icon={ShieldCheck}
                  label="Full licence compliance"
                  value={formatCouncilMoney(revenue.fullComplianceDogRevenueAnnual)}
                  hint={`${revenue.captureRatePct}% currently captured · ${revenue.maleDogs}♂ / ${revenue.femaleDogs}♀`}
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Unlicensed penalty exposure"
                  value={formatCouncilMoney(revenue.unlicensedPenaltyExposure)}
                  hint={`@ ${formatCouncilMoney(revenue.feeSchedule.unlicensedDogPenalty)} per dog`}
                />
                <StatCard
                  icon={PawPrint}
                  label="Replacement badges"
                  value={formatCouncilMoney(revenue.feeSchedule.replacementBadge)}
                  hint="No charge under current by-laws"
                />
              </div>
              <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900">Official fee schedule</h3>
                <p className="mt-1 text-xs text-slate-500">{revenue.feeSchedule.source}</p>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Amount (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Dog (male) — annual licence</TableCell>
                      <TableCell className="text-right">{formatCouncilMoney(revenue.feeSchedule.dogMaleLicence)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Bitch (female) — annual licence</TableCell>
                      <TableCell className="text-right">{formatCouncilMoney(revenue.feeSchedule.dogFemaleLicence)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Replacement badge</TableCell>
                      <TableCell className="text-right">{formatCouncilMoney(revenue.feeSchedule.replacementBadge)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Penalty for an unlicensed dog</TableCell>
                      <TableCell className="text-right">
                        {formatCouncilMoney(revenue.feeSchedule.unlicensedDogPenalty)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </div>
          ) : null}

          {section === "projections" && revenue ? (
            <div className="space-y-4">
              <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900">Expected & proposed revenue</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Scaled from current licence performance as the user base grows. <strong>Expected</strong> = today’s
                  active licences. <strong>Growth case</strong> = midway to full dog-licence compliance.{" "}
                  <strong>Full compliance</strong> = every registered dog licensed.
                </p>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Growth case</TableHead>
                      <TableHead className="text-right">Full compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((row) => (
                      <TableRow key={row.period}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{formatCouncilMoney(row.expected)}</TableCell>
                        <TableCell className="text-right">{formatCouncilMoney(row.proposedGrowth)}</TableCell>
                        <TableCell className="text-right font-semibold text-teal-900">
                          {formatCouncilMoney(row.proposedFullCompliance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {projections.map((row) => (
                  <Card key={row.period} className="rounded-xl border-slate-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatCouncilMoney(row.expected)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Up to {formatCouncilMoney(row.proposedFullCompliance)} at full compliance
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {section === "reports" ? (
            <div className="space-y-4">
              <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900">Generate system report</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Export licences, cases, new pet registrations, and estimated revenue for a chosen period as PDF or
                  Excel.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-medium text-slate-700">
                    From
                    <Input
                      type="date"
                      className="mt-1.5"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    To
                    <Input
                      type="date"
                      className="mt-1.5"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                    />
                  </label>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <Button
                      className="bg-teal-800 hover:bg-teal-900"
                      disabled={reportBusy}
                      onClick={async () => {
                        setReportBusy(true);
                        try {
                          const report = await buildCouncilSystemReport({ from: reportFrom, to: reportTo });
                          setReportPreview(report);
                          toast.success("Report ready — download PDF or Excel");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not build report");
                        } finally {
                          setReportBusy(false);
                        }
                      }}
                    >
                      {reportBusy ? "Building…" : "Build report"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!reportPreview || reportBusy}
                      onClick={() => {
                        if (!reportPreview) return;
                        exportCouncilReportPdf(reportPreview);
                      }}
                    >
                      <FileText className="mr-2 size-4" /> PDF
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!reportPreview || reportBusy}
                      onClick={() => {
                        if (!reportPreview) return;
                        exportCouncilReportExcel(reportPreview);
                      }}
                    >
                      <FileSpreadsheet className="mr-2 size-4" /> Excel
                    </Button>
                  </div>
                </div>
              </Card>

              {reportPreview ? (
                <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900">
                    Preview · {reportPreview.period.from} → {reportPreview.period.to}
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={PawPrint} label="Pets registered" value={reportPreview.summary.petsRegisteredInPeriod} />
                    <StatCard icon={ShieldCheck} label="Licences issued" value={reportPreview.summary.licencesIssuedInPeriod} />
                    <StatCard icon={AlertTriangle} label="Cases logged" value={reportPreview.summary.casesInPeriod} />
                    <StatCard
                      icon={Wallet}
                      label="Est. revenue (period)"
                      value={formatCouncilMoney(reportPreview.summary.estimatedTotalRevenueInPeriod)}
                    />
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          {section === "licences" ? (
            <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge className="bg-teal-800">{activeLicences.length} active</Badge>
                <Badge variant="secondary">{expiredLicences.length} expired</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Licence #</TableHead>
                    <TableHead>Pet</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licences.map((licence) => (
                    <TableRow key={licence.id}>
                      <TableCell className="font-medium">{licence.licenceNumber}</TableCell>
                      <TableCell>{licence.petName ?? "—"}</TableCell>
                      <TableCell>{licence.species ?? "—"}</TableCell>
                      <TableCell>{licence.issuedAt}</TableCell>
                      <TableCell>{licence.expiresAt}</TableCell>
                      <TableCell>
                        <Badge variant={licence.status === "active" ? "default" : "secondary"}>{licence.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {licences.length === 0 ? <p className="mt-4 text-sm text-slate-500">No licences yet.</p> : null}
            </Card>
          ) : null}

          {section === "cases" ? (
            <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="capitalize">{item.caseType}</TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{item.locationLabel ?? "—"}</TableCell>
                      <TableCell>{item.reportedAt.slice(0, 10)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {cases.length === 0 ? <p className="mt-4 text-sm text-slate-500">No cases yet.</p> : null}
            </Card>
          ) : null}

          {section === "rabies" && stats ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard icon={Syringe} label="Dogs with rabies record" value={stats.rabiesRecorded} />
                <StatCard icon={AlertTriangle} label="Dogs missing rabies record" value={stats.rabiesMissing} />
              </div>
              <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900">Dogs needing rabies follow-up</h3>
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Next vaccine note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rabiesMissing.map((pet) => (
                      <TableRow key={pet.id}>
                        <TableCell className="font-medium">{pet.name}</TableCell>
                        <TableCell>{pet.breed}</TableCell>
                        <TableCell>{pet.nextVaccine || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ) : null}

          {section === "notify" ? (
            <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                  <Bell className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">App-wide notification</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Sends a notice to every VetKonnect account. Delivery uses the same notifications table and realtime
                    channel as the rest of the app (toast / inbox sync on owner and vet devices).
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <Input
                  placeholder="Title"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                />
                <textarea
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="Message body"
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  className="bg-teal-800 hover:bg-teal-900"
                  disabled={noticeBusy || !noticeTitle.trim() || !noticeBody.trim()}
                  onClick={() => void sendNotice()}
                >
                  {noticeBusy ? "Sending…" : "Send to all accounts"}
                </Button>
              </div>
            </Card>
          ) : null}

          {section === "publish" ? (
            <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                  <MessageSquarePlus className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Post to community</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Publishes as City Council into the shared community feed visible to owners, vets, and the council
                    mobile portal.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Official update for the community…"
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap gap-2">
                  {(["Story", "Education", "Rescue", "Breeding"] as const).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setPostTag(tag)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold",
                        postTag === tag ? "bg-teal-800 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={postNotify}
                    onChange={(e) => setPostNotify(e.target.checked)}
                    className="size-4 rounded border-slate-300"
                  />
                  Also send app-wide notification about this post
                </label>
                <Button
                  className="bg-teal-800 hover:bg-teal-900"
                  disabled={postBusy || !postBody.trim()}
                  onClick={() => void publishPost()}
                >
                  {postBusy ? "Publishing…" : "Publish to community"}
                </Button>
              </div>
            </Card>
          ) : null}

          {section === "scan" ? (
            <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
              <CouncilFieldScan />
            </Card>
          ) : null}
        </div>
      </main>
      )}
    </div>
  );
}
