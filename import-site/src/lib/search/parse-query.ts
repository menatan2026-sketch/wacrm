/**
 * "I know what I want" — turns a free-text request into structured
 * search criteria. Deterministic and dependency-free on purpose: it runs
 * as you type, and every token it recognises is surfaced back to the user
 * as an editable chip, so nothing is guessed silently.
 *
 * The same function runs server-side for leads, so a request typed into
 * the sourcing form arrives in the CRM already structured.
 */
import { importRules } from "@/config/import-rules";
import type { BodyType, Drivetrain, FuelType, SearchCriteria, Transmission } from "@/domain/types";

export type ParsedToken = {
  field: keyof SearchCriteria;
  label: string;
  value: string;
};

export interface ParsedQuery {
  criteria: Partial<SearchCriteria>;
  tokens: ParsedToken[];
  /** Input left over after recognised phrases are removed. */
  remainder: string;
}

interface ModelAlias {
  make: string;
  model: string;
  aliases: string[];
}

const MAKES: { make: string; aliases: string[] }[] = [
  { make: "Mercedes-AMG", aliases: ["mercedes-amg", "mercedes amg", "amg"] },
  { make: "Mercedes-Benz", aliases: ["mercedes-benz", "mercedes benz", "mercedes", "merc", "benz"] },
  { make: "Mercedes-Maybach", aliases: ["maybach"] },
  { make: "Porsche", aliases: ["porsche"] },
  { make: "Ferrari", aliases: ["ferrari"] },
  { make: "Lamborghini", aliases: ["lamborghini", "lambo"] },
  { make: "Rolls-Royce", aliases: ["rolls-royce", "rolls royce", "rolls"] },
  { make: "Bentley", aliases: ["bentley"] },
  { make: "Land Rover", aliases: ["land rover", "landrover"] },
  { make: "McLaren", aliases: ["mclaren"] },
  { make: "Aston Martin", aliases: ["aston martin", "aston"] },
  { make: "BMW", aliases: ["bmw"] },
  { make: "Audi", aliases: ["audi"] },
  { make: "Toyota", aliases: ["toyota"] },
  { make: "Lexus", aliases: ["lexus"] },
  { make: "Lucid", aliases: ["lucid"] },
  { make: "Ford", aliases: ["ford"] },
  { make: "Cadillac", aliases: ["cadillac"] },
  { make: "Genesis", aliases: ["genesis"] },
  { make: "Maserati", aliases: ["maserati"] },
  { make: "Tesla", aliases: ["tesla"] },
];

const MODELS: ModelAlias[] = [
  { make: "Mercedes-AMG", model: "G 63", aliases: ["g63", "g 63", "g-63", "g wagon", "g-wagon", "g-class", "g class", "gwagon"] },
  { make: "Mercedes-AMG", model: "GT 63 S", aliases: ["gt 63 s", "gt63s", "gt 63", "gt63"] },
  { make: "Mercedes-Maybach", model: "GLS 600", aliases: ["gls 600", "gls600", "maybach gls"] },
  { make: "Porsche", model: "911 GT3 RS", aliases: ["gt3 rs", "gt3rs", "911 gt3 rs"] },
  { make: "Porsche", model: "911 GT3", aliases: ["gt3", "911 gt3"] },
  { make: "Porsche", model: "911", aliases: ["911", "carrera", "turbo s"] },
  { make: "Porsche", model: "Taycan", aliases: ["taycan"] },
  { make: "Porsche", model: "Cayenne", aliases: ["cayenne"] },
  { make: "Ferrari", model: "296 GTB", aliases: ["296", "296 gtb"] },
  { make: "Ferrari", model: "458 Italia", aliases: ["458"] },
  { make: "Ferrari", model: "Purosangue", aliases: ["purosangue"] },
  { make: "Ferrari", model: "Roma", aliases: ["roma"] },
  { make: "Lamborghini", model: "Urus", aliases: ["urus"] },
  { make: "Lamborghini", model: "Revuelto", aliases: ["revuelto"] },
  { make: "Rolls-Royce", model: "Cullinan", aliases: ["cullinan"] },
  { make: "Rolls-Royce", model: "Spectre", aliases: ["spectre"] },
  { make: "Land Rover", model: "Range Rover SV", aliases: ["range rover sv", "rr sv"] },
  { make: "Land Rover", model: "Range Rover", aliases: ["range rover", "rangerover"] },
  { make: "Land Rover", model: "Defender", aliases: ["defender"] },
  { make: "Toyota", model: "Land Cruiser", aliases: ["land cruiser", "landcruiser", "lc300", "lc 300"] },
  { make: "Lexus", model: "LM", aliases: ["lexus lm", "lm 500h", "lm500h"] },
  { make: "Lexus", model: "LX", aliases: ["lx 700h", "lx700h", "lx 600", "lx600"] },
  { make: "Lucid", model: "Air", aliases: ["air sapphire", "lucid air"] },
  { make: "Ford", model: "F-150 Raptor R", aliases: ["raptor r", "f-150 raptor", "f150 raptor", "raptor"] },
  { make: "Cadillac", model: "Escalade", aliases: ["escalade"] },
  { make: "BMW", model: "M5", aliases: ["m5"] },
  { make: "Audi", model: "RS 6", aliases: ["rs6", "rs 6"] },
];

