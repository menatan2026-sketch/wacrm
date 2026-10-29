import { schema, uuidv7, eq, sql, type Db } from "@mfg/db";
import { DEFAULT_FDM_RULES } from "./modules/pricing/rules";
import { DEFAULT_ROUTING_WEIGHTS } from "./modules/routing/engine";
import { FLAG_KEYS } from "./platform/flags";

const i18n = (en: string, he: string, ru: string, d?: [string, string, string]) => ({
  en: { name: en, ...(d ? { description: d[0] } : {}) },
  he: { name: he, ...(d ? { description: d[1] } : {}) },
  ru: { name: ru, ...(d ? { description: d[2] } : {}) },
});

const PROCESSES = [
  {
    code: "FDM",
    status: "active",
    sort: 1,
    i18n: i18n("3D printing (FDM)", "הדפסת תלת־ממד (FDM)", "3D-печать (FDM)"),
  },
  {
    code: "SLA",
    status: "inactive",
    sort: 2,
    i18n: i18n("Resin printing (SLA)", "הדפסת שרף (SLA)", "Печать смолой (SLA)"),
  },
  {
    code: "SLS",
    status: "inactive",
    sort: 3,
    i18n: i18n("Powder printing (SLS)", "הדפסת אבקה (SLS)", "Порошковая печать (SLS)"),
  },
  {
    code: "CNC",
    status: "inactive",
    sort: 4,
    i18n: i18n("CNC machining", "עיבוד שבבי CNC", "Фрезеровка ЧПУ"),
  },
  {
    code: "LASER",
    status: "inactive",
    sort: 5,
    i18n: i18n("Laser cutting", "חיתוך לייזר", "Лазерная резка"),
  },
  {
    code: "SHEET_METAL",
    status: "inactive",
    sort: 6,
    i18n: i18n("Sheet metal", "עיבוד פח", "Листовой металл"),
  },
  {
    code: "METAL_AM",
    status: "inactive",
    sort: 7,
    i18n: i18n("Metal 3D printing", "הדפסת מתכת", "3D-печать металлом"),
  },
] as const;

const COLORS = {
  black: ["#1B1F24", "Black", "שחור", "Чёрный"],
  white: ["#F4F5F7", "White", "לבן", "Белый"],
  gray: ["#8E97A3", "Gray", "אפור", "Серый"],
  red: ["#C8312B", "Red", "אדום", "Красный"],
  blue: ["#1F4FE0", "Blue", "כחול", "Синий"],
} as const;
type Color = keyof typeof COLORS;

const MATERIALS: {
  code: string;
  density: number;
  temp: number;
  uv: number;
  moisture: number;
  flex: "rigid" | "slight" | "rubber";
  strength: number;
  cost: number;
  colors: Color[];
  i18n: ReturnType<typeof i18n>;
}[] = [
  {
    code: "PLA",
    density: 1.24,
    temp: 52,
    uv: 1,
    moisture: 2,
    flex: "rigid",
    strength: 2,
    cost: 1,
    colors: ["black", "white", "gray", "red", "blue"],
    i18n: i18n("PLA", "PLA", "PLA", [
      "Everyday rigid plastic for indoor parts.",
      "פלסטיק קשיח לשימוש יומיומי בתוך הבית.",
      "Жёсткий пластик для деталей в помещении.",
    ]),
  },
  {
    code: "PETG",
    density: 1.27,
    temp: 70,
    uv: 2,
    moisture: 3,
    flex: "slight",
    strength: 3,
    cost: 1,
    colors: ["black", "white", "gray"],
    i18n: i18n("PETG", "PETG", "PETG", [
      "Tough, slightly flexible, handles water and sun.",
      "חזק, מעט גמיש, עמיד במים ובשמש.",
      "Прочный, слегка гибкий, не боится воды и солнца.",
    ]),
  },
  {
    code: "ABS",
    density: 1.04,
    temp: 90,
    uv: 1,
    moisture: 2,
    flex: "rigid",
    strength: 3,
    cost: 2,
    colors: ["black", "white"],
    i18n: i18n("ABS", "ABS", "ABS", [
      "Heat-resistant engineering plastic for indoor use.",
      "פלסטיק הנדסי עמיד בחום לשימוש פנימי.",
      "Термостойкий инженерный пластик для помещений.",
    ]),
  },
  {
    code: "ASA",
    density: 1.07,
    temp: 90,
    uv: 3,
    moisture: 3,
    flex: "rigid",
    strength: 3,
    cost: 2,
    colors: ["black", "white", "gray"],
    i18n: i18n("ASA", "ASA", "ASA", [
      "Outdoor and car parts: heat and UV resistant.",
      "לחלקים בחוץ וברכב: עמיד בחום ובקרינת UV.",
      "Для улицы и автомобиля: стойкий к жаре и УФ.",
    ]),
  },
  {
    code: "TPU_95A",
    density: 1.21,
    temp: 60,
    uv: 2,
    moisture: 3,
    flex: "rubber",
    strength: 2,
    cost: 3,
    colors: ["black", "white"],
    i18n: i18n("Flexible TPU", "TPU גמיש", "Гибкий TPU", [
      "Rubber-like: gaskets, bumpers, grips.",
      "דמוי גומי: אטמים, בולמים, אחיזות.",
      "Резиноподобный: прокладки, демпферы, ручки.",
    ]),
  },
  {
    code: "PA_CF",
    density: 1.15,
    temp: 120,
    uv: 2,
    moisture: 1,
    flex: "rigid",
    strength: 5,
    cost: 4,
    colors: ["black"],
    i18n: i18n("Carbon nylon (PA-CF)", "ניילון פחמן (PA-CF)", "Карбон-нейлон (PA-CF)", [
      "Very strong and stiff for load-bearing parts.",
      "חזק וקשיח מאוד לחלקים נושאי עומס.",
      "Очень прочный и жёсткий для нагруженных деталей.",
    ]),
  },
];

