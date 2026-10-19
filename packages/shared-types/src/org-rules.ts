import type { Category, EngagementModel } from "./index";

export interface ModelRule {
  label: string;
  description: string;
  taxPercent: number;
}
export interface CategoryRule {
  label: string;
  /** Marble in living areas (tiles elsewhere) when true; tiles everywhere when false. */
  marbleInLiving: boolean;
  falseCeilingRate: number;
}
export interface LabourRates {
  masonry: number;
  plaster: number;
  shuttering: number;
  steelFixing: number;
  sanitary: number;
  tileFixing: number;
  marbleFixing: number;
  woodwork: number;
}
export interface ConstructionDefaults {
  wallHeightFt: number;
  exteriorWallThicknessFt: number;
  partitionThicknessFt: number;
  doorHeightFt: number;
  windowHeightFt: number;
}
export interface MaterialAssumptions {
  referenceThicknessFt: number;
  bricksPerSqftFaceAtReference: number;
  cementBagsPer1000Bricks: number;
  sandCftPer1000Bricks: number;
  plasterCementBagsPerSqft: number;
  plasterSandCftPerSqft: number;
  steelKgPerSqft: number;
}
export interface OrgRules {
  models: Record<EngagementModel, ModelRule>;
  categories: Record<Category, CategoryRule>;
  labour: LabourRates;
  construction: ConstructionDefaults;
  materials: MaterialAssumptions;
  /** null = generate / use the built-in text. */
  notes: { assumptions: string[] | null; exclusions: string[] | null };
}

/** What boq-engine needs from the rules. */
export interface BoqConfig {
  materials?: MaterialAssumptions;
  marbleCategories?: readonly Category[];
}

export const CATEGORY_KEYS: readonly Category[] = ["A", "B", "C"];
export const MODEL_KEYS = [1, 2, 3] as const;

export const DEFAULT_EXCLUSIONS: string[] = [
  "Boundary wall, gate, external development and landscaping",
  "Water tank, boring / pump, gas and utility connections",
  "Kitchen cabinets, appliances, light fixtures, furniture and curtains",
  "Design / consultant fees and approval charges",
  "Price changes after the date of this estimate",
];

export const DEFAULT_ORG_RULES: OrgRules = {
  models: {
    1: {
      label: "Land & Build, Then Sell",
      description:
        "The company purchases the plot, designs and constructs the house, and offers the finished home for sale.",
      taxPercent: 15,
    },
    2: {
      label: "Construction on Client's Plot",
      description:
        "The client provides the plot, and the company handles the full design and construction of the house.",
      taxPercent: 10,
    },
    3: {
      label: "Client's Plot & Construction Cost",
      description:
        "The plot and construction budget are provided by the client; the company manages the design and execution.",
      taxPercent: 5,
    },
  },
  categories: {
    A: { label: "Premium", marbleInLiving: true, falseCeilingRate: 350 },
    B: { label: "Standard", marbleInLiving: false, falseCeilingRate: 275 },
    C: { label: "Economy", marbleInLiving: false, falseCeilingRate: 200 },
  },
  labour: {
    masonry: 50,
    plaster: 30,
    shuttering: 45,
    steelFixing: 10_000,
    sanitary: 12_000,
    tileFixing: 50,
    marbleFixing: 40,
    woodwork: 350,
  },
  construction: {
    wallHeightFt: 10,
    exteriorWallThicknessFt: 0.75,
    partitionThicknessFt: 0.375,
    doorHeightFt: 7,
    windowHeightFt: 4,
  },
  materials: {
    referenceThicknessFt: 0.75,
    bricksPerSqftFaceAtReference: 13.5,
    cementBagsPer1000Bricks: 5,
    sandCftPer1000Bricks: 30,
    plasterCementBagsPerSqft: 0.04,
    plasterSandCftPerSqft: 0.12,
    steelKgPerSqft: 4,
  },
  notes: { assumptions: null, exclusions: null },
};

// ---------- validation ----------

export type OrgRulesResult =
  | { ok: true; rules: OrgRules }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const sub = (o: unknown, key: string | number): Record<string, unknown> =>
  isObj(o) && isObj(o[key]) ? (o[key] as Record<string, unknown>) : {};

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : null;

const str = (v: unknown, max: number, min = 1): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
};