const COLORS: { value: string; aliases: string[] }[] = [
  { value: "black", aliases: ["black", "obsidian", "nero", "noir"] },
  { value: "white", aliases: ["white", "bianco", "pearl white"] },
  { value: "grey", aliases: ["grey", "gray", "graphite", "grigio", "titanium", "arctic grey"] },
  { value: "silver", aliases: ["silver", "argento"] },
  { value: "blue", aliases: ["blue", "blu", "azzurro", "navy"] },
  { value: "red", aliases: ["red", "rosso"] },
  { value: "green", aliases: ["green", "verde", "racing green"] },
  { value: "yellow", aliases: ["yellow", "giallo"] },
  { value: "orange", aliases: ["orange", "arancio"] },
  { value: "gold", aliases: ["gold", "champagne"] },
  { value: "brown", aliases: ["brown", "bronze"] },
];

const FUELS: { value: FuelType; aliases: string[] }[] = [
  { value: "plug-in-hybrid", aliases: ["plug-in hybrid", "plug in hybrid", "plug-in", "phev"] },
  { value: "electric", aliases: ["electric", "ev", "bev", "battery electric"] },
  { value: "hybrid", aliases: ["hybrid"] },
  { value: "diesel", aliases: ["diesel"] },
  { value: "petrol", aliases: ["petrol", "gasoline", "gas", "benzine"] },
];

const BODIES: { value: BodyType; aliases: string[] }[] = [
  { value: "suv", aliases: ["suv", "4x4 suv", "jeep"] },
  { value: "coupe", aliases: ["coupe", "coupé"] },
  { value: "sedan", aliases: ["sedan", "saloon"] },
  { value: "wagon", aliases: ["wagon", "estate", "avant", "touring"] },
  { value: "pickup", aliases: ["pickup", "pick-up", "truck"] },
  { value: "convertible", aliases: ["convertible", "cabrio", "cabriolet", "spider", "spyder", "roadster"] },
  { value: "supercar", aliases: ["supercar", "hypercar"] },
];

const DRIVES: { value: Drivetrain; aliases: string[] }[] = [
  { value: "4wd", aliases: ["4x4", "4wd"] },
  { value: "awd", aliases: ["awd", "all wheel drive", "all-wheel drive", "quattro", "4matic", "xdrive"] },
  { value: "rwd", aliases: ["rwd", "rear wheel drive", "rear-wheel drive"] },
];

const TRANSMISSIONS: { value: Transmission; aliases: string[] }[] = [
  { value: "manual", aliases: ["manual", "stick", "gearstick"] },
  { value: "dual-clutch", aliases: ["pdk", "dct", "dual clutch", "dual-clutch"] },
  { value: "automatic", aliases: ["automatic", "auto"] },
];

const COUNTRIES: { code: string; aliases: string[] }[] = [
  { code: "DE", aliases: ["germany", "german", "from de"] },
  { code: "IT", aliases: ["italy", "italian"] },
  { code: "GB", aliases: ["uk", "united kingdom", "england", "britain", "british"] },
  { code: "US", aliases: ["usa", "united states", "america", "american", "u.s."] },
  { code: "AE", aliases: ["dubai", "uae", "emirates", "abu dhabi", "gcc"] },
  { code: "JP", aliases: ["japan", "japanese"] },
  { code: "KR", aliases: ["korea", "korean"] },
];

const SPECS: { value: string; label: string; aliases: string[] }[] = [
  { value: "full-spec", label: "Full specification", aliases: ["full specification", "full spec", "fully loaded", "full option", "full options", "top spec", "loaded"] },
  { value: "low-mileage", label: "Low mileage", aliases: [] },
  { value: "carbon", label: "Carbon package", aliases: ["carbon"] },
  { value: "burmester", label: "Burmester sound", aliases: ["burmester"] },
  { value: "night-package", label: "Night package", aliases: ["night package", "night pack"] },
  { value: "massage", label: "Massage seats", aliases: ["massage"] },
  { value: "rear-entertainment", label: "Rear entertainment", aliases: ["rear entertainment", "rear screens"] },
  { value: "ceramic-brakes", label: "Ceramic brakes", aliases: ["ceramic", "ceramic brakes", "pccb", "carbon ceramic"] },
  { value: "weissach", label: "Weissach package", aliases: ["weissach"] },
  { value: "lift", label: "Front-axle lift", aliases: ["lift", "lifter", "nose lift"] },
  { value: "lhd", label: "Left-hand drive", aliases: ["lhd", "left hand drive", "left-hand drive"] },
  { value: "off-road", label: "Off-road pack", aliases: ["off-road", "offroad", "diff locks", "diff lock"] },
];

