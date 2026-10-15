// apps/web/src/components/intake/option-config.ts
import { Building2, FileText, Home, Trees, Users } from "lucide-react";
import type { Category, EngagementModel } from "@tmcc/shared-types";
import type { HouseType } from "@tmcc/lead-intake";
import type { CardOption } from "./OptionCards";

export const MODEL_OPTIONS: CardOption<EngagementModel>[] = [
  {
    value: 1,
    label: "Land & Build, Then Sell",
    description:
      "TM CC purchases the plot, designs and constructs the house, and offers the finished home for sale.",
    Icon: Home,
  },
  {
    value: 2,
    label: "Construction on Client's Plot",
    description:
      "The client provides the plot, and TM CC handles the full design and construction of the house.",
    Icon: FileText,
  },
  {
    value: 3,
    label: "Client's Plot & Construction Cost",
    description:
      "The plot and construction budget are provided by the client; TM CC manages the design and execution.",
    Icon: Users,
  },
];

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
