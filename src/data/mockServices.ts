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
    latitude: -17.7845,
    longitude: 31.0443,
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
    latitude: -17.8355,
    longitude: 31.045,
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
    latitude: -17.8153,
    longitude: 31.0406,
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
    latitude: -17.8201,
    longitude: 31.0302,
    open: true,
    imageUrl: hero,
  },
];
