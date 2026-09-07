import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as petService from "@/services/petService";
import * as userService from "@/services/userService";
import type { NewPetInput, Pet, UserProfile } from "@/types";

interface AppState {
  ready: boolean;
  user: UserProfile;
  pets: Pet[];
  activePetId: string | null;
  setActivePet: (id: string) => void;
  refreshSession: () => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  addPet: (input: NewPetInput) => Promise<Pet>;
  updatePet: (id: string, patch: Partial<Pet>) => Promise<Pet | undefined>;
  joinVetSure: () => void;
  signOut: () => Promise<void>;
  unbindDevice: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile>(userService.defaultUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    const u = await userService.getUser();
    setUser(u);
    if (u.id) {
      const p = await petService.getPets(u.id);
      setPets(p);
      setActivePetId((prev) => (prev && p.some((pet) => pet.id === prev) ? prev : p[0]?.id ?? null));
    } else {
      setPets([]);
      setActivePetId(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await refreshSession();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [refreshSession]);

  const updateUser = useCallback(async (patch: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...patch }));
    const next = await userService.updateUser(patch);
    setUser(next);
  }, []);

  const addPet = useCallback(async (input: NewPetInput) => {
    const pet = await petService.createPet(input);
    setPets((prev) => [...prev, pet]);
    setActivePetId(pet.id);
    return pet;
  }, []);

  const updatePet = useCallback(async (id: string, patch: Partial<Pet>) => {
    const updated = await petService.updatePet(id, patch);
    if (updated) {
      setPets((prev) => prev.map((pet) => (pet.id === id ? updated : pet)));
    }
    return updated;
  }, []);

  const joinVetSure = useCallback(() => {
    void updateUser({ vetSureMember: true });
    setPets((prev) => {
      const next = prev.map((p) => ({ ...p, vetSure: true }));
      void petService.savePets(next);
      return next;
    });
  }, [updateUser]);

  const signOut = useCallback(async () => {
    await userService.resetUser();
    setUser(userService.defaultUser);
    setPets([]);
    setActivePetId(null);
  }, []);

  const unbindDevice = useCallback(async () => {
    await userService.unbindDevice();
    setUser(userService.defaultUser);
    setPets([]);
    setActivePetId(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      pets,
      activePetId,
      setActivePet: setActivePetId,
      refreshSession,
      updateUser,
      addPet,
      updatePet,
      joinVetSure,
      signOut,
      unbindDevice,
    }),
    [ready, user, pets, activePetId, refreshSession, updateUser, addPet, updatePet, joinVetSure, signOut, unbindDevice],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