const PROFILES = [
  { code: "draft", layerHeightMm: 0.28, wallThicknessMm: 0.8, infill: 0.15, sort: 1 },
  { code: "standard", layerHeightMm: 0.2, wallThicknessMm: 1.2, infill: 0.2, sort: 2 },
  { code: "fine", layerHeightMm: 0.12, wallThicknessMm: 1.6, infill: 0.25, sort: 3 },
];

/** Idempotent reference data: catalog, rules, VAT, flags. Values are placeholders (KI-003). */
export async function seedReference(db: Db): Promise<void> {
  for (const p of PROCESSES) await db.insert(schema.processes).values(p).onConflictDoNothing();
  for (const [i, m] of MATERIALS.entries()) {
    const [existing] = await db
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.code, m.code));
    const materialId = existing?.id ?? uuidv7();
    if (!existing) {
      await db.insert(schema.materials).values({
        id: materialId,
        code: m.code,
        processCode: "FDM",
        densityGCm3: m.density,
        maxServiceTempC: m.temp,
        uvResistance: m.uv,
        moistureResistance: m.moisture,
        flexibility: m.flex,
        strengthIndex: m.strength,
        costTier: m.cost,
        sort: i + 1,
        i18n: m.i18n,
      });
    }
    for (const [j, c] of m.colors.entries()) {
      const [hex, en, he, ru] = COLORS[c];
      await db
        .insert(schema.materialVariants)
        .values({
          id: uuidv7(),
          materialId,
          colorCode: c,
          colorHex: hex,
          sort: j,
          i18n: i18n(en, he, ru),
        })
        .onConflictDoNothing();
    }
  }
  for (const p of PROFILES)
    await db
      .insert(schema.qualityProfiles)
      .values({ ...p, processCode: "FDM" })
      .onConflictDoNothing();
  const [rules] = await db.select().from(schema.pricingRuleSets).limit(1);
  if (!rules)
    await db.insert(schema.pricingRuleSets).values({
      id: uuidv7(),
      processCode: "FDM",
      version: 1,
      status: "active",
      rules: DEFAULT_FDM_RULES,
      activatedAt: new Date(),
    });
  const [vat] = await db.select().from(schema.taxRates).limit(1);
  if (!vat)
    await db.insert(schema.taxRates).values({
      id: uuidv7(),
      country: "IL",
      kind: "vat",
      rateBps: 1800,
      effectiveFrom: "2025-01-01",
    });
  const [routing] = await db.select().from(schema.routingRuleSets).limit(1);
  if (!routing)
    await db.insert(schema.routingRuleSets).values({
      id: uuidv7(),
      version: 1,
      status: "active",
      weights: { ...DEFAULT_ROUTING_WEIGHTS },
      config: { offerHours: { standard: 4, fast: 2, urgent: 1 } },
      activatedAt: new Date(),
    });
  const descriptions: Record<string, string> = {
    AI_INTAKE: "AI-assisted intake for object/idea requests (Phase 6)",
    AUTO_PRICING: "Instant automatic quotes for file uploads",
    AUTO_ROUTING: "Send offers to the top-ranked supplier without ops confirmation",
    AUTOMATED_QC: "Automated QC assists (Phase 9)",
    B2B_SUBSCRIPTIONS: "B2B plans and subscriptions (Phase 8)",
    ADVANCED_MODE: "Technical settings for expert customers",
    STEP_UPLOADS: "Accept STEP/STP uploads (pending spike)",
    SMS_NOTIFICATIONS: "SMS notifications (pending vendor)",
  };
  for (const key of FLAG_KEYS)
    await db
      .insert(schema.featureFlags)
      .values({ key, enabled: key === "AUTO_PRICING", description: descriptions[key] ?? "" })
      .onConflictDoNothing();
}

