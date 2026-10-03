import type { DvsRabiesCaseStatus } from "@/types";

/** Real town / suburb coordinates in Zimbabwe for rabies surveillance mapping. */
export type DvsRabiesSite = {
  locationLabel: string;
  province: string;
  district: string;
  latitude: number;
  longitude: number;
};

export const DVS_RABIES_SITES: DvsRabiesSite[] = [
  { locationLabel: "Mbare, Harare", province: "Harare", district: "Harare Urban", latitude: -17.859, longitude: 31.038 },
  { locationLabel: "Epworth, Harare", province: "Harare", district: "Epworth", latitude: -17.8894, longitude: 31.1472 },
  { locationLabel: "Chitungwiza", province: "Harare", district: "Chitungwiza", latitude: -18.0128, longitude: 31.0756 },
  { locationLabel: "Highfield, Harare", province: "Harare", district: "Harare Urban", latitude: -17.8667, longitude: 31.0167 },
  { locationLabel: "Budiriro, Harare", province: "Harare", district: "Harare Urban", latitude: -17.873, longitude: 30.94 },
  { locationLabel: "Mutare (Sakubva)", province: "Manicaland", district: "Mutare", latitude: -18.983, longitude: 32.65 },
  { locationLabel: "Chipinge", province: "Manicaland", district: "Chipinge", latitude: -20.1883, longitude: 32.6236 },
  { locationLabel: "Rusape", province: "Manicaland", district: "Makoni", latitude: -18.527, longitude: 32.128 },
  { locationLabel: "Nyanga", province: "Manicaland", district: "Nyanga", latitude: -18.2167, longitude: 32.745 },
  { locationLabel: "Bindura", province: "Mashonaland Central", district: "Bindura", latitude: -17.3019, longitude: 31.3306 },
  { locationLabel: "Mazowe", province: "Mashonaland Central", district: "Mazowe", latitude: -17.5042, longitude: 30.9739 },
  { locationLabel: "Guruve", province: "Mashonaland Central", district: "Guruve", latitude: -16.65, longitude: 30.6167 },
  { locationLabel: "Marondera", province: "Mashonaland East", district: "Marondera", latitude: -18.1853, longitude: 31.5519 },
  { locationLabel: "Murehwa", province: "Mashonaland East", district: "Murehwa", latitude: -17.6431, longitude: 31.7847 },
  { locationLabel: "Chinhoyi", province: "Mashonaland West", district: "Chinhoyi", latitude: -17.3667, longitude: 30.2 },
  { locationLabel: "Kariba", province: "Mashonaland West", district: "Kariba", latitude: -16.5167, longitude: 28.8 },
  { locationLabel: "Kadoma", province: "Mashonaland West", district: "Kadoma", latitude: -18.3333, longitude: 29.9153 },
  { locationLabel: "Masvingo", province: "Masvingo", district: "Masvingo", latitude: -20.0736, longitude: 30.8272 },
  { locationLabel: "Chiredzi", province: "Masvingo", district: "Chiredzi", latitude: -21.05, longitude: 31.6667 },
  { locationLabel: "Gutu", province: "Masvingo", district: "Gutu", latitude: -19.65, longitude: 31.1667 },
  { locationLabel: "Gweru", province: "Midlands", district: "Gweru", latitude: -19.45, longitude: 29.8167 },
  { locationLabel: "Kwekwe", province: "Midlands", district: "Kwekwe", latitude: -18.9281, longitude: 29.8148 },
  { locationLabel: "Gokwe", province: "Midlands", district: "Gokwe", latitude: -18.2167, longitude: 28.9333 },
  { locationLabel: "Makokoba, Bulawayo", province: "Bulawayo", district: "Bulawayo Urban", latitude: -20.1486, longitude: 28.5806 },
  { locationLabel: "Hwange", province: "Matabeleland North", district: "Hwange", latitude: -18.3645, longitude: 26.4988 },
  { locationLabel: "Victoria Falls", province: "Matabeleland North", district: "Hwange", latitude: -17.9244, longitude: 25.839 },
  { locationLabel: "Binga", province: "Matabeleland North", district: "Binga", latitude: -17.6272, longitude: 27.3411 },
  { locationLabel: "Gwanda", province: "Matabeleland South", district: "Gwanda", latitude: -20.9333, longitude: 29.0 },
  { locationLabel: "Beitbridge", province: "Matabeleland South", district: "Beitbridge", latitude: -22.2167, longitude: 29.9878 },
  { locationLabel: "Plumtree", province: "Matabeleland South", district: "Bulilima", latitude: -20.4833, longitude: 27.8167 },
];

