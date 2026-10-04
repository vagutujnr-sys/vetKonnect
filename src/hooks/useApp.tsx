import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as petService from "@/services/petService";
import * as userService from "@/services/userService";
import type { NewPetInput, Pet, UserProfile } from "@/types";

interface AppState {
  ready: boolean;
  user: UserProfile;
  pets: Pet[];
  activePetId: string | null;
  setActivePet: (id: string) => void;
  acceptAuthenticatedUser: (user: UserProfile) => void;
  refreshSession: () => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  addPet: (input: NewPetInput) => Promise<Pet>;
  updatePet: (id: string, patch: Partial<Pet>) => Promise<Pet | undefined>;
  joinVetSure: () => void;
  joinBreedersClub: () => Promise<void>;
  setBreederShowcasePet: (petId: string | null) => Promise<void>;
  activateBreedersClub: () => Promise<void>;
  signOut: () => Promise<void>;
  unbindDevice: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserProfile>(
    () => userService.getCachedUser() ?? userService.defaultUser,
  );
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const sessionEpoch = useRef(0);

  const refreshSession = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const epoch = sessionEpoch.current;
    refreshInFlight.current = (async () => {
      try {
        const u = await userService.getUser();
        if (epoch !== sessionEpoch.current) return;
        setUser(u);
        if (u.id) {
          const p = await petService.getPets(u.id);
          if (epoch !== sessionEpoch.current) return;
          setPets(p);
          setActivePetId((prev) =>
            prev && p.some((pet) => pet.id === prev) ? prev : (p[0]?.id ?? null),
          );
        } else {
          setPets([]);
          setActivePetId(null);
        }
      } catch (error) {
        console.error("Failed to refresh session", error);
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, []);

  const acceptAuthenticatedUser = useCallback((authenticatedUser: UserProfile) => {
    sessionEpoch.current += 1;
    setUser(authenticatedUser);
    setPets([]);
    setActivePetId(null);
    if (!authenticatedUser.id) return;
    void petService.getPets(authenticatedUser.id).then((nextPets) => {
      setPets(nextPets);
      setActivePetId((prev) =>
        prev && nextPets.some((pet) => pet.id === prev) ? prev : (nextPets[0]?.id ?? null),
      );
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await refreshSession();
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshSession]);

  // Pick up admin elevation / block changes without requiring a full re-login.
  useEffect(() => {
    const onFocus = () => {
      void refreshSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshSession]);

  const updateUser = useCallback(async (patch: Partial<UserProfile>) => {
    let previous: UserProfile | null = null;
    setUser((prev) => {
      previous = prev;
      return { ...prev, ...patch };
    });
    try {
      const next = await userService.updateUser(patch);
      setUser(next);
      return next;
    } catch (error) {
      if (previous) setUser(previous);
      throw error;
    }
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

  const joinBreedersClub = useCallback(async () => {
    await updateUser({
      breedersClubMember: true,
      breedersClubStatus: "pending",
    });
  }, [updateUser]);

  const activateBreedersClub = useCallback(async () => {
    await updateUser({
      breedersClubMember: true,
      breedersClubStatus: "active",
    });
  }, [updateUser]);

  const setBreederShowcasePet = useCallback(
    async (petId: string | null) => {
      await updateUser({ breederShowcasePetId: petId });
    },
    [updateUser],
  );

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
      acceptAuthenticatedUser,
      refreshSession,
      updateUser,
      addPet,
      updatePet,
      joinVetSure,
      joinBreedersClub,
      activateBreedersClub,
      setBreederShowcasePet,
      signOut,
      unbindDevice,
    }),
    [
      ready,
      user,
      pets,
      activePetId,
      acceptAuthenticatedUser,
      refreshSession,
      updateUser,
      addPet,
      updatePet,
      joinVetSure,
      joinBreedersClub,
      activateBreedersClub,
      setBreederShowcasePet,
      signOut,
      unbindDevice,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