type Spec<K extends string> = Record<K, [label: string, min: number, max: number]>;

function section<K extends string>(
  raw: unknown,
  spec: Spec<K>,
): { ok: true; value: Record<K, number> } | { ok: false; error: string } {
  const o = isObj(raw) ? raw : {};
  const value = {} as Record<K, number>;
  for (const k of Object.keys(spec) as K[]) {
    const [label, min, max] = spec[k];
    const n = num(o[k], min, max);
    if (n === null)
      return { ok: false, error: `${label} must be a number between ${min} and ${max}.` };
    value[k] = n;
  }
  return { ok: true, value };
}

const LABOUR_SPEC = {
  masonry: ["Brick masonry rate", 0.01, 1e7],
  plaster: ["Plaster rate", 0.01, 1e7],
  shuttering: ["Shuttering rate", 0.01, 1e7],
  steelFixing: ["Steel fixing rate", 0.01, 1e7],
  sanitary: ["Sanitary rate", 0.01, 1e7],
  tileFixing: ["Tile fixing rate", 0.01, 1e7],
  marbleFixing: ["Marble fixing rate", 0.01, 1e7],
  woodwork: ["Woodwork rate", 0.01, 1e7],
} satisfies Spec<keyof LabourRates>;

const CONSTRUCTION_SPEC = {
  wallHeightFt: ["Wall height", 6, 30],
  exteriorWallThicknessFt: ["Exterior wall thickness", 0.25, 3],
  partitionThicknessFt: ["Partition thickness", 0.1, 3],
  doorHeightFt: ["Door height", 5, 12],
  windowHeightFt: ["Window height", 2, 10],
} satisfies Spec<keyof ConstructionDefaults>;

const MATERIALS_SPEC = {
  referenceThicknessFt: ["Reference wall thickness", 0.25, 3],
  bricksPerSqftFaceAtReference: ["Bricks per sq ft of wall", 1, 60],
  cementBagsPer1000Bricks: ["Cement bags per 1,000 bricks", 0.1, 50],
  sandCftPer1000Bricks: ["Sand (cft) per 1,000 bricks", 1, 200],
  plasterCementBagsPerSqft: ["Plaster cement bags per sq ft", 0.001, 1],
  plasterSandCftPerSqft: ["Plaster sand (cft) per sq ft", 0.001, 2],
  steelKgPerSqft: ["Steel kg per sq ft", 0.1, 30],
} satisfies Spec<keyof MaterialAssumptions>;

function noteLines(
  v: unknown,
  name: string,
): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (v == null) return { ok: true, value: null };
  if (!Array.isArray(v))
    return { ok: false, error: `${name} must be a list of lines.` };
  const lines: string[] = [];
  for (const x of v) {
    if (typeof x !== "string")
      return { ok: false, error: `${name} must be a list of lines.` };
    const t = x.trim();
    if (!t) continue;
    if (t.length > 300)
      return { ok: false, error: `Each ${name} line can be at most 300 characters.` };
    lines.push(t);
  }
  if (lines.length > 15)
    return { ok: false, error: `At most 15 ${name} lines.` };
  return { ok: true, value: lines.length ? lines : null };
}

