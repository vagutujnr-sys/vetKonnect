import type { AdminUser, AdminVet } from "@/types";

export const mockAdminUsers: AdminUser[] = [
  {
    id: "user-1",
    fullName: "Chipo Moyo",
    phone: "+263 77 123 4567",
    country: "Zimbabwe",
    onboarded: true,
    pets: 2,
  },
  {
    id: "user-2",
    fullName: "Tendai Ndlovu",
    phone: "+263 77 234 5678",
    country: "Zimbabwe",
    onboarded: true,
    pets: 1,
  },
  {
    id: "user-3",
    fullName: "Samuel Banda",
    phone: "+263 77 345 6789",
    country: "Zimbabwe",
    onboarded: false,
    pets: 0,
  },
  {
    id: "user-4",
    fullName: "Tariro Chikafu",
    phone: "+263 77 456 7890",
    country: "Zimbabwe",
    onboarded: true,
    pets: 3,
  },
];

export const mockAdminVets: AdminVet[] = [
  {
    id: "vet-1",
    name: "Dr Munzeiwa",
    surgery: "Animal Farm",
    location: "Harare Central",
    phone: "+263 77 765 4321",
    status: "Active",
    rating: 4.9,
  },
  {
    id: "vet-2",
    name: "Dr Tendai Mashiri",
    surgery: "Greenfields Vet Clinic",
    location: "Bulawayo",
    phone: "+263 77 987 6543",
    status: "Active",
    rating: 4.7,
  },
  {
    id: "vet-3",
    name: "Dr Kudzai Nyashanu",
    surgery: "Kariba Animal Care",
    location: "Kariba",
    phone: "+263 77 555 0101",
    status: "Inactive",
    rating: 4.2,
  },
];
