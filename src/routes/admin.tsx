import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Bell, ClipboardList, Globe2, LogOut, PawPrint, ShieldCheck, Users, User, MessageSquare, Megaphone, CreditCard, Unplug, Layers, Pencil, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/Logo";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import {
  getAdminUsers,
  getAdminVets,
  updateAdminUser,
  deleteAdminUser,
  updateAdminVet,
  deleteAdminVet,
  unbindAdminAccount,
  setAdminVetVerified,
  getAdminPosts,
  updateAdminPost,
  deleteAdminPost,
  getAdminComments,
  deleteAdminComment,
  getAdminNotifications,
  broadcastNotification,
  deleteAdminNotification,
} from "@/services/adminService";
import { getAllPets, updatePet, deletePet } from "@/services/petService";
import { getServices, updateService, deleteService } from "@/services/contentService";
import { generateHerdTags, listHerdTags } from "@/services/herdTagService";
import type { AdminUser, AdminVet, AppNotification, CommunityComment, CommunityPost, HerdTag, Pet, ServiceListing } from "@/types";
import { useApp } from "@/hooks/useApp";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — VetKonnect" },
      { name: "description", content: "Super admin dashboard for managing vets, users, pets, and app statistics." },
      { property: "og:title", content: "Admin Dashboard — VetKonnect" },
      { property: "og:description", content: "Manage vets, users and pets while tracking app performance." },
    ],
  }),
  component: AdminDashboard,
});

const sections = [
  { id: "overview", label: "Overview", icon: Globe2 },
  { id: "users", label: "App Accounts", icon: Users },
  { id: "vets", label: "Vets", icon: User },
  { id: "pets", label: "Pets", icon: PawPrint },
  { id: "services", label: "Services", icon: ClipboardList },
  { id: "herd", label: "Tag Inventory", icon: Layers },
  { id: "community", label: "Community Posts", icon: MessageSquare },
  { id: "notice", label: "Notice Board", icon: Megaphone },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "accounts", label: "Device Security", icon: Unplug },
] as const;

type AdminSection = (typeof sections)[number]["id"];

type EditableRow =
  | { section: "users"; item: AdminUser }
  | { section: "vets"; item: AdminVet }
  | { section: "pets"; item: Pet }
  | { section: "services"; item: ServiceListing }
  | { section: "community"; item: CommunityPost };

