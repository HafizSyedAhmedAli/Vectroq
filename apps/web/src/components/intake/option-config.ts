import { Building2, FileText, Home, Trees, Users } from "lucide-react";
import { DEFAULT_ORG_RULES } from "@vectroq/shared-types";
import type { Category, EngagementModel } from "@vectroq/shared-types";
import type { HouseType } from "@vectroq/lead-intake";
import type { CardOption } from "./OptionCards";

const MODEL_ICONS = { 1: Home, 2: FileText, 3: Users } as const;

export function modelOptionsFromRules(
  models: Record<EngagementModel, { label: string; description: string }>,
): CardOption<EngagementModel>[] {
  return ([1, 2, 3] as const).map((value) => ({
    value,
    label: models[value].label,
    description: models[value].description || undefined,
    Icon: MODEL_ICONS[value],
  }));
}

export const MODEL_OPTIONS = modelOptionsFromRules(DEFAULT_ORG_RULES.models);

export const HOUSE_TYPE_OPTIONS: CardOption<HouseType>[] = [
  { value: "House", label: "House", Icon: Home },
  { value: "Villa", label: "Villa", Icon: Building2 },
  { value: "Farmhouse", label: "Farmhouse", Icon: Trees },
];

export const CATEGORY_OPTIONS: CardOption<Category>[] = [
  { value: "A", label: "Category A" },
  { value: "B", label: "Category B" },
  { value: "C", label: "Category C" },
];
