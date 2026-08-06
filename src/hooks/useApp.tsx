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
  updateUser: (patch: Partial<UserProfile>) => void;
  addPet: (input: NewPetInput) => Promise<Pet>;
  joinVetSure: () => void;
  signOut: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile>(userService.defaultUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [u, p] = await Promise.all([userService.getUser(), petService.getPets()]);
      if (!alive) return;
      setUser(u);
      setPets(p);
      setActivePetId(p[0]?.id ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const updateUser = useCallback((patch: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      void userService.updateUser(patch);
      return next;
    });
  }, []);

  const addPet = useCallback(async (input: NewPetInput) => {
    const pet = await petService.createPet(input);
    setPets((prev) => [...prev, pet]);
    setActivePetId(pet.id);
    return pet;
  }, []);

  const joinVetSure = useCallback(() => {
    updateUser({ vetSureMember: true });
    setPets((prev) => {
      const next = prev.map((p) => ({ ...p, vetSure: true }));
      void petService.savePets(next);
      return next;
    });
  }, [updateUser]);

  const signOut = useCallback(() => {
    void userService.resetUser();
    setUser(userService.defaultUser);
  }, []);

  const value = useMemo(
    () => ({ ready, user, pets, activePetId, setActivePet: setActivePetId, updateUser, addPet, joinVetSure, signOut }),
    [ready, user, pets, activePetId, updateUser, addPet, joinVetSure, signOut],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