export type DvsRabiesDemoCase = DvsRabiesSite & {
  status: DvsRabiesCaseStatus;
  species: string;
  vaccinationStatus: string;
  petName: string;
  notes: string;
  daysAgo: number;
};

/** National demonstration outbreak set — real places, plausible DVS surveillance mix. */
export const DVS_RABIES_DEMO_CASES: DvsRabiesDemoCase[] = [
  { ...site("Mbare, Harare"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Stray pack — Mbare Musika", notes: "Confirmed dog rabies; dense communal housing and roaming dogs.", daysAgo: 4 },
  { ...site("Epworth, Harare"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Community dog — Domboramwari", notes: "Bite incident; FAT positive at Central Veterinary Laboratory.", daysAgo: 9 },
  { ...site("Chitungwiza"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Unit L roaming dog", notes: "Neurological signs reported by municipal animal control.", daysAgo: 2 },
  { ...site("Highfield, Harare"), status: "suspected", species: "Cat", vaccinationStatus: "Expired", petName: "Household cat — Engineering", notes: "Unprovoked aggression; awaiting laboratory result.", daysAgo: 6 },
  { ...site("Budiriro, Harare"), status: "negative", species: "Dog", vaccinationStatus: "Vaccinated", petName: "Owned dog — Budiriro 5", notes: "Rule-out after bite report; vaccinated within 12 months.", daysAgo: 12 },
  { ...site("Mutare (Sakubva)"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Sakubva market dog", notes: "Eastern highlands outbreak cluster; confirmed canine rabies.", daysAgo: 7 },
  { ...site("Chipinge"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Communal dog — Gaza", notes: "Wildlife–domestic interface; jackal activity reported nearby.", daysAgo: 3 },
  { ...site("Rusape"), status: "suspected", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Vhengere township dog", notes: "Low vaccination coverage suburb.", daysAgo: 11 },
  { ...site("Nyanga"), status: "negative", species: "Jackal", vaccinationStatus: "Not applicable", petName: "Wildlife sample — Nyanga NP buffer", notes: "Surveillance sample from wildlife buffer; negative.", daysAgo: 18 },
  { ...site("Bindura"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Chipadze dog", notes: "Confirmed; Mashonaland Central rural–urban fringe.", daysAgo: 5 },
  { ...site("Mazowe"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Concession farm dog", notes: "Herd dog with hypersalivation; sample in transit.", daysAgo: 1 },
  { ...site("Guruve"), status: "suspected", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Communal area dog", notes: "Remote ward; limited cold-chain vaccine access.", daysAgo: 8 },
  { ...site("Marondera"), status: "confirmed", species: "Dog", vaccinationStatus: "Expired", petName: "Dombotombo dog", notes: "Certificate expired 14 months; confirmed rabies.", daysAgo: 10 },
  { ...site("Murehwa"), status: "suspected", species: "Goat", vaccinationStatus: "Not vaccinated", petName: "Smallholder goat", notes: "Unusual livestock neurological case under investigation.", daysAgo: 13 },
  { ...site("Chinhoyi"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Cold Storage township dog", notes: "Two bite reports in one week.", daysAgo: 4 },
  { ...site("Kariba"), status: "confirmed", species: "Jackal", vaccinationStatus: "Not applicable", petName: "Wildlife — Nyamhunga fringe", notes: "Wildlife rabies at lakeshore urban interface.", daysAgo: 15 },
  { ...site("Kadoma"), status: "negative", species: "Dog", vaccinationStatus: "Vaccinated", petName: "Rimuka owned dog", notes: "Vaccinated; laboratory negative.", daysAgo: 16 },
  { ...site("Masvingo"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Mucheke dog", notes: "Confirmed canine rabies in high-density suburb.", daysAgo: 6 },
  { ...site("Chiredzi"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Hippo Valley compound dog", notes: "Lowveld outbreak watch; sugar-estate housing.", daysAgo: 3 },
  { ...site("Gutu"), status: "suspected", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Communal dog — Gutu Mission", daysAgo: 9, notes: "Rural Mashonaland–Masvingo corridor." },
  { ...site("Gweru"), status: "negative", species: "Dog", vaccinationStatus: "Vaccinated", petName: "Mkoba 16 dog", notes: "Post-exposure investigation; vaccinated.", daysAgo: 14 },
  { ...site("Kwekwe"), status: "suspected", species: "Cat", vaccinationStatus: "Unknown", petName: "Mbizo cat", notes: "Night-time aggression; sample pending.", daysAgo: 2 },
  { ...site("Gokwe"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Communal dog — Nembudziya", notes: "Confirmed; historically under-vaccinated communal lands.", daysAgo: 8 },
  { ...site("Makokoba, Bulawayo"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Makokoba roaming dog", notes: "Confirmed urban canine rabies in Bulawayo.", daysAgo: 5 },
  { ...site("Hwange"), status: "confirmed", species: "Jackal", vaccinationStatus: "Not applicable", petName: "Wildlife — Hwange NP buffer", notes: "Sylvatic rabies at park–community interface.", daysAgo: 11 },
  { ...site("Victoria Falls"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Chinotimba dog", notes: "Tourism town; stray-dog control underway.", daysAgo: 4 },
  { ...site("Binga"), status: "suspected", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Lakeshore communal dog", notes: "Zambezi valley; delayed sample transport.", daysAgo: 7 },
  { ...site("Gwanda"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Jahunda dog", notes: "Confirmed; Matabeleland South town cluster.", daysAgo: 6 },
  { ...site("Beitbridge"), status: "confirmed", species: "Dog", vaccinationStatus: "Unvaccinated", petName: "Dulibadzimu border dog", notes: "Border town; transboundary dog movement risk.", daysAgo: 3 },
  { ...site("Plumtree"), status: "suspected", species: "Dog", vaccinationStatus: "Unknown", petName: "Plumtree township dog", notes: "Botswana border corridor surveillance.", daysAgo: 12 },
];

function site(locationLabel: string): DvsRabiesSite {
  const found = DVS_RABIES_SITES.find((item) => item.locationLabel === locationLabel);
  if (!found) throw new Error(`Unknown rabies site: ${locationLabel}`);
  return found;
}

export function coordsForRabiesPlace(province?: string, district?: string, locationLabel?: string): DvsRabiesSite | undefined {
  const label = locationLabel?.trim().toLowerCase();
  if (label) {
    const byLabel = DVS_RABIES_SITES.find((item) => item.locationLabel.toLowerCase() === label || item.locationLabel.toLowerCase().includes(label));
    if (byLabel) return byLabel;
  }
  const districtKey = district?.trim().toLowerCase();
  if (districtKey) {
    const byDistrict = DVS_RABIES_SITES.find((item) => item.district.toLowerCase() === districtKey);
    if (byDistrict) return byDistrict;
  }
  const provinceKey = province?.trim().toLowerCase();
  if (provinceKey) {
    return DVS_RABIES_SITES.find((item) => item.province.toLowerCase() === provinceKey);
  }
  return undefined;
}
