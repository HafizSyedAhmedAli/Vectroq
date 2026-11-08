// Parser-to-BOQ contract. Full text and current status: docs/parser-boq-invariants.md

export interface ParserBoqInvariant {
  id: "INV-1" | "INV-2" | "INV-3" | "INV-4" | "INV-5";
  title: string;
  rule: string;
}

export const PARSER_BOQ_INVARIANTS: readonly ParserBoqInvariant[] = [
  {
    id: "INV-1",
    title: "Walls are gross",
    rule: "A wall runs continuously through door and window openings. Openings are deducted exactly once, by boq-engine netWallArea.",
  },
  {
    id: "INV-2",
    title: "One wall per physical run",
    rule: "Every physical wall run appears once in Geometry.walls (no shared-wall duplicates, no overlapping segments).",
  },
  {
    id: "INV-3",
    title: "Rooms are rooms",
    rule: "A room is an enclosed space. Wall cavities, site boundaries and outdoor areas are not rooms.",
  },
  {
    id: "INV-4",
    title: "Centreline area",
    rule: "Room.area is centreline-based until the BOQ owner decides otherwise. Any net area is a separate optional field (Room.netArea).",
  },
  {
    id: "INV-5",
    title: "Feet, one frame",
    rule: "All lengths are in feet, in one coordinate frame. Any rotation applied to the plan is recorded in ParseMeta.rotationRad.",
  },
] as const;
