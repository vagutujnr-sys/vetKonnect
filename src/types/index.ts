export type Species = "Dog" | "Cat" | "Bird" | "Other";
export type HealthStatus = "Healthy" | "Attention" | "Under Care";
export type ModuleId = "pets" | "community" | "marketplace" | "rescue" | "tips" | "farm";
export type MediaType = "none" | "image" | "video";
export type AccountType = "owner" | "vet";
export type BreedersClubStatus =
  "none" | "pending" | "active" | "expired" | "cancelled" | "suspended";

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
  lastAttendedBy?: string;
  lastService?: string;
  lastNotes?: string;
  lastOverallHealth?: HealthStatus;
}

export interface HealthEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: "vaccine" | "checkup" | "treatment" | "grooming";
  attendedBy?: string;
  service?: string;
  notes?: string;
  overallHealth?: HealthStatus;
}

export interface UserProfile {
  id?: string;
  fullName: string;
  phone: string;
  countryCode: string;
  modules: ModuleId[];
  vetSureMember: boolean;
  breedersClubMember: boolean;
  breedersClubStatus: BreedersClubStatus;
  breederShowcasePetId?: string | null;
  onboarded: boolean;
  isAdmin?: boolean;
  notificationsEnabled?: boolean;
  /** Owner agreed to WhatsApp receipts and follow-up visits on their registered number. */
  whatsappOptIn?: boolean;
  boundDeviceId?: string | null;
  avatarUrl?: string;
  accountType?: AccountType;
  vetVerified?: boolean;
  practiceName?: string;
  patientsServed?: number;
  blocked?: boolean;
  /** ISO timestamp when the vet asked for practice dashboard access. */
  dashboardRequestedAt?: string | null;
  /** Linked directory surgery (`public.vets.id`). */
  surgeryId?: string | null;
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
  dashboardRequestedAt?: string | null;
  surgeryId?: string | null;
}

export interface PotentialClient {
  id: string;
  fullName: string;
  pets: number;
  petNames: string[];
  memberSince?: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  avatarUrl?: string;
  /** True when coordinates are estimated near the vet (no stored owner location yet). */
  approximate?: boolean;
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
  authorPremium?: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  parentId?: string | null;
  accountId: string;
  authorName: string;
  body: string;
  createdAt: string;
  authorPremium?: boolean;
}

