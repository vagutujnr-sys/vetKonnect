export type Species = "Dog" | "Cat" | "Bird" | "Other";
export type HealthStatus = "Healthy" | "Attention" | "Under Care";
export type ModuleId = "pets" | "community" | "marketplace" | "rescue" | "tips" | "farm";

export interface Pet {
  id: string;
  vetConnectId: string;
  qrPayload?: string;
  name: string;
  species: Species;
  breed: string;
  sex: "Male" | "Female";
  ageYears: number;
  colour: string;
  microchip?: string;
  collarId?: string;
  photoUrl: string;
  healthStatus: HealthStatus;
  weightKg: number;
  nextVaccine: string;
  medicationToday: string;
  vetSure: boolean;
  timeline: HealthEvent[];
}

export interface HealthEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: "vaccine" | "checkup" | "treatment" | "grooming";
}

export interface UserProfile {
  fullName: string;
  phone: string;
  countryCode: string;
  modules: ModuleId[];
  vetSureMember: boolean;
  onboarded: boolean;
  isAdmin?: boolean;
}

export interface AdminUser {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  onboarded: boolean;
  pets: number;
  subscriptions?: Array<{ plan: string; status: string; renews: string }>;
  petIds?: string[];
  memberSince?: string;
  vetSureMember?: boolean;
}

export interface AdminVet {
  id: string;
  name: string;
  surgery: string;
  location: string;
  phone: string;
  status: "Active" | "Inactive";
  rating: number;
}

export interface CommunityPost {
  id: string;
  author: string;
  location: string;
  timeAgo: string;
  avatarUrl: string;
  imageUrl: string;
  body: string;
  likes: number;
  comments: number;
  tag: "Story" | "Education" | "Rescue";
}

export interface ServiceListing {
  id: string;
  name: string;
  category: "Veterinary Clinic" | "Grooming" | "Pet Store" | "Emergency";
  distanceKm: number;
  rating: number;
  address: string;
  latitude: number;
  longitude: number;
  open: boolean;
  imageUrl: string;
}

export interface HerdTag {
  id: string;
  type: "Collar ID" | "Pet Tag";
  prefix: string;
  code: string;
  qrDataUrl: string;
  createdAt: string;
}

export type NewPetInput = Omit<
  Pet,
  "id" | "vetConnectId" | "healthStatus" | "timeline" | "vetSure" | "weightKg" | "nextVaccine" | "medicationToday"
>;
