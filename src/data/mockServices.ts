import buddy from "@/assets/pet-buddy.jpg";
import mia from "@/assets/pet-mia.jpg";
import hero from "@/assets/welcome-hero.jpg";
import type { ServiceListing } from "@/types";

export const mockServices: ServiceListing[] = [
  {
    id: "svc-1",
    name: "Animal Farm",
    category: "Veterinary Clinic",
    distanceKm: 0.8,
    rating: 4.9,
    address: "12 Whitwell Road, Borrowdale",
    open: true,
    imageUrl: hero,
  },
  {
    id: "svc-2",
    name: "The Grooming Studio",
    category: "Grooming",
    distanceKm: 1.2,
    rating: 4.7,
    address: "5 Arundel Village, Harare",
    open: true,
    imageUrl: buddy,
  },
  {
    id: "svc-3",
    name: "PetLife Supplies",
    category: "Pet Store",
    distanceKm: 1.5,
    rating: 4.5,
    address: "Sam Levy's Village, Harare",
    open: false,
    imageUrl: mia,
  },
  {
    id: "svc-4",
    name: "24/7 Animal Emergency Centre",
    category: "Emergency",
    distanceKm: 2.1,
    rating: 4.8,
    address: "88 Enterprise Road, Harare",
    open: true,
    imageUrl: hero,
  },
];
