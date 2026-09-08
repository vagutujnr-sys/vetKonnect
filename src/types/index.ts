export type Species = "Dog" | "Cat" | "Bird" | "Other";
export type HealthStatus = "Healthy" | "Attention" | "Under Care";
export type ModuleId = "pets" | "community" | "marketplace" | "rescue" | "tips" | "farm";
export type MediaType = "none" | "image" | "video";
export type AccountType = "owner" | "vet";

export interface Pet {
  id: string;
  ownerId?: string;
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
  id?: string;
  fullName: string;
  phone: string;
  countryCode: string;
  modules: ModuleId[];
  vetSureMember: boolean;
  onboarded: boolean;
  isAdmin?: boolean;
  notificationsEnabled?: boolean;
  boundDeviceId?: string | null;
  avatarUrl?: string;
  accountType?: AccountType;
  vetVerified?: boolean;
  practiceName?: string;
  patientsServed?: number;
  blocked?: boolean;
}

export interface AdminUser {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  countryCode?: string;
  onboarded: boolean;
  pets: number;
  subscriptions?: Array<{ plan: string; status: string; renews: string }>;
  petIds?: string[];
  memberSince?: string;
  vetSureMember?: boolean;
  modules?: ModuleId[];
  notificationsEnabled?: boolean;
  boundDeviceId?: string | null;
  deviceBoundAt?: string | null;
  isAdmin?: boolean;
  accountType?: AccountType;
  vetVerified?: boolean;
  practiceName?: string;
  patientsServed?: number;
  blocked?: boolean;
  avatarUrl?: string;
}

export interface PotentialClient {
  id: string;
  fullName: string;
  phone: string;
  pets: number;
  petNames: string[];
  memberSince?: string;
}

export interface AdminVet {
  id: string;
  name: string;
  surgery: string;
  location: string;
  phone: string;
  status: "Active" | "Inactive";
  rating: number;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface MappableVet {
  id: string;
  name: string;
  surgery: string;
  address: string;
  phone: string;
  rating: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  open?: boolean;
}

export interface CommunityPost {
  id: string;
  authorId?: string;
  author: string;
  location: string;
  timeAgo: string;
  avatarUrl: string;
  imageUrl: string;
  videoUrl?: string;
  mediaType?: MediaType;
  body: string;
  likes: number;
  comments: number;
  views: number;
  tag: "Story" | "Education" | "Rescue" | "Breeding";
  likedByMe?: boolean;
  createdAt?: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  accountId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  accountId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
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
  "id" | "vetConnectId" | "healthStatus" | "timeline" | "vetSure" | "weightKg" | "nextVaccine" | "medicationToday" | "ownerId"
>;
