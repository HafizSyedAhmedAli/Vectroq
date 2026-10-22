import type { Category } from "@vectroq/shared-types";
import type { LivingFloor } from "./materials";

export type CeilingStyle = "plain" | "drop" | "tray";

export interface CategoryFinish {
  ceiling: CeilingStyle;
  counter: "granite" | "laminate";
  doorLabel: string;
  doorColor: string;
  woodColor: string;
  cabinetColor: string;
  sofaColor: string;
  beddingColor: string;
}

// Floors are NOT here: they follow the company's marble/tile rule (the BOQ
// prices them). Ceiling style mirrors the category's false-ceiling rate.
// Everything else is illustrative only.
export const CATEGORY_FINISH: Record<Category, CategoryFinish> = {
  A: {
    ceiling: "tray",
    counter: "granite",
    doorLabel: "Walnut doors (illustrative)",
    doorColor: "#5a3418",
    woodColor: "#6b4426",
    cabinetColor: "#4a3b32",
    sofaColor: "#7a6a58",
    beddingColor: "#c9b79c",
  },
  B: {
    ceiling: "drop",
    counter: "granite",
    doorLabel: "Oak doors (illustrative)",
    doorColor: "#8b5a2b",
    woodColor: "#a1763f",
    cabinetColor: "#7b6a58",
    sofaColor: "#5f7a8a",
    beddingColor: "#9fb4c4",
  },
  C: {
    ceiling: "plain",
    counter: "laminate",
    doorLabel: "Painted doors (illustrative)",
    doorColor: "#b9a98f",
    woodColor: "#b8a283",
    cabinetColor: "#a8a095",
    sofaColor: "#8d8d8d",
    beddingColor: "#b8b8b8",
  },
};

const CEILING_LABEL: Record<CeilingStyle, string> = {
  tray: "Stepped false ceiling with cove light",
  drop: "False ceiling with dropped border",
  plain: "Plain false ceiling",
};

export function finishSummary(
  category: Category,
  living: LivingFloor,
): string[] {
  const f = CATEGORY_FINISH[category];
  return [
    living === "marble"
      ? "Marble in dry rooms; kitchen and baths tiled"
      : "Tile flooring throughout",
    CEILING_LABEL[f.ceiling],
    f.counter === "granite"
      ? "Granite kitchen counter"
      : "Laminate kitchen counter",
    f.doorLabel,
  ];
}
