import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, Globe2, LogOut, PawPrint, ShieldCheck, Users, User, MessageSquare, Megaphone, CreditCard, Wallet, Layers, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/Logo";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { getAdminUsers, getAdminVets, updateAdminUser, deleteAdminUser, updateAdminVet, deleteAdminVet } from "@/services/adminService";
import { getPets, updatePet, deletePet } from "@/services/petService";
import { getServices, updateService, deleteService } from "@/services/contentService";
import type { AdminUser, AdminVet, Pet, ServiceListing } from "@/types";
import { useApp } from "@/hooks/useApp";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — VetConnect" },
      { name: "description", content: "Super admin dashboard for managing vets, users, pets, and app statistics." },
      { property: "og:title", content: "Admin Dashboard — VetConnect" },
      { property: "og:description", content: "Manage vets, users and pets while tracking app performance." },
    ],
  }),
  component: AdminDashboard,
});

const sections = [
  { id: "overview", label: "Overview", icon: Globe2 },
  { id: "users", label: "Users", icon: Users },
  { id: "vets", label: "Vets", icon: User },
  { id: "pets", label: "Pets", icon: PawPrint },
  { id: "services", label: "Services", icon: ClipboardList },
  { id: "herd", label: "Herd Management", icon: Layers },
  { id: "community", label: "Community Posts", icon: MessageSquare },
  { id: "notice", label: "Notice Board", icon: Megaphone },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "accounts", label: "Accounts", icon: Wallet },
] as const;

type AdminSection = (typeof sections)[number]["id"];

type EditableSection = "users" | "vets" | "pets" | "services";

type EditableRow =
  | { section: "users"; item: AdminUser }
  | { section: "vets"; item: AdminVet }
  | { section: "pets"; item: Pet }
  | { section: "services"; item: ServiceListing };

