export type DvsProvinceName =
  | "Harare"
  | "Bulawayo"
  | "Manicaland"
  | "Mashonaland Central"
  | "Mashonaland East"
  | "Mashonaland West"
  | "Masvingo"
  | "Matabeleland North"
  | "Matabeleland South"
  | "Midlands";

export type DvsRegion = {
  province: DvsProvinceName;
  districts: string[];
  latitude: number;
  longitude: number;
};

export const DVS_REGIONS: DvsRegion[] = [
  { province: "Harare", districts: ["Harare Urban", "Harare Rural", "Chitungwiza", "Epworth"], latitude: -17.8292, longitude: 31.0522 },
  { province: "Bulawayo", districts: ["Bulawayo Urban", "Bulawayo Rural"], latitude: -20.1563, longitude: 28.5887 },
  { province: "Manicaland", districts: ["Mutare", "Chipinge", "Makoni", "Nyanga"], latitude: -18.9707, longitude: 32.6709 },
  { province: "Mashonaland Central", districts: ["Bindura", "Mazowe", "Shamva", "Guruve"], latitude: -17.301, longitude: 31.330 },
  { province: "Mashonaland East", districts: ["Marondera", "Murehwa", "Goromonzi", "Wedza"], latitude: -18.185, longitude: 31.552 },
  { province: "Mashonaland West", districts: ["Chinhoyi", "Kadoma", "Kariba", "Zvimba"], latitude: -17.367, longitude: 30.2 },
  { province: "Masvingo", districts: ["Masvingo", "Chiredzi", "Gutu", "Bikita"], latitude: -20.074, longitude: 30.833 },
  { province: "Matabeleland North", districts: ["Hwange", "Binga", "Lupane", "Nkayi"], latitude: -18.364, longitude: 26.5 },
  { province: "Matabeleland South", districts: ["Gwanda", "Beitbridge", "Insiza", "Matobo"], latitude: -20.936, longitude: 29.0 },
  { province: "Midlands", districts: ["Gweru", "Kwekwe", "Gokwe", "Shurugwi"], latitude: -19.45, longitude: 29.82 },
];

export const DVS_PROVINCES = DVS_REGIONS.map((region) => region.province);

export function districtsForProvince(province: string): string[] {
  return DVS_REGIONS.find((region) => region.province === province)?.districts ?? [];
}

export function regionForProvince(province: string): DvsRegion | undefined {
  return DVS_REGIONS.find((region) => region.province === province);
}

export function assignRegionFromSeed(seed: string): { province: DvsProvinceName; district: string } {
  const total = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const region = DVS_REGIONS[total % DVS_REGIONS.length];
  const district = region.districts[total % region.districts.length];
  return { province: region.province, district };
}
