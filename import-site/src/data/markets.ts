import type { Market } from "@/domain/types";

/** Israel — the destination every route resolves to. */
export const DESTINATION = {
  code: "IL",
  name: "Israel",
  hub: "Haifa · Ashdod",
  lat: 32.08,
  lng: 34.78,
} as const;

export const markets: Market[] = [
  {
    code: "DE",
    name: "Germany",
    hub: "Bremerhaven",
    lat: 51.2,
    lng: 10.4,
    currency: "EUR",
    typicalMarket: "Europe's deepest premium used-car market — dealer-maintained and well documented.",
    advantages: [
      "EU origin — 0% customs duty under the EU–Israel agreement",
      "Deep stock of AMG, Porsche, BMW M and Audi RS",
      "Digital service histories and a strict inspection culture",
    ],
    exampleVehicles: ["Mercedes-AMG G 63", "Porsche 911 GT3 RS", "Porsche Taycan Turbo GT"],
    transitDays: [21, 35],
    shipping: ["roro", "container"],
  },
  {
    code: "IT",
    name: "Italy",
    hub: "Genoa",
    lat: 44.4,
    lng: 11.0,
    currency: "EUR",
    typicalMarket: "Maranello and Sant'Agata specifications, often with factory-documented provenance.",
    advantages: [
      "Shortest Mediterranean crossing to Haifa and Ashdod",
      "Official-dealer allocations and factory-fresh cars",
      "EU origin — 0% customs duty",
    ],
    exampleVehicles: ["Ferrari 296 GTB", "Lamborghini Revuelto", "Maserati MC20"],
    transitDays: [14, 24],
    shipping: ["roro", "container"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    hub: "Southampton",
    lat: 52.4,
    lng: -1.5,
    currency: "GBP",
    typicalMarket: "Bespoke luxury and British marques, with a strong enthusiast market.",
    advantages: [
      "Rolls-Royce, Bentley, Land Rover SV and McLaren supply",
      "Left-hand-drive export builds only — Israeli registration requires LHD",
      "UK–Israel trade agreement on qualifying vehicles",
    ],
    exampleVehicles: ["Range Rover SV", "Rolls-Royce Cullinan", "Bentley Continental GT"],
    transitDays: [24, 40],
    shipping: ["roro", "container"],
  },
  {
    code: "US",
    name: "United States",
    hub: "Baltimore",
    lat: 39.3,
    lng: -95.7,
    currency: "USD",
    typicalMarket: "Full-size trucks, EVs and American performance you won't find locally.",
    advantages: [
      "US–Israel free-trade agreement",
      "Models not sold in Israel — Raptor R, Lucid Air, Escalade-V",
      "Transparent VIN-based history reporting",
    ],
    exampleVehicles: ["Ford F-150 Raptor R", "Lucid Air Sapphire", "Cadillac Escalade-V"],
    transitDays: [35, 55],
    shipping: ["roro", "container"],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    hub: "Jebel Ali",
    lat: 24.6,
    lng: 54.6,
    currency: "AED",
    typicalMarket: "GCC-specification luxury SUVs and supercars, often with very low mileage.",
    advantages: [
      "GCC-spec cooling and climate packages",
      "Israel–UAE trade agreement",
      "The fastest sea transit of any major market",
    ],
    exampleVehicles: ["Lamborghini Urus SE", "Toyota Land Cruiser 300", "Mercedes-Maybach GLS"],
    transitDays: [10, 20],
    shipping: ["roro", "container", "air"],
  },
  {
    code: "JP",
    name: "Japan",
    hub: "Yokohama",
    lat: 36.2,
    lng: 138.3,
    currency: "JPY",
    typicalMarket: "Meticulously maintained vehicles and Japan-built export models.",
    advantages: [
      "Graded auction reports with detailed condition maps",
      "Export-spec left-hand-drive Lexus and Toyota models",
      "Right-hand-drive domestic models filtered out up front",
    ],
    exampleVehicles: ["Lexus LM 500h", "Lexus LX 700h", "Toyota GR Supra"],
    transitDays: [35, 50],
    shipping: ["container"],
  },
  {
    code: "KR",
    name: "South Korea",
    hub: "Busan",
    lat: 36.4,
    lng: 127.9,
    currency: "KRW",
    typicalMarket: "Flagship Korean luxury and high-performance EVs.",
    advantages: [
      "Korea–Israel free-trade agreement",
      "Top-trim Genesis and N models with full options",
      "Short supply chains to the factory",
    ],
    exampleVehicles: ["Genesis G90", "Hyundai Ioniq 5 N", "Kia EV9 GT"],
    transitDays: [30, 45],
    shipping: ["roro", "container"],
  },
];

export function getMarket(code: string) {
  return markets.find((m) => m.code === code);
}

export function marketName(code: string) {
  return getMarket(code)?.name ?? code;
}