export function validateOrgRules(input: unknown): OrgRulesResult {
  const b = isObj(input) ? input : {};
  const fail = (error: string): OrgRulesResult => ({ ok: false, error });

  const models = {} as OrgRules["models"];
  for (const m of MODEL_KEYS) {
    const r = sub(b.models, m);
    const label = str(r.label, 60);
    const description =
      r.description == null || r.description === "" ? "" : str(r.description, 200, 0);
    const taxPercent = num(r.taxPercent, 0, 100);
    if (label === null)
      return fail(`Service type ${m}: a name is required (max 60 characters).`);
    if (description === null)
      return fail(`Service type ${m}: description is too long (max 200 characters).`);
    if (taxPercent === null)
      return fail(`Service type ${m}: tax must be between 0 and 100.`);
    models[m] = { label, description, taxPercent };
  }

  const categories = {} as OrgRules["categories"];
  for (const c of CATEGORY_KEYS) {
    const r = sub(b.categories, c);
    const label = str(r.label, 30);
    const rate = num(r.falseCeilingRate, 0, 1e6);
    if (label === null)
      return fail(`Category ${c}: a name is required (max 30 characters).`);
    if (typeof r.marbleInLiving !== "boolean")
      return fail(`Category ${c}: choose marble or tiles.`);
    if (rate === null)
      return fail(`Category ${c}: false ceiling rate must be between 0 and 1,000,000.`);
    categories[c] = { label, marbleInLiving: r.marbleInLiving, falseCeilingRate: rate };
  }

  const labour = section(b.labour, LABOUR_SPEC);
  if (!labour.ok) return fail(labour.error);
  const construction = section(b.construction, CONSTRUCTION_SPEC);
  if (!construction.ok) return fail(construction.error);
  const materials = section(b.materials, MATERIALS_SPEC);
  if (!materials.ok) return fail(materials.error);

  const notes = sub(b, "notes");
  const assumptions = noteLines(notes.assumptions, "assumptions");
  if (!assumptions.ok) return fail(assumptions.error);
  const exclusions = noteLines(notes.exclusions, "exclusions");
  if (!exclusions.ok) return fail(exclusions.error);

  return {
    ok: true,
    rules: {
      models,
      categories,
      labour: labour.value,
      construction: construction.value,
      materials: materials.value,
      notes: { assumptions: assumptions.value, exclusions: exclusions.value },
    },
  };
}

// ---------- resolving stored values ----------

/** Copies only the keys `base` knows; anything the stored value lacks keeps its default. */
function merge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over))
    return (over === undefined ? base : over) as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(base))
    out[k] = merge((base as Record<string, unknown>)[k], over[k]);
  return out as T;
}

/** Stored JSON (or null) -> complete, valid rules. Never throws. */
export function resolveOrgRules(raw: unknown): OrgRules {
  if (raw == null) return DEFAULT_ORG_RULES;
  const v = validateOrgRules(merge(DEFAULT_ORG_RULES, raw));
  return v.ok ? v.rules : DEFAULT_ORG_RULES;
}

// ---------- helpers used across the app ----------

export const modelName = (
  rules: Pick<OrgRules, "models">,
  model: number,
): string => rules.models[model as EngagementModel]?.label ?? `Model ${model}`;

export function boqConfigFromRules(rules: OrgRules): BoqConfig {
  return {
    materials: rules.materials,
    marbleCategories: CATEGORY_KEYS.filter(
      (c) => rules.categories[c].marbleInLiving,
    ),
  };
}

const inches = (ft: number) => `${+(ft * 12).toFixed(1)} in`;
const list = (xs: string[]) =>
  xs.length <= 1
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
const cats = (xs: string[]) =>
  xs.length === 1 ? `Category ${xs[0]}` : `Categories ${list(xs)}`;

/** "Basis of estimate" text generated from the numbers actually in use. */
export function buildAssumptions(rules: OrgRules): string[] {
  const c = rules.construction;
  const marble = CATEGORY_KEYS.filter((k) => rules.categories[k].marbleInLiving);
  const tiled = CATEGORY_KEYS.filter((k) => !rules.categories[k].marbleInLiving);
  const finish =
    marble.length === 0
      ? "Tile flooring in all areas, including kitchens and bathrooms."
      : tiled.length === 0
        ? "Marble in living areas for all categories. Kitchens and bathrooms are tiled."
        : `Marble in living areas for ${cats(marble)}; tiles for ${cats(tiled)}. Kitchens and bathrooms are tiled.`;
  return [
    "Quantities are measured from the uploaded drawing (wall centre-lines), single storey.",
    `Wall height ${c.wallHeightFt} ft; ${inches(c.exteriorWallThicknessFt)} exterior walls and ${inches(c.partitionThicknessFt)} interior partitions; door and window openings deducted.`,
    `Reinforcement steel allowed at ${rules.materials.steelKgPerSqft} kg per sq ft of covered area.`,
    finish,
    "Unit rates come from the rate schedule named under the totals and may differ from current market prices; they are subject to confirmation at contract stage.",
  ];
}

export function resolveNotes(rules: OrgRules): {
  assumptions: string[];
  exclusions: string[];
} {
  return {
    assumptions: rules.notes.assumptions ?? buildAssumptions(rules),
    exclusions: rules.notes.exclusions ?? DEFAULT_EXCLUSIONS,
  };
}