function AdminDashboard() {
  const navigate = useNavigate();
  const { ready, user, signOut } = useApp();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vets, setVets] = useState<AdminVet[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<EditableRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<EditableRow | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
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
      const [usersData, vetsData, petsData, servicesData] = await Promise.all([
        getAdminUsers(),
        getAdminVets(),
        getPets(),
        getServices(),
      ]);

      if (cancelled) return;
      setUsers(usersData);
      setVets(vetsData);
      setPets(petsData);
      setServices(servicesData);
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
  const onboardedUsers = users.filter((u) => u.onboarded).length;
  const activeVets = vets.filter((v) => v.status === "Active").length;

  const handleSignOut = () => {
    signOut();
    void navigate({ to: "/admin-login" });
  };

  useEffect(() => {
    setPage(1);
  }, [activeSection, search]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? users.filter((item) =>
          [item.fullName, item.phone, item.country].some((value) => value.toLowerCase().includes(query)),
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
          [item.name, item.species, item.breed, item.vetConnectId].some((value) => value.toLowerCase().includes(query)),
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

  const sectionItems = useMemo(() => {
    switch (activeSection) {
      case "users":
        return filteredUsers;
      case "vets":
        return filteredVets;
      case "pets":
        return filteredPets;
      case "services":
        return filteredServices;
      default:
        return [];
    }
  }, [activeSection, filteredUsers, filteredVets, filteredPets, filteredServices]);

  const pageCount = Math.max(1, Math.ceil(sectionItems.length / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sectionItems.slice(start, start + pageSize);
  }, [sectionItems, page]);

  const startEdit = (row: EditableRow) => {
    setEditingRow(row);
    setFormValues({ ...row.item });
    setEditDialogOpen(true);
  };

  const startDelete = (row: EditableRow) => {
    setDeletingRow(row);
    setDeleteDialogOpen(true);
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
          pets: Number(formValues.pets ?? editingRow.item.pets),
          onboarded: Boolean(formValues.onboarded ?? editingRow.item.onboarded),
        });
        if (updated) {
          setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
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
          open: Boolean(formValues.open ?? editingRow.item.open),
        });
        if (updated) {
          setServices((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      }
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
    } finally {
      setIsSaving(false);
      setDeleteDialogOpen(false);
      setDeletingRow(null);
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
              <p className="text-sm leading-5 text-muted-foreground">Manage users, vets, pets and services.</p>
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
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">VetConnect Control Center</h1>
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
                <StatCard icon={Users} label="Total Users" value={totalUsers} />
                <StatCard icon={User} label="Onboarded Users" value={onboardedUsers} />
                <StatCard icon={ShieldCheck} label="Active Vets" value={activeVets} />
                <StatCard icon={PawPrint} label="Total Pets" value={totalPets} />
                <StatCard icon={Globe2} label="Services Listed" value={totalServices} />
                <StatCard icon={BarChart3} label="Pending Tasks" value={4} />
              </div>

              <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Overview</p>
                    <h2 className="text-xl font-bold">Recent activity</h2>
                  </div>
                  <Button variant="secondary" className="h-10">
                    View all
                  </Button>
                </div>
                <div className="space-y-3">
                  {users.slice(0, 3).map((adminUser) => (
                    <div key={adminUser.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                      <div>
                        <p className="font-semibold">{adminUser.fullName}</p>
                        <p className="text-sm text-muted-foreground">{adminUser.phone} · {adminUser.country}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{adminUser.pets} pets</p>
                        <p className="text-xs text-muted-foreground">{adminUser.onboarded ? "Onboarded" : "Pending"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">{activeSection}</p>
                  <h2 className="text-2xl font-bold text-foreground">
                    {sections.find((section) => section.id === activeSection)?.label}
                  </h2>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-sm text-muted-foreground">{sectionItems.length} total {activeSection}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSection === "users" ? (
                      <>
                        <Badge variant="secondary">{onboardedUsers} onboarded</Badge>
                        <Badge>{totalUsers - onboardedUsers} pending</Badge>
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
          )}

          {activeSection !== "overview" && (
            <Card className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-muted-foreground">Search</p>
                  <Input
                    placeholder="Filter by name, category, location or ID"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Showing {pagedItems.length} of {sectionItems.length} {activeSection}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    {activeSection === "users" && (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Pets</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    {activeSection === "vets" && (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Surgery</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    )}
                    {activeSection === "pets" && (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Breed</TableHead>
                        <TableHead>Species</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>VetSure</TableHead>
                      </>
                    )}
                    {activeSection === "services" && (
                      <>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Distance</TableHead>
                        <TableHead>Open</TableHead>
                      </>
                    )}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSection === "users" &&
                    pagedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.fullName}</TableCell>
                        <TableCell>{item.phone}</TableCell>
                        <TableCell>{item.country}</TableCell>
                        <TableCell>{item.pets}</TableCell>
                        <TableCell>
                          <Badge variant={item.onboarded ? "default" : "secondary"}>
                            {item.onboarded ? "Onboarded" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "users", item })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "users", item })}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {activeSection === "vets" &&
                    pagedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.surgery}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>{item.phone}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === "Active" ? "default" : "secondary"}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "vets", item })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "vets", item })}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {activeSection === "pets" &&
                    pagedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.breed}</TableCell>
                        <TableCell>{item.species}</TableCell>
                        <TableCell>{item.healthStatus}</TableCell>
                        <TableCell>{item.vetSure ? "Yes" : "No"}</TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "pets", item })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "pets", item })}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {activeSection === "services" &&
                    pagedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.rating.toFixed(1)}</TableCell>
                        <TableCell>{item.distanceKm} km</TableCell>
                        <TableCell>
                          <Badge variant={item.open ? "default" : "secondary"}>
                            {item.open ? "Open" : "Closed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => startEdit({ section: "services", item })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => startDelete({ section: "services", item })}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage((prev) => Math.max(prev - 1, 1))} />
                  </PaginationItem>
                  {Array.from({ length: pageCount }, (_, index) => (
                    <PaginationItem key={index}>
                      <PaginationLink
                        onClick={() => setPage(index + 1)}
                        isActive={page === index + 1}
                      >
                        {index + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </Card>
          )}
        </div>
      </main>

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
                  <span>Country</span>
                  <Input value={String(formValues.country ?? "")} onChange={(event) => handleFormChange("country", event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Pets</span>
                  <Input type="number" value={Number(formValues.pets ?? 0)} onChange={(event) => handleFormChange("pets", Number(event.target.value))} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.onboarded)}
                    onChange={(event) => handleFormChange("onboarded", event.target.checked)}
                    className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-ring"
                  />
                  Onboarded
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