const DEV_STAFF = [
  ["admin@mfg.local", "ADMIN"],
  ["finance@mfg.local", "FINANCE_ADMIN"],
  ["qc@mfg.local", "QUALITY_REVIEWER"],
  ["support@mfg.local", "SUPPORT_AGENT"],
  ["super@mfg.local", "SUPER_ADMIN"],
] as const;

/** Local/staging accounts and two sample suppliers. Never run against production. */
export async function seedDevelopment(db: Db): Promise<void> {
  for (const [email, role] of DEV_STAFF) {
    const [u] = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${email}`);
    if (u) continue;
    const id = uuidv7();
    await db.insert(schema.users).values({ id, email, displayName: role, preferredLocale: "he" });
    await db
      .insert(schema.roleAssignments)
      .values({ id: uuidv7(), userId: id, role, scopeType: "platform" });
  }
  const variants = await db
    .select({ id: schema.materialVariants.id })
    .from(schema.materialVariants);
  const samples = [
    {
      name: "Haifa Print Farm",
      email: "partner1@mfg.local",
      city: "Haifa",
      stats: {
        qualityScore: 0.92,
        onTimeRate: 0.95,
        acceptanceRate: 0.9,
        reprintRate: 0.02,
        cancellationRate: 0,
        completedJobs: 40,
      },
    },
    {
      name: "Tel Aviv Makers",
      email: "partner2@mfg.local",
      city: "Tel Aviv",
      stats: {
        qualityScore: 0.85,
        onTimeRate: 0.9,
        acceptanceRate: 0.85,
        reprintRate: 0.04,
        cancellationRate: 0,
        completedJobs: 25,
      },
    },
  ];
  for (const s of samples) {
    const [exists] = await db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.contactEmail, s.email));
    if (exists) continue;
    const supplierId = uuidv7();
    await db.insert(schema.suppliers).values({
      id: supplierId,
      name: s.name,
      contactEmail: s.email,
      city: s.city,
      addressLine: "1 Workshop St",
      status: "active",
      leadTimeDays: 2,
      onboarding: { company: true, location: true, machines: true, payout: true, agreement: true },
      payoutDetails: { accountName: s.name, bank: "12", branch: "345", account: "6789012" },
      agreementAcceptedAt: new Date(),
      stats: s.stats,
    });
    const userId = uuidv7();
    await db
      .insert(schema.users)
      .values({ id: userId, email: s.email, displayName: s.name, preferredLocale: "he" });
    await db.insert(schema.roleAssignments).values({
      id: uuidv7(),
      userId,
      role: "SUPPLIER_MANAGER",
      scopeType: "supplier",
      scopeId: supplierId,
    });
    for (const name of ["Prusa MK4 #1", "Bambu X1C #1"]) {
      const machineId = uuidv7();
      await db.insert(schema.machines).values({
        id: machineId,
        supplierId,
        name,
        buildXMm: 250,
        buildYMm: 210,
        buildZMm: 220,
        dailyCapacityMinutes: 1200,
      });
      await db
        .insert(schema.machineMaterials)
        .values(variants.map((v) => ({ machineId, materialVariantId: v.id })));
    }
  }
}
