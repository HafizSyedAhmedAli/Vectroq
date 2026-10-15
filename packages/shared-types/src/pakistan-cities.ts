// packages/shared-types/src/pakistan-cities.ts
//
// Every city/town TM CC can take a lead in. One registry feeds:
//  - the intake / convert-lead dropdowns (grouped by province),
//  - lead validation,
//  - the rate search (aliases + nearby-market ladder, see searchPlacesFor).
//
// To add a place, add its name to the right province array below. If it is
// known by another name, add it to ALIASES. If a bigger market than the
// province default is closer, add it to NEARBY_HUB.

export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
] as const;
export type Province = (typeof PROVINCES)[number];

const BY_PROVINCE: Record<Province, readonly string[]> = {
  Punjab: [
    "Ahmadpur East",
    "Arifwala",
    "Attock",
    "Bahawalnagar",
    "Bahawalpur",
    "Bhakkar",
    "Bhalwal",
    "Burewala",
    "Chakwal",
    "Chiniot",
    "Chishtian",
    "Daska",
    "Dera Ghazi Khan",
    "Depalpur",
    "Faisalabad",
    "Fateh Jang",
    "Gojra",
    "Gujar Khan",
    "Gujranwala",
    "Gujrat",
    "Hafizabad",
    "Haroonabad",
    "Hasilpur",
    "Jampur",
    "Jaranwala",
    "Jhang",
    "Jhelum",
    "Kamalia",
    "Kamoke",
    "Kasur",
    "Khanewal",
    "Khanpur",
    "Kharian",
    "Khushab",
    "Kot Addu",
    "Lahore",
    "Lalamusa",
    "Layyah",
    "Liaquatpur",
    "Lodhran",
    "Mailsi",
    "Mandi Bahauddin",
    "Mianwali",
    "Multan",
    "Muridke",
    "Murree",
    "Muzaffargarh",
    "Nankana Sahib",
    "Narowal",
    "Okara",
    "Pakpattan",
    "Pattoki",
    "Pind Dadan Khan",
    "Rahim Yar Khan",
    "Rajanpur",
    "Rawalpindi",
    "Sadiqabad",
    "Sahiwal",
    "Samundri",
    "Sargodha",
    "Sheikhupura",
    "Shorkot",
    "Sialkot",
    "Tandlianwala",
    "Taxila",
    "Toba Tek Singh",
    "Vehari",
    "Wah Cantonment",
    "Wazirabad",
  ],
  Sindh: [
    "Badin",
    "Dadu",
    "Daharki",
    "Digri",
    "Gambat",
    "Ghotki",
    "Hala",
    "Hyderabad",
    "Jacobabad",
    "Jamshoro",
    "Kandhkot",
    "Karachi",
    "Kashmore",
    "Khairpur",
    "Khipro",
    "Kotri",
    "Kunri",
    "Larkana",
    "Matiari",
    "Mehar",
    "Mirpur Khas",
    "Mithi",
    "Moro",
    "Naushahro Feroze",
    "Nawabshah",
    "Pano Aqil",
    "Qambar",
    "Ratodero",
    "Rohri",
    "Sakrand",
    "Sanghar",
    "Sehwan",
    "Shahdadkot",
    "Shikarpur",
    "Sujawal",
    "Sukkur",
    "Tando Adam",
    "Tando Allahyar",
    "Tando Muhammad Khan",
    "Thatta",
    "Umerkot",
  ],
  "Khyber Pakhtunkhwa": [
    "Abbottabad",
    "Balakot",
    "Bannu",
    "Batkhela",
    "Battagram",
    "Buner",
    "Charsadda",
    "Chitral",
    "Dera Ismail Khan",
    "Dir",
    "Hangu",
    "Haripur",
    "Havelian",
    "Jehangira",
    "Kohat",
    "Karak",
    "Khar",
    "Lakki Marwat",
    "Landi Kotal",
    "Mansehra",
    "Mardan",
    "Mingora",
    "Miran Shah",
    "Nowshera",
    "Parachinar",
    "Peshawar",
    "Risalpur",
    "Shangla",
    "Swabi",
    "Tank",
    "Timergara",
    "Topi",
    "Wana",
  ],
  Balochistan: [
    "Bela",
    "Chaman",
    "Dalbandin",
    "Dera Allah Yar",
    "Dera Murad Jamali",
    "Gwadar",
    "Hub",
    "Jaffarabad",
    "Kalat",
    "Kharan",
    "Khuzdar",
    "Kohlu",
    "Loralai",
    "Mastung",
    "Nushki",
    "Panjgur",
    "Pishin",
    "Quetta",
    "Sibi",
    "Turbat",
    "Usta Muhammad",
    "Uthal",
    "Zhob",
    "Ziarat",
  ],
  "Islamabad Capital Territory": ["Islamabad"],
  "Gilgit-Baltistan": [
    "Astore",
    "Chilas",
    "Gahkuch",
    "Gilgit",
    "Karimabad",
    "Khaplu",
    "Skardu",
  ],
  "Azad Jammu & Kashmir": [
    "Athmuqam",
    "Bagh",
    "Bhimber",
    "Kotli",
    "Mirpur",
    "Muzaffarabad",
    "Rawalakot",
  ],
};