export interface AppNotification {
  id: string;
  accountId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  /** Sender / actor avatar when available (chats, calls, etc.). */
  imageUrl?: string | null;
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

export type HerdSpecies = "Cattle" | "Goats" | "Sheep" | "Pigs" | "Poultry" | "Other";
export type HerdAnimalSex = "Male" | "Female" | "Unknown";
export type HerdHealthStatus = "Healthy" | "Sick" | "Under Care";

export interface HerdAnimal {
  id: string;
  herdId: string;
  ownerId: string;
  tagNumber: string;
  sex: HerdAnimalSex;
  healthStatus: HerdHealthStatus;
  notes: string;
  createdAt: string;
}

export interface HerdTreatment {
  id: string;
  herdId: string;
  animalId: string | null;
  title: string;
  detail: string;
  createdAt: string;
}

export interface Herd {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  location: string;
  notes: string;
  photoUrl: string;
  createdAt: string;
  animals: HerdAnimal[];
  treatments: HerdTreatment[];
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
  | "id"
  | "vetConnectId"
  | "healthStatus"
  | "timeline"
  | "vetSure"
  | "weightKg"
  | "nextVaccine"
  | "medicationToday"
  | "ownerId"
>;

export type LicenceStatus = "active" | "expired" | "revoked";
export type AnimalCaseType = "lost" | "found" | "impound" | "incident";
export type AnimalCaseStatus = "open" | "resolved" | "closed";

export interface CouncilOfficial {
  id: string;
  email: string;
  fullName: string;
  title?: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface PetLicence {
  id: string;
  petId?: string | null;
  licenceNumber: string;
  ownerName?: string;
  petName?: string;
  species?: string;
  issuedAt: string;
  expiresAt: string;
  status: LicenceStatus;
  notes?: string;
}

export interface AnimalControlCase {
  id: string;
  caseType: AnimalCaseType;
  status: AnimalCaseStatus;
  title: string;
  description?: string;
  species?: string;
  petId?: string | null;
  petName?: string;
  locationLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  reportedAt: string;
  resolvedAt?: string | null;
  reportedBy?: string;
}

export interface CouncilDashboardStats {
  registeredDogs: number;
  registeredPets: number;
  activeLicences: number;
  expiredLicences: number;
  licenceCompliancePct: number;
  dogsWithoutLicence: number;
  rabiesRecorded: number;
  rabiesMissing: number;
  lostOpen: number;
  foundOpen: number;
  impoundedOpen: number;
  incidentsOpen: number;
}

export interface CouncilMapPoint {
  id: string;
  label: string;
  kind: AnimalCaseType | "registered";
  latitude: number;
  longitude: number;
  detail?: string;
}

export interface CouncilPetOwner {
  id: string;
  fullName: string;
  phone: string;
  countryCode: string;
}

export interface CouncilPetLookup {
  pet: Pet;
  owner: CouncilPetOwner | null;
  licence: PetLicence | null;
  licenceStatus: "licensed" | "expired" | "revoked" | "unlicensed";
  /** True when the scanned tag matches a pet in the VetKonnect registry. */
  registered: true;
  scannedCode: string;
}

export interface CouncilPetNotRegistered {
  registered: false;
  scannedCode: string;
}

export type CouncilTagScanResult = CouncilPetLookup | CouncilPetNotRegistered;

export interface ChatConversation {
  id: string;
  ownerAccountId: string;
  vetAccountId: string;
  surgeryId?: string | null;
  /** Pet this thread is aligned to (owner-set reference for the vet). */
  petId?: string | null;
  petName?: string | null;
  petPhotoUrl?: string | null;
  petSpecies?: string | null;
  petBreed?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  createdAt: string;
  /** Display name of the other party for the current viewer. */
  peerName: string;
  peerRole: "owner" | "vet";
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderAccountId: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: "none" | "image" | "video" | "audio";
  replyToId?: string | null;
  replyPreview?: string | null;
  replySenderName?: string | null;
  readByRecipient: boolean;
  createdAt: string;
  mine: boolean;
}

export type DvsOfficerRole = "officer" | "supervisor" | "admin";
export type DvsCertificateStatus = "valid" | "expired" | "cancelled" | "amended" | "suspicious";
export type DvsVaccinationStatus = "administered" | "scheduled" | "void";
export type DvsRabiesCaseStatus = "suspected" | "confirmed" | "negative";
export type DvsQrScanResult = DvsCertificateStatus | "not_found" | "invalid";

export interface DvsOfficer {
  id: string;
  email: string;
  fullName: string;
  title?: string;
  role: DvsOfficerRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export type DvsVaccineProductType = "Inactivated injectable" | "Live oral" | "Recombinant oral";
export type DvsVetReportReviewStatus = "submitted" | "acknowledged" | "under_review";
export type DvsHealthReportType =
  | "monthly_summary"
  | "outbreak"
  | "notifiable_disease"
  | "vaccination_campaign"
  | "laboratory"
  | "other";
export type DvsHealthReportReviewStatus = "submitted" | "acknowledged" | "actioned";

export interface DvsRecognisedVaccine {
  id: string;
  name: string;
  vaccineType: string;
  manufacturer: string;
  species: string;
  strain?: string;
  registrationNumber?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface DvsVaccineBatch {
  id: string;
  manufacturer: string;
  batchNumber: string;
  vaccineName: string;
  vaccineId?: string | null;
  veterinarianAccountId?: string | null;
  source?: "dvs" | "vet";
  expiryDate?: string | null;
  quantityReceived: number;
  notes?: string;
  createdAt: string;
}

export interface VetPracticeNote {
  id: string;
  veterinarianAccountId: string;
  petId?: string | null;
  petName?: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DvsVetCaseReport {
  id: string;
  veterinarianAccountId: string;
  veterinarianName?: string;
  practiceName?: string;
  petId?: string | null;
  petName?: string;
  species?: string;
  caseStatus: DvsRabiesCaseStatus;
  province?: string;
  district?: string;
  locationLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  vaccinationStatus?: string;
  notes?: string;
  rabiesCaseId?: string | null;
  reviewStatus: DvsVetReportReviewStatus;
  dvsNotes?: string;
  reportedAt: string;
}

export interface DvsAnimalHealthReport {
  id: string;
  veterinarianAccountId: string;
  veterinarianName?: string;
  practiceName?: string;
  reportType: DvsHealthReportType;
  title: string;
  body: string;
  province?: string;
  district?: string;
  petId?: string | null;
  reviewStatus: DvsHealthReportReviewStatus;
  dvsNotes?: string;
  submittedAt: string;
  acknowledgedAt?: string | null;
}

export interface DvsVaccination {
  id: string;
  petId?: string | null;
  ownerAccountId?: string | null;
  veterinarianAccountId?: string | null;
  practiceId?: string | null;
  batchId?: string | null;
  vaccineId?: string | null;
  vaccinatedAt: string;
  validUntil?: string | null;
  province?: string;
  district?: string;
  status: DvsVaccinationStatus;
  notes?: string;
  createdAt: string;
}

export interface DvsCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  petId?: string | null;
  ownerAccountId?: string | null;
  vaccinationId?: string | null;
  veterinarianAccountId?: string | null;
  practiceId?: string | null;
  issuedByDvsId?: string | null;
  issuedAt: string;
  expiresAt: string;
  status: DvsCertificateStatus;
  previousCertificateId?: string | null;
  petName?: string;
  species?: string;
  breed?: string;
  microchip?: string;
  vetconnectId?: string;
  ownerName?: string;
  ownerPhone?: string;
  veterinarianName?: string;
  practiceName?: string;
  manufacturer?: string;
  batchNumber?: string;
  vaccineName?: string;
  vaccineId?: string | null;
  province?: string;
  district?: string;
  qrPayload?: string;
  notes?: string;
  createdAt: string;
}

export type DvsLicenceStatus = "active" | "expired" | "revoked" | "pending";
export type DvsPaymentStatus = "pending" | "paid" | "cancelled" | "failed";
export type DvsPaymentMethod = "paynow" | "ecocash" | "onemoney" | "office";

export interface DvsAnimalLicence {
  id: string;
  licenceNumber: string;
  petId?: string | null;
  ownerAccountId?: string | null;
  ownerName?: string;
  ownerPhone?: string;
  petName?: string;
  species?: string;
  sex?: string;
  issuedAt: string;
  expiresAt: string;
  status: DvsLicenceStatus;
  amount: number;
  currency: string;
  paymentId?: string | null;
  issuedBy?: string;
  notes?: string;
  proofUrl?: string;
  createdAt: string;
}

export interface DvsLicencePayment {
  id: string;
  reference: string;
  petId?: string | null;
  ownerAccountId?: string | null;
  licenceId?: string | null;
  amount: number;
  currency: string;
  method: DvsPaymentMethod;
  status: DvsPaymentStatus;
  phone?: string;
  pollUrl?: string;
  redirectUrl?: string;
  instructions?: string;
  paynowStatus?: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface DvsAnimalRegistryRow {
  pet: Pet;
  ownerName?: string;
  ownerPhone?: string;
  licenceStatus: "licensed" | "expired" | "unlicensed" | "revoked" | "pending";
  licenceNumber?: string;
  licenceExpiresAt?: string;
}

export interface DvsLicenceFinance {
  currency: string;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  paidAmount: number;
  pendingAmount: number;
  activeLicences: number;
  expiredLicences: number;
  unlicensedAnimals: number;
  yearToDatePaid: number;
}

export interface DvsQrScan {
  id: string;
  certificateId?: string | null;
  verificationCode?: string;
  result: DvsQrScanResult;
  scannerContext?: string;
  locationLabel?: string;
  scannedAt: string;
}

export interface DvsRabiesCase {
  id: string;
  status: DvsRabiesCaseStatus;
  species?: string;
  petId?: string | null;
  petName?: string;
  province?: string;
  district?: string;
  locationLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  vaccinationStatus?: string;
  reportedAt: string;
  notes?: string;
}

export interface DvsAuditEntry {
  id: string;
  actorType: string;
  actorId?: string | null;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface DvsSettings {
  certificateValidityDays: number;
  coverageAlertThreshold: number;
  expiryWarningDays: number;
  verificationEnabled: boolean;
}

export interface DvsCoverageRow {
  province: string;
  district?: string;
  animals: number;
  vaccinated: number;
  identified: number;
  coveragePct: number;
}

export interface DvsAlert {
  id: string;
  severity: "red" | "orange" | "yellow";
  title: string;
  detail: string;
  count: number;
}

export interface DvsDashboardStats {
  animalsIdentified: number;
  rabiesVaccinations: number;
  activeCertificates: number;
  expiredCertificates: number;
  cancelledCertificates: number;
  activePractices: number;
  authorisedVeterinarians: number;
  nationalCoveragePct: number;
  microchippedAnimals: number;
  scansToday: number;
  suspectedRabies: number;
  confirmedRabies: number;
  totalAnimals: number;
  licensedAnimals: number;
  unlicensedAnimals: number;
  licenceRevenuePaid: number;
}

export interface DvsMapPoint {
  id: string;
  label: string;
  kind: "vaccination" | "identified" | "rabies" | "coverage";
  latitude: number;
  longitude: number;
  detail?: string;
}

export interface DvsPractitionerRow {
  id: string;
  name: string;
  practiceName: string;
  phone?: string;
  verified: boolean;
  status?: string;
  certificatesIssued: number;
  vaccinationsRecorded: number;
}

export interface DvsDashboardSnapshot {
  stats: DvsDashboardStats;
  certificates: DvsCertificate[];
  vaccinations: DvsVaccination[];
  batches: DvsVaccineBatch[];
  scans: DvsQrScan[];
  rabiesCases: DvsRabiesCase[];
  audit: DvsAuditEntry[];
  officers: DvsOfficer[];
  coverage: DvsCoverageRow[];
  alerts: DvsAlert[];
  mapPoints: DvsMapPoint[];
  practitioners: DvsPractitionerRow[];
  settings: DvsSettings;
  pets: Pet[];
  recognisedVaccines: DvsRecognisedVaccine[];
  vetCaseReports: DvsVetCaseReport[];
  healthReports: DvsAnimalHealthReport[];
  licences: DvsAnimalLicence[];
  licencePayments: DvsLicencePayment[];
  animalRegistry: DvsAnimalRegistryRow[];
  licenceFinance: DvsLicenceFinance;
}
