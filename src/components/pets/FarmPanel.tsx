import { Camera, Plus, Tractor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addAnimalGroup, createHerd, listHerds, recordHerdTreatment, updateHerdAnimal, uploadHerdPhoto } from "@/services/herdService";
import type { Herd, HerdAnimalSex, HerdHealthStatus, HerdSpecies } from "@/types";

const SPECIES: HerdSpecies[] = ["Cattle", "Goats", "Sheep", "Pigs", "Poultry", "Other"];

function identityLabel(herdName: string, tagNumber: string) {
  return tagNumber ? `${herdName} · Tag ${tagNumber}` : `${herdName} · no tag yet`;
}

export function FarmPanel({ createOpen, onCreateOpenChange }: { createOpen: boolean; onCreateOpenChange: (open: boolean) => void }) {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [openHerdId, setOpenHerdId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<HerdSpecies>("Cattle");
  const [location, setLocation] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const [savingHerd, setSavingHerd] = useState(false);
  const [groupCount, setGroupCount] = useState("10");
  const [groupSex, setGroupSex] = useState<HerdAnimalSex>("Unknown");
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [treatHerdId, setTreatHerdId] = useState<string | null>(null);
  const [treatAnimalId, setTreatAnimalId] = useState("");
  const [treatTitle, setTreatTitle] = useState("");
  const [treatDetail, setTreatDetail] = useState("");
  const [treatStatus, setTreatStatus] = useState<HerdHealthStatus>("Under Care");
  const [savingTreat, setSavingTreat] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await listHerds();
      setSetupError(null);
      setHerds(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load herds";
      if (message.includes("not installed")) setSetupError(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const saveHerd = async () => {
    if (!photoFile) {
      toast.error("Add a photo of the herd.");
      return;
    }
    setSavingHerd(true);
    try {
      const herdId = crypto.randomUUID();
      const photoUrl = await uploadHerdPhoto(photoFile, herdId);
      const herd = await createHerd({ id: herdId, name, species, location, photoUrl });
      setHerds((prev) => [herd, ...prev]);
      setOpenHerdId(herd.id);
      setName("");
      setLocation("");
      setPhotoFile(null);
      setPhotoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      onCreateOpenChange(false);
      toast.success("Herd added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that herd");
    } finally {
      setSavingHerd(false);
    }
  };

  const saveGroup = async (herdId: string) => {
    const count = Number.parseInt(groupCount, 10);
    if (!Number.isFinite(count) || count < 1) {
      toast.error("Enter how many animals to add.");
      return;
    }
    setSavingGroup(true);
    try {
      await addAnimalGroup({ herdId, count, sex: groupSex });
      await load();
      setOpenHerdId(herdId);
      toast.success(count === 1 ? "1 animal added" : `${count} animals added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that group");
    } finally {
      setSavingGroup(false);
    }
  };

  const openTreat = (herdId: string, animalId = "") => {
    setTreatHerdId(herdId);
    setTreatAnimalId(animalId);
    setTreatTitle("");
    setTreatDetail("");
    setTreatStatus(animalId ? "Sick" : "Under Care");
    setOpenHerdId(herdId);
  };

  const saveTreatment = async (herdId: string) => {
    setSavingTreat(true);
    try {
      await recordHerdTreatment({
        herdId,
        animalId: treatAnimalId || null,
        title: treatTitle,
        detail: treatDetail,
        healthStatus: treatStatus,
      });
      setTreatHerdId(null);
      setTreatTitle("");
      setTreatDetail("");
      await load();
      setOpenHerdId(herdId);
      toast.success(treatAnimalId ? "Animal treatment saved" : "Herd treatment saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that treatment");
    } finally {
      setSavingTreat(false);
    }
  };

  const saveAnimal = async (id: string, patch: { tagNumber?: string; healthStatus?: HerdHealthStatus }) => {
    try {
      await updateHerdAnimal(id, patch);
      setHerds((prev) =>
        prev.map((herd) => ({
          ...herd,
          animals: herd.animals.map((animal) => (animal.id === id ? { ...animal, ...patch } : animal)),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that animal");
      void load();
    }
  };

  return (
    <div className="space-y-4 px-5 pb-8">
      <p className="text-sm text-muted-foreground">
        Add animals in a group. When one is sick, it is identified by the herd and its tag number.
      </p>

      {createOpen ? (
        <section className="card-surface space-y-3 p-4">
          <p className="font-bold">New herd</p>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)} />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-primary/40 bg-accent/40"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Herd preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-sm font-semibold text-primary">
                <Camera className="size-5" />
                Add a herd photo
              </span>
            )}
          </button>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Herd name, e.g. North kraal"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none"
          />
          <select
            value={species}
            onChange={(event) => setSpecies(event.target.value as HerdSpecies)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none"
          >
            {SPECIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Paddock or farm area (optional)"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none"
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onCreateOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              disabled={name.trim().length < 2 || !photoFile || savingHerd}
              onClick={() => void saveHerd()}
            >
              {savingHerd ? "Saving…" : "Save herd"}
            </Button>
          </div>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading herds…</p> : null}

      {setupError ? (
        <div className="card-surface px-5 py-6 text-sm text-muted-foreground">
          <p className="font-bold text-foreground">Farm setup needed</p>
          <p className="mt-1">{setupError}</p>
        </div>
      ) : null}

      {!loading && !setupError && herds.length === 0 ? (
        <div className="card-surface px-5 py-8 text-center">
          <Tractor className="mx-auto size-8 text-primary" />
          <p className="mt-3 font-bold">No herds yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a herd, then add the animals as a group.</p>
          <Button variant="hero" className="mt-4" onClick={() => onCreateOpenChange(true)}>
            <Plus className="size-4" /> New herd
          </Button>
        </div>
      ) : null}

      {herds.map((herd) => {
        const open = openHerdId === herd.id;
        const sick = herd.animals.filter((animal) => animal.healthStatus === "Sick");
        const underCare = herd.animals.filter((animal) => animal.healthStatus === "Under Care");
        const latest = herd.treatments[0];
        return (
          <section key={herd.id} className="card-surface overflow-hidden">
            {herd.photoUrl ? (
              <img src={herd.photoUrl} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-accent text-primary">
                <Tractor className="size-8" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpenHerdId(open ? null : herd.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <span>
                <span className="block text-lg font-bold">{herd.name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {herd.species}
                  {herd.location ? ` · ${herd.location}` : ""} · {herd.animals.length}{" "}
                  {herd.animals.length === 1 ? "animal" : "animals"}
                </span>
                {latest ? (
                  <span className="mt-1 block text-xs text-muted-foreground">Latest treatment: {latest.title}</span>
                ) : null}
              </span>
              {sick.length > 0 ? (
                <span className="rounded-full bg-[oklch(0.96_0.05_80)] px-2.5 py-1 text-xs font-semibold text-[oklch(0.45_0.12_70)]">
                  {sick.length} sick
                </span>
              ) : underCare.length > 0 ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {underCare.length} under care
                </span>
              ) : (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">Healthy</span>
              )}
            </button>

            {open ? (
              <div className="space-y-3 border-t border-border px-4 py-4">
                <div className="flex gap-2">
                  <Button type="button" variant="hero" size="sm" className="flex-1" onClick={() => openTreat(herd.id)}>
                    Treat herd
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setAddingGroupId(addingGroupId === herd.id ? null : herd.id)}
                  >
                    Add animals
                  </Button>
                </div>

                {treatHerdId === herd.id ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-sm font-semibold">{treatAnimalId ? "Treat one animal" : "Treat the whole herd"}</p>
                    <select
                      value={treatAnimalId}
                      onChange={(event) => setTreatAnimalId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Whole herd</option>
                      {herd.animals.map((animal, index) => (
                        <option key={animal.id} value={animal.id}>
                          {animal.tagNumber ? `Tag ${animal.tagNumber}` : `Untagged ${index + 1}`}
                        </option>
                      ))}
                    </select>
                    <input
                      value={treatTitle}
                      onChange={(event) => setTreatTitle(event.target.value)}
                      placeholder="Treatment, e.g. Deworming"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                    <textarea
                      value={treatDetail}
                      onChange={(event) => setTreatDetail(event.target.value)}
                      placeholder="Dose, medicine, or what you noticed"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                    <select
                      value={treatStatus}
                      onChange={(event) => setTreatStatus(event.target.value as HerdHealthStatus)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    >
                      <option value="Under Care">Mark under care</option>
                      <option value="Sick">Mark sick</option>
                      <option value="Healthy">Mark healthy</option>
                    </select>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setTreatHerdId(null)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="hero"
                        size="sm"
                        className="flex-1"
                        disabled={treatTitle.trim().length < 2 || savingTreat}
                        onClick={() => void saveTreatment(herd.id)}
                      >
                        {savingTreat ? "Saving…" : "Save treatment"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {herd.treatments.length > 0 ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {herd.treatments.slice(0, 3).map((item) => {
                      const animal = herd.animals.find((entry) => entry.id === item.animalId);
                      const who = animal
                        ? animal.tagNumber
                          ? `Tag ${animal.tagNumber}`
                          : "One animal"
                        : "Whole herd";
                      return (
                        <li key={item.id}>
                          <span className="font-semibold text-foreground">{item.title}</span> · {who}
                          {item.detail ? ` · ${item.detail}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {addingGroupId === herd.id ? (
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-sm font-semibold">Add a group</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      inputMode="numeric"
                      value={groupCount}
                      onChange={(event) => setGroupCount(event.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                      aria-label="Number of animals"
                    />
                    <select
                      value={groupSex}
                      onChange={(event) => setGroupSex(event.target.value as HerdAnimalSex)}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                    >
                      <option value="Unknown">Mixed / unknown</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    disabled={savingGroup}
                    onClick={() => void saveGroup(herd.id)}
                  >
                    {savingGroup ? "Adding…" : "Add animals"}
                  </Button>
                </div>
                ) : null}

                {herd.animals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No animals in this herd yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {herd.animals.map((animal, index) => (
                      <li key={animal.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{identityLabel(herd.name, animal.tagNumber)}</p>
                          <span className="text-xs text-muted-foreground">
                            {animal.sex === "Unknown" ? "Sex unknown" : animal.sex}
                          </span>
                        </div>
                        <label className="mt-2 block text-xs font-medium text-muted-foreground">
                          Tag number
                          <input
                            defaultValue={animal.tagNumber}
                            key={`${animal.id}-${animal.tagNumber}`}
                            placeholder={animal.tagNumber ? undefined : `Not tagged · animal ${index + 1}`}
                            onBlur={(event) => {
                              const next = event.target.value.trim();
                              if (next === animal.tagNumber) return;
                              void saveAnimal(animal.id, { tagNumber: next });
                            }}
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openTreat(herd.id, animal.id)}
                            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                          >
                            Treat
                          </button>
                          {(["Healthy", "Under Care", "Sick"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                if (animal.healthStatus === status) return;
                                void saveAnimal(animal.id, { healthStatus: status });
                              }}
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold",
                                animal.healthStatus === status
                                  ? status === "Sick"
                                    ? "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.12_70)]"
                                    : status === "Under Care"
                                      ? "bg-primary/10 text-primary"
                                      : "bg-accent text-accent-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                        {animal.healthStatus === "Sick" ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {animal.tagNumber
                              ? `Identify this animal as ${identityLabel(herd.name, animal.tagNumber)}.`
                              : "Add a tag number so this sick animal can be identified in the herd."}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