// Other names people (and rate sites) use for the same place.
const ALIASES: Record<string, readonly string[]> = {
  Nawabshah: ["Shaheed Benazirabad", "Benazirabad", "Nawab Shah"],
  Qambar: ["Kamber", "Qambar Shahdadkot"],
  Mingora: ["Swat"],
  Khar: ["Bajaur"],
  "Dera Ismail Khan": ["D.I. Khan", "DI Khan", "D I Khan"],
  "Dera Ghazi Khan": ["D.G. Khan", "DG Khan", "D G Khan"],
  "Rahim Yar Khan": ["RYK", "R.Y. Khan"],
  Rawalpindi: ["Pindi"],
  "Wah Cantonment": ["Wah Cantt", "Wah"],
  "Toba Tek Singh": ["TT Singh"],
  Mithi: ["Tharparkar"],
  Karimabad: ["Hunza"],
  Khaplu: ["Ghanche"],
  Gahkuch: ["Ghizer"],
  Uthal: ["Lasbela"],
  Jaffarabad: ["Jafarabad"],
};

// The bigger market whose published rates are the best stand-in when a small
// town has none of its own. Anything not listed falls back to PROVINCE_HUBS.
const NEARBY_HUB: Record<string, readonly string[]> = {
  Nawabshah: ["Hyderabad", "Sukkur"],
  Sanghar: ["Hyderabad", "Nawabshah"],
  Khairpur: ["Sukkur", "Larkana"],
  Larkana: ["Sukkur"],
  Jacobabad: ["Sukkur", "Larkana"],
  Shikarpur: ["Sukkur", "Larkana"],
  Ghotki: ["Sukkur", "Rahim Yar Khan"],
  "Mirpur Khas": ["Hyderabad"],
  Badin: ["Hyderabad"],
  Thatta: ["Karachi", "Hyderabad"],
  Umerkot: ["Mirpur Khas", "Hyderabad"],
  Sujawal: ["Karachi", "Hyderabad"],
  Hub: ["Karachi", "Quetta"],
  Gwadar: ["Karachi", "Quetta"],
  Turbat: ["Karachi", "Quetta"],
  Murree: ["Rawalpindi", "Islamabad"],
  Taxila: ["Rawalpindi", "Islamabad"],
  "Wah Cantonment": ["Rawalpindi", "Islamabad"],
  Abbottabad: ["Islamabad", "Peshawar"],
  Haripur: ["Islamabad", "Peshawar"],
  Mansehra: ["Peshawar", "Islamabad"],
  Skardu: ["Gilgit", "Islamabad"],
  Mirpur: ["Islamabad", "Lahore"],
  Bhimber: ["Lahore", "Islamabad"],
};

const PROVINCE_HUBS: Record<Province, readonly string[]> = {
  Punjab: ["Lahore", "Rawalpindi"],
  Sindh: ["Karachi", "Hyderabad"],
  "Khyber Pakhtunkhwa": ["Peshawar"],
  Balochistan: ["Quetta"],
  "Islamabad Capital Territory": ["Islamabad"],
  "Gilgit-Baltistan": ["Gilgit", "Islamabad"],
  "Azad Jammu & Kashmir": ["Muzaffarabad", "Islamabad"],
};

export interface PakistanCity {
  name: string;
  province: Province;
  aliases: readonly string[];
}

export const PAKISTAN_CITIES: readonly PakistanCity[] = PROVINCES.flatMap(
  (province) =>
    [...BY_PROVINCE[province]]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, province, aliases: ALIASES[name] ?? [] })),
);

export const CITY_NAMES: readonly string[] = PAKISTAN_CITIES.map(
  (c) => c.name,
).sort((a, b) => a.localeCompare(b, "en"));

const norm = (s: string) =>
  s.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

const LOOKUP = new Map<string, PakistanCity>();
for (const c of PAKISTAN_CITIES) {
  LOOKUP.set(norm(c.name), c);
  for (const a of c.aliases) LOOKUP.set(norm(a), c);
}

/** Case/spacing-insensitive lookup by name or alias. */
export function findCity(
  input: string | undefined | null,
): PakistanCity | undefined {
  return input ? LOOKUP.get(norm(input)) : undefined;
}

/** "benazirabad" -> "Nawabshah". undefined when the place is not in the registry. */
export const canonicalCityName = (input: string | undefined | null) =>
  findCity(input)?.name;

/** Dropdown data: [{ province, cities }] in province order. */
export function citiesByProvince(): { province: Province; cities: string[] }[] {
  return PROVINCES.map((province) => ({
    province,
    cities: PAKISTAN_CITIES.filter((c) => c.province === province).map(
      (c) => c.name,
    ),
  }));
}

/**
 * Where the rate search should look, most local first:
 *   the city itself (with its other names) -> nearby bigger markets ->
 *   the province's main markets -> Pakistan-wide.
 * A place not in the registry is searched as typed, then Pakistan-wide.
 */
export function searchPlacesFor(cityInput: string): string[] {
  const typed = cityInput.trim();
  const city = findCity(typed);
  if (!city) return [`${typed}, Pakistan`, "Pakistan (national average)"];

  const alt = city.aliases.filter((a) => a.length > 3);
  const self =
    alt.length > 0
      ? `${city.name} (also called ${alt.join(" / ")}), ${city.province}`
      : `${city.name}, ${city.province}`;

  const hubs = [
    ...(NEARBY_HUB[city.name] ?? []),
    ...PROVINCE_HUBS[city.province],
  ].filter((h) => h !== city.name);

  return [
    self,
    ...[...new Set(hubs)].map((h) => {
      const hc = findCity(h);
      return hc ? `${hc.name}, ${hc.province}` : h;
    }),
    "Pakistan (national average)",
  ];
}