const LOW_MILEAGE_KM = 20_000;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary match that also works around hyphens and digits. */
function findAlias(text: string, alias: string): RegExpMatchArray | null {
  const re = new RegExp(`(^|[^a-z0-9])(${escape(alias)})(?=$|[^a-z0-9])`, "i");
  return text.match(re);
}

function parseAmount(num: string, suffix: string | undefined): number {
  const n = parseFloat(num.replace(/,/g, ""));
  const s = (suffix ?? "").toLowerCase();
  if (s.startsWith("m")) return n * 1_000_000;
  if (s === "k" || s.startsWith("thousand")) return n * 1_000;
  return n;
}

export function parseQuery(input: string): ParsedQuery {
  let text = ` ${input.toLowerCase().replace(/\s+/g, " ")} `;
  const criteria: Partial<SearchCriteria> = {};
  const tokens: ParsedToken[] = [];
  const spec = new Set<string>();

  const consume = (match: string) => {
    text = text.replace(match, " ");
  };

  // Budget — before years so "1.2M" isn't read as anything else.
  const budgetRe =
    /(under|below|up to|upto|max(?:imum)?|less than|budget(?: of)?|within|<)\s*(₪|€|\$|£|nis|ils|eur|usd|gbp)?\s*([\d.,]+)\s*(m\b|mil\b|million\b|k\b|thousand\b)?\s*(₪|€|\$|£|nis|ils|shekels?|eur(?:os?)?|usd|dollars?|gbp|pounds?)?/i;
  const b = text.match(budgetRe);
  if (b) {
    const amount = parseAmount(b[3], b[4]);
    const cur = (b[2] ?? b[5] ?? "₪").toLowerCase();
    let rate = 1;
    if (cur.startsWith("€") || cur.startsWith("eur")) rate = importRules.exchangeRates.EUR;
    else if (cur.startsWith("$") || cur.startsWith("usd") || cur.startsWith("dollar")) rate = importRules.exchangeRates.USD;
    else if (cur.startsWith("£") || cur.startsWith("gbp") || cur.startsWith("pound")) rate = importRules.exchangeRates.GBP;
    const ils = Math.round(amount * rate);
    // Guard against "under 20,000 km" being read as a budget.
    const tail = text.slice((b.index ?? 0) + b[0].length, (b.index ?? 0) + b[0].length + 4);
    if (!/^\s*km/.test(tail) && amount >= 10_000) {
      criteria.budgetMaxILS = ils;
      tokens.push({ field: "budgetMaxILS", label: "Budget", value: `≤ ₪${ils.toLocaleString("en-US")}` });
      consume(b[0]);
    }
  }

  // Mileage
  const kmRe = /(under|below|less than|max(?:imum)?|up to|<)?\s*([\d.,]+)\s*(k)?\s*(km|kilometers|kilometres|miles|mi)\b/i;
  const km = text.match(kmRe);
  if (km) {
    let value = parseAmount(km[2], km[3]);
    if (/mi/.test(km[4])) value = Math.round(value * 1.609);
    criteria.mileageMaxKm = value;
    tokens.push({ field: "mileageMaxKm", label: "Mileage", value: `≤ ${value.toLocaleString("en-US")} km` });
    consume(km[0]);
  } else {
    const low = text.match(/(low|minimal|very low)\s*(mileage|km|miles)|delivery mileage|like new|as new/i);
    if (low) {
      criteria.mileageMaxKm = LOW_MILEAGE_KM;
      spec.add("low-mileage");
      tokens.push({ field: "mileageMaxKm", label: "Mileage", value: `Low · ≤ ${LOW_MILEAGE_KM.toLocaleString("en-US")} km` });
      consume(low[0]);
    }
  }

  // Years: ranges, "2023+", "from 2022", single years.
  const range = text.match(/\b(19[89]\d|20[0-4]\d)\s*(?:-|–|to)\s*(19[89]\d|20[0-4]\d)\b/);
  const plus = text.match(/\b(?:from|newer than|after|since)?\s*(19[89]\d|20[0-4]\d)\s*(\+|or newer|and newer|onwards)/);
  const from = text.match(/\b(?:from|newer than|after|since)\s+(19[89]\d|20[0-4]\d)\b/);
  const single = text.match(/\b(19[89]\d|20[0-4]\d)\b/);
  if (range) {
    criteria.yearMin = +range[1];
    criteria.yearMax = +range[2];
    tokens.push({ field: "yearMin", label: "Year", value: `${range[1]}–${range[2]}` });
    consume(range[0]);
  } else if (plus || from) {
    const y = +(plus ?? from)![1];
    criteria.yearMin = y;
    tokens.push({ field: "yearMin", label: "Year", value: `${y}+` });
    consume((plus ?? from)![0]);
  } else if (single) {
    criteria.yearMin = +single[1];
    criteria.yearMax = +single[1];
    tokens.push({ field: "yearMin", label: "Year", value: single[1] });
    consume(single[0]);
  }

  // Model first (it implies the make), longest aliases first.
  const models = MODELS.flatMap((m) => m.aliases.map((a) => ({ ...m, alias: a }))).sort(
    (x, y) => y.alias.length - x.alias.length,
  );
  for (const m of models) {
    const hit = findAlias(text, m.alias);
    if (hit) {
      criteria.model = m.model;
      criteria.make = m.make;
      consume(hit[2]);
      break;
    }
  }
  const makes = MAKES.flatMap((m) => m.aliases.map((a) => ({ ...m, alias: a }))).sort(
    (x, y) => y.alias.length - x.alias.length,
  );
  for (const m of makes) {
    const hit = findAlias(text, m.alias);
    if (hit) {
      // "mercedes g63" → keep the AMG make implied by the model.
      if (!criteria.make || !criteria.make.startsWith(m.make.split("-")[0])) criteria.make = m.make;
      consume(hit[2]);
      break;
    }
  }
  if (criteria.make) tokens.unshift({ field: "make", label: "Make", value: criteria.make });
  if (criteria.model) tokens.splice(1, 0, { field: "model", label: "Model", value: criteria.model });

  const pick = <T extends string>(
    list: { value: T; aliases: string[] }[],
    field: keyof SearchCriteria,
    label: string,
    display: (v: T) => string = (v) => v,
  ) => {
    for (const item of list) {
      for (const alias of [...item.aliases].sort((a, b) => b.length - a.length)) {
        const hit = findAlias(text, alias);
        if (hit) {
          (criteria as Record<string, unknown>)[field] = item.value;
          tokens.push({ field, label, value: display(item.value) });
          consume(hit[2]);
          return;
        }
      }
    }
  };

  pick(FUELS, "fuel", "Fuel");
  pick(BODIES, "bodyType", "Body");
  pick(DRIVES, "drivetrain", "Drive", (v) => v.toUpperCase());
  pick(TRANSMISSIONS, "transmission", "Gearbox");
  pick(COLORS, "color", "Colour");

  for (const c of COUNTRIES) {
    const hit = c.aliases.map((a) => findAlias(text, a)).find(Boolean);
    if (hit) {
      criteria.countryCode = c.code;
      tokens.push({ field: "countryCode", label: "From", value: c.code });
      consume(hit[2]);
      break;
    }
  }

  for (const s of SPECS) {
    for (const alias of s.aliases) {
      const hit = findAlias(text, alias);
      if (hit) {
        spec.add(s.value);
        consume(hit[2]);
        break;
      }
    }
  }
  if (spec.size) {
    criteria.spec = [...spec];
    for (const v of spec) {
      if (v === "low-mileage") continue;
      tokens.push({ field: "spec", label: "Spec", value: SPECS.find((s) => s.value === v)?.label ?? v });
    }
  }

  const remainder = text
    .replace(/\b(a|an|the|with|and|in|for|i want|looking for|want|need|colou?r|please|nis|ils|shekels?)\b/g, " ")
    .replace(/[,.;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { criteria, tokens, remainder };
}

export const specLabels = Object.fromEntries(SPECS.map((s) => [s.value, s.label])) as Record<string, string>;
export const knownMakes = [...new Set(MAKES.map((m) => m.make))];
export const colorFamilies = COLORS.map((c) => c.value);

/** Maps a paint name ("Grigio Keres Matt") to a colour family ("grey"). */
export function colorFamily(paintName: string): string | undefined {
  const lower = paintName.toLowerCase();
  for (const c of COLORS) if (c.aliases.some((a) => lower.includes(a))) return c.value;
  if (/sapphire|salamanca|nocturne/.test(lower)) return "blue";
  if (/belgravia/.test(lower)) return "green";
  if (/selenite|keres|ice|sonic|agate/.test(lower)) return lower.includes("agate") ? "black" : "grey";
  return undefined;
}
