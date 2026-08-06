import buddy from "@/assets/pet-buddy.jpg";
import mia from "@/assets/pet-mia.jpg";
import type { Pet } from "@/types";

export const mockPets: Pet[] = [
  {
    id: "pet-1",
    vetConnectId: "VC-ZW-284915",
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    sex: "Male",
    ageYears: 3,
    colour: "Golden",
    microchip: "985141002374561",
    photoUrl: buddy,
    healthStatus: "Healthy",
    weightKg: 31.4,
    nextVaccine: "12 August",
    medicationToday: "None Today",
    vetSure: false,

    timeline:[
      { id: "e0", date: "02 July 2026", title: "Annual check-up", detail: "All vitals normal. Weight stable.", type: "checkup" },
      { id: "e1", date: "02 July 2026", title: "Annual check-up", detail: "All vitals normal. Weight stable.", type: "checkup" },
      { id: "e2", date: "18 May 2026", title: "Rabies vaccination", detail: "Administered by Dr Munzeiwa.", type: "vaccine" },
      { id: "e3", date: "24 March 2026", title: "Grooming session", detail: "Full coat trim and nail care.", type: "grooming" },
      { id: "e4", date: "09 January 2026", title: "Deworming treatment", detail: "Routine parasite control.", type: "treatment" },
    ],
  },
  {
    id: "pet-2",
    vetConnectId: "VC-ZW-771043",
    name: "Mia",
    species: "Cat",
    breed: "Domestic Shorthair",
    sex: "Female",
    ageYears: 2,
    colour: "Tabby",
    photoUrl: mia,
    healthStatus: "Attention",
    weightKg: 4.2,
    nextVaccine: "30 September",
    medicationToday: "Eye drops",
    vetSure: false,
    timeline: [
      { id: "e5", date: "11 July 2026", title: "Eye irritation review", detail: "Prescribed drops for 7 days.", type: "treatment" },
      { id: "e6", date: "02 February 2026", title: "Feline core vaccine", detail: "First annual booster.", type: "vaccine" },
    ],
  },
];