function AdminDashboard() {
  const navigate = useNavigate();
  const { ready, user, signOut } = useApp();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vets, setVets] = useState<AdminVet[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [herdTags, setHerdTags] = useState<HerdTag[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [postComments, setPostComments] = useState<CommunityComment[]>([]);
  const [search, setSearch] = useState("");
  const [tagType, setTagType] = useState<HerdTag["type"]>("Collar ID");
  const [tagPrefix, setTagPrefix] = useState("VC");
  const [tagQuantity, setTagQuantity] = useState(3);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<EditableRow | null>(null);
  const [viewingRow, setViewingRow] = useState<EditableRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<EditableRow | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const pageSize = 5;

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!user.isAdmin) {
      void navigate({ to: "/admin-login" });
    }
  }, [navigate, ready, user.isAdmin]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        const [usersData, vetsData, petsData, servicesData, herdTagsData, postsData, notificationsData] = await Promise.all([
          getAdminUsers(),
          getAdminVets(),
          getAllPets(),
          getServices(),
          listHerdTags(),
          getAdminPosts(),
          getAdminNotifications(),
        ]);

        if (cancelled) return;
        setUsers(usersData);
        setVets(vetsData);
        setPets(petsData);
        setServices(servicesData);
        setHerdTags(herdTagsData);
        setPosts(postsData);
        setNotifications(notificationsData);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load admin data");
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalUsers = users.length;
  const totalVets = vets.length;
  const totalPets = pets.length;
  const totalServices = services.length;
  const totalPosts = posts.length;
  const onboardedUsers = users.filter((u) => u.onboarded).length;
  const boundAccounts = users.filter((u) => Boolean(u.boundDeviceId)).length;
  const activeVets = vets.filter((v) => v.status === "Active").length;

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/admin-login" });
  };

  useEffect(() => {
    setPage(1);
  }, [activeSection, search]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? users.filter((item) =>
          [item.fullName, item.phone, item.country, item.boundDeviceId ?? ""].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : users;
  }, [search, users]);

  const filteredVets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? vets.filter((item) =>
          [item.name, item.surgery, item.location, item.phone].some((value) => value.toLowerCase().includes(query)),
        )
      : vets;
  }, [search, vets]);

  const filteredPets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? pets.filter((item) =>
          [item.name, item.species, item.breed, item.vetConnectId, item.ownerId ?? ""].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : pets;
  }, [search, pets]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? services.filter((item) =>
          [item.name, item.category, item.address].some((value) => value.toLowerCase().includes(query)),
        )
      : services;
  }, [search, services]);

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? posts.filter((item) =>
          [item.author, item.body, item.tag, item.location].some((value) => value.toLowerCase().includes(query)),
        )
      : posts;
  }, [search, posts]);

  const sectionItems = useMemo(() => {
    switch (activeSection) {
      case "users":
      case "accounts":
        return filteredUsers;
      case "vets":
        return filteredVets;
      case "pets":
        return filteredPets;
      case "services":
        return filteredServices;
      case "community":
        return filteredPosts;
      default:
        return [];
    }
  }, [activeSection, filteredUsers, filteredVets, filteredPets, filteredServices, filteredPosts]);

  const pageCount = Math.max(1, Math.ceil(sectionItems.length / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page]);

  const pagedVets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVets.slice(start, start + pageSize);
  }, [filteredVets, page]);

  const pagedPets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPets.slice(start, start + pageSize);
  }, [filteredPets, page]);

  const pagedServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, page]);

  const pagedPosts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, page]);

  const startEdit = (row: EditableRow) => {
    setEditingRow(row);
    setFormValues({ ...row.item });
    setEditDialogOpen(true);
  };

  const startDelete = (row: EditableRow) => {
    setDeletingRow(row);
    setDeleteDialogOpen(true);
  };

  const startView = async (row: EditableRow) => {
    setViewingRow(row);
    setViewDialogOpen(true);
    if (row.section === "community") {
      try {
        setPostComments(await getAdminComments(row.item.id));
      } catch (error) {
        console.error(error);
        setPostComments([]);
      }
    } else {
      setPostComments([]);
    }
  };

  const handleFormChange = (key: string, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!editingRow) return;
    setIsSaving(true);

    try {
      if (editingRow.section === "users") {
        const updated = await updateAdminUser(editingRow.item.id, {
          fullName: String(formValues.fullName ?? editingRow.item.fullName),
          phone: String(formValues.phone ?? editingRow.item.phone),
          country: String(formValues.country ?? editingRow.item.country),
          onboarded: Boolean(formValues.onboarded ?? editingRow.item.onboarded),
          vetSureMember: Boolean(formValues.vetSureMember ?? editingRow.item.vetSureMember),
          notificationsEnabled: Boolean(formValues.notificationsEnabled ?? editingRow.item.notificationsEnabled !== false),
          isAdmin: Boolean(formValues.isAdmin ?? editingRow.item.isAdmin),
          accountType: formValues.accountType === "vet" ? "vet" : "owner",
          vetVerified: Boolean(formValues.vetVerified ?? editingRow.item.vetVerified),
          practiceName: String(formValues.practiceName ?? editingRow.item.practiceName ?? ""),
          patientsServed: Number(formValues.patientsServed ?? editingRow.item.patientsServed ?? 0),
          pets: editingRow.item.pets,
        });
        if (updated) {
          setUsers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated, pets: item.pets, petIds: item.petIds } : item)));
        }
      }

      if (editingRow.section === "vets") {
        const updated = await updateAdminVet(editingRow.item.id, {
          name: String(formValues.name ?? editingRow.item.name),
          surgery: String(formValues.surgery ?? editingRow.item.surgery),
          location: String(formValues.location ?? editingRow.item.location),
          phone: String(formValues.phone ?? editingRow.item.phone),
          status: String(formValues.status ?? editingRow.item.status) as AdminVet["status"],
        });
        if (updated) {
          setVets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      }

      if (editingRow.section === "pets") {
        const updated = await updatePet(editingRow.item.id, {
          name: String(formValues.name ?? editingRow.item.name),
          breed: String(formValues.breed ?? editingRow.item.breed),
          species: String(formValues.species ?? editingRow.item.species) as Pet["species"],
          healthStatus: String(formValues.healthStatus ?? editingRow.item.healthStatus) as Pet["healthStatus"],
          vetSure: Boolean(formValues.vetSure ?? editingRow.item.vetSure),
        });
        if (updated) {
          setPets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      }

      if (editingRow.section === "services") {
        const updated = await updateService(editingRow.item.id, {
          name: String(formValues.name ?? editingRow.item.name),
          category: String(formValues.category ?? editingRow.item.category) as ServiceListing["category"],
          rating: Number(formValues.rating ?? editingRow.item.rating),
          address: String(formValues.address ?? editingRow.item.address),
          latitude: Number(formValues.latitude ?? editingRow.item.latitude),
          longitude: Number(formValues.longitude ?? editingRow.item.longitude),
          open: Boolean(formValues.open ?? editingRow.item.open),
        });
        if (updated) {
          setServices((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      }

      if (editingRow.section === "community") {
        const updated = await updateAdminPost(editingRow.item.id, {
          author: String(formValues.author ?? editingRow.item.author),
          body: String(formValues.body ?? editingRow.item.body),
          location: String(formValues.location ?? editingRow.item.location),
          tag: String(formValues.tag ?? editingRow.item.tag) as CommunityPost["tag"],
        });
        if (updated) {
          setPosts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      }

      toast.success("Changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setIsSaving(false);
      setEditDialogOpen(false);
      setEditingRow(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingRow) return;
    setIsSaving(true);

    try {
      if (deletingRow.section === "users") {
        await deleteAdminUser(deletingRow.item.id);
        setUsers((prev) => prev.filter((item) => item.id !== deletingRow.item.id));
      }
      if (deletingRow.section === "vets") {
        await deleteAdminVet(deletingRow.item.id);
        setVets((prev) => prev.filter((item) => item.id !== deletingRow.item.id));
      }
      if (deletingRow.section === "pets") {
        await deletePet(deletingRow.item.id);
        setPets((prev) => prev.filter((item) => item.id !== deletingRow.item.id));
      }
      if (deletingRow.section === "services") {
        await deleteService(deletingRow.item.id);
        setServices((prev) => prev.filter((item) => item.id !== deletingRow.item.id));
      }
      if (deletingRow.section === "community") {
        await deleteAdminPost(deletingRow.item.id);
        setPosts((prev) => prev.filter((item) => item.id !== deletingRow.item.id));
      }
      toast.success("Record deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete record");
    } finally {
      setIsSaving(false);
      setDeleteDialogOpen(false);
      setDeletingRow(null);
    }
  };

  const handleUnbind = async (account: AdminUser) => {
    try {
      const updated = await unbindAdminAccount(account.id);
      if (updated) {
        setUsers((prev) =>
          prev.map((item) =>
            item.id === account.id ? { ...item, boundDeviceId: null, deviceBoundAt: null } : item,
          ),
        );
        toast.success(`Unbound ${account.fullName || account.phone}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unbind device");
    }
  };

  const handleVerifyVet = async (account: AdminUser, verified: boolean) => {
    try {
      const updated = await setAdminVetVerified(account.id, verified);
      if (updated) {
        setUsers((prev) => prev.map((item) => (item.id === account.id ? { ...item, ...updated, pets: item.pets, petIds: item.petIds } : item)));
        toast.success(verified ? `Verified ${account.fullName || account.phone}` : `Unverified ${account.fullName || account.phone}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update vet verification");
    }
  };

  const handleBroadcast = async () => {
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      toast.error("Add a title and message");
      return;
    }
    setNoticeBusy(true);
    try {
      const count = await broadcastNotification({
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        type: "notice",
      });
      setNotifications(await getAdminNotifications());
      setNoticeTitle("");
      setNoticeBody("");
      toast.success(`Notice sent to ${count} accounts`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send notice");
    } finally {
      setNoticeBusy(false);
    }
  };

  const handleGenerateTags = async () => {
    setIsGeneratingTags(true);

    try {
      const generated = await generateHerdTags({
        type: tagType,
        prefix: tagPrefix,
        quantity: tagQuantity,
      });

      setHerdTags((prev) => [...generated, ...prev].slice(0, 200));
      toast.success(`Generated ${generated.length} tags`);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-100">
      <aside className="fixed left-0 top-0 z-10 h-screen w-[280px] overflow-hidden border-r border-slate-200 bg-white shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex-shrink-0 p-5">
            <div className="mb-4">
              <Logo size="md" hideSubtitle className="h-12" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">Control Center</p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Admin tools</h2>
              <p className="text-sm leading-5 text-muted-foreground">Manage accounts, community, devices and services.</p>
            </div>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 pt-3 scrollbar-thin scrollbar-thumb-slate-300/50">
            <div className="space-y-2">
              {sections.map((section) => (
                <SidebarNavItem
                  key={section.id}
                  icon={section.icon}
                  label={section.label}
                  active={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </div>
          </nav>

          <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-4">
            <Button variant="secondary" size="sm" className="w-full justify-center" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </Button>
            <p className="mt-3 text-xs leading-4 text-muted-foreground">Sidebar footer stays fixed while menu items scroll.</p>
          </div>
        </div>
      </aside>

      <main className="ml-[280px] min-h-screen px-6 py-10 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
          {activeSection === "overview" ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                      Admin
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">VetKonnect Control Center</h1>
                      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        A clean admin experience focused on the selected section.
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="h-10" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard icon={Users} label="App Accounts" value={totalUsers} />
                <StatCard icon={User} label="Onboarded" value={onboardedUsers} />
                <StatCard icon={Unplug} label="Device Bound" value={boundAccounts} />
                <StatCard icon={ShieldCheck} label="Active Vets" value={activeVets} />
                <StatCard icon={PawPrint} label="Total Pets" value={totalPets} />
                <StatCard icon={MessageSquare} label="Community Posts" value={totalPosts} />
                <StatCard icon={Globe2} label="Services Listed" value={totalServices} />
                <StatCard icon={Bell} label="Notifications" value={notifications.length} />
                <StatCard icon={BarChart3} label="Tags Issued" value={herdTags.length} />
              </div>

              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Overview</p>
                    <h2 className="text-xl font-bold">Recent accounts</h2>
                  </div>
                  <Button variant="secondary" className="h-10" onClick={() => setActiveSection("users")}>
                    View all
                  </Button>
                </div>
                <div className="space-y-3">
                  {users.slice(0, 3).map((adminUser) => (
                    <div key={adminUser.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                      <div>
                        <p className="font-semibold">{adminUser.fullName || "Unnamed account"}</p>
                        <p className="text-sm text-muted-foreground">{adminUser.phone} · {adminUser.country}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{adminUser.pets} pets</p>
                        <p className="text-xs text-muted-foreground">
                          {adminUser.accountType === "vet"
                            ? adminUser.vetVerified
                              ? "Vet · Verified"
                              : "Vet · Pending"
                            : adminUser.boundDeviceId
                              ? "Device bound"
                              : "Unbound"}{" "}
                          · {adminUser.onboarded ? "Onboarded" : "Pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No app accounts yet. New logins will appear here.</p>
                  ) : null}
                </div>
              </Card>
            </>
          ) : activeSection !== "herd" && activeSection !== "notice" && activeSection !== "billing" ? (
            <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">{activeSection}</p>
                  <h2 className="text-2xl font-bold text-foreground">
                    {sections.find((section) => section.id === activeSection)?.label}
                  </h2>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-sm text-muted-foreground">{sectionItems.length} total</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSection === "users" || activeSection === "accounts" ? (
                      <>
                        <Badge variant="secondary">{onboardedUsers} onboarded</Badge>
                        <Badge>{boundAccounts} bound</Badge>
                      </>
                    ) : activeSection === "vets" ? (
                      <>
                        <Badge>{activeVets} active</Badge>
                        <Badge variant="secondary">{totalVets - activeVets} inactive</Badge>
                      </>
                    ) : activeSection === "pets" ? (
                      <>
                        <Badge>{pets.filter((pet) => pet.healthStatus === "Healthy").length} healthy</Badge>
                        <Badge variant="secondary">{pets.filter((pet) => pet.healthStatus === "Attention").length} attention</Badge>
                      </>
                    ) : activeSection === "community" ? (
                      <>
                        <Badge>{posts.reduce((sum, post) => sum + post.likes, 0)} likes</Badge>
                        <Badge variant="secondary">{posts.reduce((sum, post) => sum + post.comments, 0)} comments</Badge>
                      </>
                    ) : (
                      <>
                        <Badge>{services.filter((svc) => svc.open).length} open</Badge>
                        <Badge variant="secondary">{services.filter((svc) => !svc.open).length} closed</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
          {activeSection === "herd" ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Generate inventory</p>
                  <h3 className="text-xl font-bold text-foreground">Create collar IDs and pet tags</h3>
                  <p className="text-sm text-muted-foreground">
                    Issue pre-generated identification codes with QR payloads for dogs, cats, and other pets.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span>Type</span>
                    <select value={tagType} onChange={(event) => setTagType(event.target.value as HerdTag["type"])} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="Collar ID">Collar ID</option>
                      <option value="Pet Tag">Pet Tag</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span>Prefix</span>
                    <Input value={tagPrefix} onChange={(event) => setTagPrefix(event.target.value)} placeholder="VC" />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span>Quantity</span>
                    <Input type="number" min="1" max="50" value={tagQuantity} onChange={(event) => setTagQuantity(Number(event.target.value))} />
                  </label>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={() => void handleGenerateTags()} disabled={isGeneratingTags}>
                      {isGeneratingTags ? "Generating..." : "Generate tags"}
                    </Button>
                  </div>
                </div>
              </Card>
              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Inventory</p>
                    <h3 className="text-xl font-bold text-foreground">Latest generated codes</h3>
                  </div>
                  <Badge>{herdTags.length} tags</Badge>
                </div>
                <div className="space-y-3">
                  {herdTags.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                      No inventory yet. Generate your first batch to populate this panel.
                    </div>
                  ) : (
                    herdTags.slice(0, 6).map((tag) => (
                      <div key={tag.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{tag.code}</p>
                          <p className="text-sm text-muted-foreground">{tag.type} · {tag.prefix}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <img src={tag.qrDataUrl} alt={tag.code} className="h-16 w-16 rounded-lg border border-slate-200 bg-white p-1" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          {activeSection === "notice" ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Broadcast</p>
                  <h3 className="text-xl font-bold">Send a notice to all accounts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Creates in-app notifications for every VetKonnect account.</p>
                </div>
                <Input placeholder="Notice title" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} />
                <textarea value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="Write the notice message…" className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button onClick={() => void handleBroadcast()} disabled={noticeBusy}>{noticeBusy ? "Sending…" : "Send to all accounts"}</Button>
              </Card>
              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Recent notifications</h3>
                  <Badge>{notifications.length}</Badge>
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto">
                  {notifications.slice(0, 30).map((note) => (
                    <div key={note.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="font-semibold">{note.title}</p>
                        <p className="text-sm text-muted-foreground">{note.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={async () => { await deleteAdminNotification(note.id); setNotifications((prev) => prev.filter((item) => item.id !== note.id)); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {notifications.length === 0 ? <p className="text-sm text-muted-foreground">No notifications yet.</p> : null}
                </div>
              </Card>
            </div>
          ) : null}

          {activeSection === "billing" ? (
            <Card className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">Billing</h3>
              <p className="mt-2 text-sm text-muted-foreground">Live membership status is managed on each app account. VetSure counts are shown below.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="VetSure members" value={users.filter((u) => u.vetSureMember).length} />
                <Metric label="Onboarded accounts" value={onboardedUsers} />
                <Metric label="Total accounts" value={totalUsers} />
              </div>
            </Card>
          ) : null}

          {activeSection === "users" || activeSection === "accounts" || activeSection === "vets" || activeSection === "pets" || activeSection === "services" || activeSection === "community" ? (
            <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground">Search</p>
                  <Input placeholder="Filter by name, phone, device, category or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Showing {activeSection === "users" || activeSection === "accounts" ? pagedUsers.length : activeSection === "vets" ? pagedVets.length : activeSection === "pets" ? pagedPets.length : activeSection === "community" ? pagedPosts.length : pagedServices.length} of {sectionItems.length}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {(activeSection === "users" || activeSection === "accounts") && (<><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Phone</TableHead><TableHead>Pets</TableHead><TableHead>Device</TableHead><TableHead>Status</TableHead></>)}
                    {activeSection === "vets" && (<><TableHead>Name</TableHead><TableHead>Surgery</TableHead><TableHead>Location</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></>)}
                    {activeSection === "pets" && (<><TableHead>Name</TableHead><TableHead>Breed</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>VetSure</TableHead></>)}
                    {activeSection === "services" && (<><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Rating</TableHead><TableHead>Distance</TableHead><TableHead>Open</TableHead></>)}
                    {activeSection === "community" && (<><TableHead>Author</TableHead><TableHead>Tag</TableHead><TableHead>Body</TableHead><TableHead>Likes</TableHead><TableHead>Comments</TableHead></>)}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activeSection === "users" || activeSection === "accounts") && pagedUsers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.fullName || "—"}</TableCell>
                      <TableCell>
                        {item.accountType === "vet" ? (
                          <Badge variant={item.vetVerified ? "default" : "secondary"}>
                            {item.vetVerified ? "Vet · Verified" : "Vet · Pending"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Owner</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.phone}</TableCell>
                      <TableCell>{item.pets}</TableCell>
                      <TableCell><Badge variant={item.boundDeviceId ? "default" : "secondary"}>{item.boundDeviceId ? "Bound" : "Unbound"}</Badge></TableCell>
                      <TableCell><Badge variant={item.onboarded ? "default" : "secondary"}>{item.onboarded ? "Onboarded" : "Pending"}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void startView({ section: "users", item })}><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "users", item })}><Pencil className="h-4 w-4" /> Edit</Button>
                        {item.accountType === "vet" ? (
                          <Button
                            variant={item.vetVerified ? "outline" : "default"}
                            size="sm"
                            onClick={() => void handleVerifyVet(item, !item.vetVerified)}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {item.vetVerified ? "Unverify" : "Verify vet"}
                          </Button>
                        ) : null}
                        {item.boundDeviceId ? <Button variant="outline" size="sm" onClick={() => void handleUnbind(item)}><Unplug className="h-4 w-4" /> Unbind</Button> : null}
                        <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "users", item })}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeSection === "vets" && pagedVets.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.surgery}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.phone}</TableCell>
                      <TableCell><Badge variant={item.status === "Active" ? "default" : "secondary"}>{item.status}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void startView({ section: "vets", item })}><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "vets", item })}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "vets", item })}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeSection === "pets" && pagedPets.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.breed}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{item.ownerId ?? "—"}</TableCell>
                      <TableCell>{item.healthStatus}</TableCell>
                      <TableCell>{item.vetSure ? "Yes" : "No"}</TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void startView({ section: "pets", item })}><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "pets", item })}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "pets", item })}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeSection === "services" && pagedServices.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.rating.toFixed(1)}</TableCell>
                      <TableCell>{item.distanceKm} km</TableCell>
                      <TableCell><Badge variant={item.open ? "default" : "secondary"}>{item.open ? "Open" : "Closed"}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void startView({ section: "services", item })}><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "services", item })}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "services", item })}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {activeSection === "community" && pagedPosts.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.author}</TableCell>
                      <TableCell><Badge variant="secondary">{item.tag}</Badge></TableCell>
                      <TableCell className="max-w-[240px] truncate">{item.body}</TableCell>
                      <TableCell>{item.likes}</TableCell>
                      <TableCell>{item.comments}</TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void startView({ section: "community", item })}><Eye className="h-4 w-4" /> View</Button>
                        <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "community", item })}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "community", item })}><Trash2 className="h-4 w-4" /> Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem><PaginationPrevious onClick={() => setPage((prev) => Math.max(prev - 1, 1))} /></PaginationItem>
                  {Array.from({ length: pageCount }, (_, index) => (
                    <PaginationItem key={index}><PaginationLink onClick={() => setPage(index + 1)} isActive={page === index + 1}>{index + 1}</PaginationLink></PaginationItem>
                  ))}
                  <PaginationItem><PaginationNext onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </Card>
          ) : null}
        </div>
      </main>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingRow?.section === "users" && "App account"}
              {viewingRow?.section === "vets" && "Vet profile"}
              {viewingRow?.section === "pets" && "Pet profile"}
              {viewingRow?.section === "services" && "Service profile"}
              {viewingRow?.section === "community" && "Community post"}
            </DialogTitle>
            <DialogDescription>View the complete record details and related information.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {viewingRow?.section === "users" && (() => {
              const account = viewingRow.item as AdminUser;
              const linkedPets = pets.filter((pet) => pet.ownerId === account.id || account.petIds?.includes(pet.id));
              return (
                <>
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-semibold">{account.fullName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-semibold">{account.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Country code</p>
                      <p className="font-semibold">{account.country}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Member since</p>
                      <p className="font-semibold">{account.memberSince ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Device binding</p>
                      <p className="font-semibold">{account.boundDeviceId ? "Bound" : "Unbound"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Notifications</p>
                      <p className="font-semibold">{account.notificationsEnabled === false ? "Off" : "On"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">VetSure</p>
                      <p className="font-semibold">{account.vetSureMember ? "Member" : "Not enrolled"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Modules</p>
                      <p className="font-semibold">{account.modules?.length ? account.modules.join(", ") : "None"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account type</p>
                      <p className="font-semibold">{account.accountType === "vet" ? "Vet" : "Owner"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vet verification</p>
                      <p className="font-semibold">
                        {account.accountType === "vet" ? (account.vetVerified ? "Verified" : "Pending verification") : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Practice</p>
                      <p className="font-semibold">{account.practiceName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Patients served</p>
                      <p className="font-semibold">{account.patientsServed ?? 0}</p>
                    </div>
                  </div>

                  {account.accountType === "vet" ? (
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="mb-2 text-sm font-semibold">Practice access</p>
                      <p className="text-sm text-muted-foreground">
                        Patients and Impact tabs stay locked until this vet is verified.
                      </p>
                      <Button
                        className="mt-3"
                        variant={account.vetVerified ? "outline" : "default"}
                        size="sm"
                        onClick={() => void handleVerifyVet(account, !account.vetVerified)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {account.vetVerified ? "Revoke verification" : "Verify vet account"}
                      </Button>
                    </div>
                  ) : null}

                  {account.boundDeviceId ? (
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="mb-2 text-sm font-semibold">Bound device ID</p>
                      <p className="break-all text-sm text-muted-foreground">{account.boundDeviceId}</p>
                      {account.deviceBoundAt ? (
                        <p className="mt-2 text-xs text-muted-foreground">Bound at {new Date(account.deviceBoundAt).toLocaleString()}</p>
                      ) : null}
                      <Button className="mt-3" variant="outline" size="sm" onClick={() => void handleUnbind(account)}>
                        <Unplug className="mr-2 h-4 w-4" /> Force unbind
                      </Button>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-2 text-sm font-semibold">Pets under this account</p>
                    {linkedPets.length ? (
                      <div className="space-y-3">
                        {linkedPets.map((pet) => (
                          <div key={pet.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold">{pet.name}</p>
                                <p className="text-sm text-muted-foreground">{pet.species} · {pet.breed}</p>
                              </div>
                              <Badge variant="secondary">{pet.healthStatus}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No linked pets yet.</p>
                    )}
                  </div>
                </>
              );
            })()}

            {viewingRow?.section === "vets" && (() => {
              const vet = viewingRow.item as AdminVet;
              return (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold">{vet.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Surgery</p>
                    <p className="font-semibold">{vet.surgery}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold">{vet.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-semibold">{vet.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold">{vet.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="font-semibold">{vet.rating.toFixed(1)}</p>
                  </div>
                </div>
              );
            })()}

            {viewingRow?.section === "pets" && (() => {
              const pet = viewingRow.item as Pet;
              return (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{pet.name}</p>
                      <p className="text-sm text-muted-foreground">{pet.species} · {pet.breed}</p>
                    </div>
                    <Badge>{pet.healthStatus}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">VetKonnect ID</p>
                      <p className="font-semibold">{pet.vetConnectId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Collar / Tag ID</p>
                      <p className="font-semibold">{pet.collarId ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next vaccine</p>
                      <p className="font-semibold">{pet.nextVaccine}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Medication</p>
                      <p className="font-semibold">{pet.medicationToday}</p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Pet history</p>
                    <div className="space-y-2">
                      {pet.timeline.map((event) => (
                        <div key={event.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-muted-foreground">{event.date} · {event.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {viewingRow?.section === "services" && (() => {
              const service = viewingRow.item as ServiceListing;
              return (
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold">{service.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-semibold">{service.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-semibold">{service.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Coordinates</p>
                    <p className="font-semibold">{service.latitude.toFixed(4)}, {service.longitude.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="font-semibold">{service.rating.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current status</p>
                    <p className="font-semibold">{service.open ? "Open now" : "Closed"}</p>
                  </div>
                </div>
              );
            })()}

            {viewingRow?.section === "community" && (() => {
              const post = viewingRow.item as CommunityPost;
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{post.author}</p>
                        <p className="text-sm text-muted-foreground">{post.location} · {post.timeAgo || post.createdAt}</p>
                      </div>
                      <Badge>{post.tag}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed">{post.body}</p>
                    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                      <span>{post.likes} likes</span>
                      <span>{post.comments} comments</span>
                      <span>{post.mediaType || "none"}</span>
                    </div>
                    {post.imageUrl ? <img src={post.imageUrl} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover" /> : null}
                    {post.videoUrl ? <video src={post.videoUrl} controls className="mt-3 max-h-56 w-full rounded-xl bg-black" /> : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 text-sm font-semibold">Comments</p>
                    <div className="space-y-2">
                      {postComments.map((comment) => (
                        <div key={comment.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold">{comment.authorName}</p>
                            <p className="text-sm text-muted-foreground">{comment.body}</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              await deleteAdminComment(comment.id, post.id);
                              setPostComments((prev) => prev.filter((c) => c.id !== comment.id));
                              setPosts((prev) =>
                                prev.map((p) => (p.id === post.id ? { ...p, comments: Math.max(0, p.comments - 1) } : p)),
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {postComments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRow ? `Edit ${editingRow.section.slice(0, -1)}` : "Edit item"}</DialogTitle>
            <DialogDescription>Update the selected record and save changes.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {editingRow?.section === "users" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Name</span>
                  <Input value={String(formValues.fullName ?? "")} onChange={(event) => handleFormChange("fullName", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Phone</span>
                  <Input value={String(formValues.phone ?? "")} onChange={(event) => handleFormChange("phone", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Country code</span>
                  <Input value={String(formValues.country ?? "")} onChange={(event) => handleFormChange("country", event.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(formValues.onboarded)} onChange={(event) => handleFormChange("onboarded", event.target.checked)} className="h-4 w-4 rounded border border-input" />
                  Onboarded
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(formValues.vetSureMember)} onChange={(event) => handleFormChange("vetSureMember", event.target.checked)} className="h-4 w-4 rounded border border-input" />
                  VetSure member
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formValues.notificationsEnabled !== false} onChange={(event) => handleFormChange("notificationsEnabled", event.target.checked)} className="h-4 w-4 rounded border border-input" />
                  Notifications enabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(formValues.isAdmin)} onChange={(event) => handleFormChange("isAdmin", event.target.checked)} className="h-4 w-4 rounded border border-input" />
                  Admin flag
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formValues.accountType === "vet"}
                    onChange={(event) => handleFormChange("accountType", event.target.checked ? "vet" : "owner")}
                    className="h-4 w-4 rounded border border-input"
                  />
                  Vet account
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(formValues.vetVerified)} onChange={(event) => handleFormChange("vetVerified", event.target.checked)} className="h-4 w-4 rounded border border-input" />
                  Vet verified (unlock Patients & Impact)
                </label>
                <label className="grid gap-2 text-sm">
                  Practice name
                  <Input value={String(formValues.practiceName ?? "")} onChange={(event) => handleFormChange("practiceName", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  Patients served
                  <Input type="number" value={Number(formValues.patientsServed ?? 0)} onChange={(event) => handleFormChange("patientsServed", Number(event.target.value))} />
                </label>
              </>
            )}

            {editingRow?.section === "vets" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Name</span>
                  <Input value={String(formValues.name ?? "")} onChange={(event) => handleFormChange("name", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Surgery</span>
                  <Input value={String(formValues.surgery ?? "")} onChange={(event) => handleFormChange("surgery", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Location</span>
                  <Input value={String(formValues.location ?? "")} onChange={(event) => handleFormChange("location", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Phone</span>
                  <Input value={String(formValues.phone ?? "")} onChange={(event) => handleFormChange("phone", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Status</span>
                  <select
                    value={String(formValues.status ?? "Active")}
                    onChange={(event) => handleFormChange("status", event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
              </>
            )}

            {editingRow?.section === "pets" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Name</span>
                  <Input value={String(formValues.name ?? "")} onChange={(event) => handleFormChange("name", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Breed</span>
                  <Input value={String(formValues.breed ?? "")} onChange={(event) => handleFormChange("breed", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Species</span>
                  <Input value={String(formValues.species ?? "")} onChange={(event) => handleFormChange("species", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Health Status</span>
                  <Input value={String(formValues.healthStatus ?? "")} onChange={(event) => handleFormChange("healthStatus", event.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.vetSure)}
                    onChange={(event) => handleFormChange("vetSure", event.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-ring"
                  />
                  VetSure enrolled
                </label>
              </>
            )}

            {editingRow?.section === "services" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Name</span>
                  <Input value={String(formValues.name ?? "")} onChange={(event) => handleFormChange("name", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Category</span>
                  <Input value={String(formValues.category ?? "")} onChange={(event) => handleFormChange("category", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Rating</span>
                  <Input type="number" step="0.1" value={Number(formValues.rating ?? 0)} onChange={(event) => handleFormChange("rating", Number(event.target.value))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Address</span>
                  <Input value={String(formValues.address ?? "")} onChange={(event) => handleFormChange("address", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Latitude</span>
                  <Input type="number" step="0.0001" value={Number(formValues.latitude ?? 0)} onChange={(event) => handleFormChange("latitude", Number(event.target.value))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Longitude</span>
                  <Input type="number" step="0.0001" value={Number(formValues.longitude ?? 0)} onChange={(event) => handleFormChange("longitude", Number(event.target.value))} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.open)}
                    onChange={(event) => handleFormChange("open", event.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-ring"
                  />
                  Open now
                </label>
              </>
            )}

            {editingRow?.section === "community" && (
              <>
                <label className="grid gap-2 text-sm">
                  <span>Author</span>
                  <Input value={String(formValues.author ?? "")} onChange={(event) => handleFormChange("author", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Location</span>
                  <Input value={String(formValues.location ?? "")} onChange={(event) => handleFormChange("location", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Tag</span>
                  <select
                    value={String(formValues.tag ?? "Story")}
                    onChange={(event) => handleFormChange("tag", event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="Story">Story</option>
                    <option value="Education">Education</option>
                    <option value="Rescue">Rescue</option>
                    <option value="Breeding">Breeding</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Body</span>
                  <textarea
                    value={String(formValues.body ?? "")}
                    onChange={(event) => handleFormChange("body", event.target.value)}
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deletingRow?.section.slice(0, -1)}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SidebarNavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof BarChart3;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent bg-transparent text-slate-800 hover:bg-slate-50"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/10 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: number }) {
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-100 p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
