// Stage 3c-0: provenance between the index spaces Mode B uses. They are NOT
// interchangeable:
//   dxf entity index  position in the DXF entity list
//   raw index         position among the WALLS-layer LINEs (what the merge reports)
//   legacy index      position in the de-duplicated segments (rooms, opening hosts,
//                     and the topology analyzer's segment indices)
//   wall index        position in the physical wall segments (wall-${i})
// Relations are many-to-many where noted. Nothing here feeds geometry.

export interface EndpointRef {
  seg: number;
  end: 0 | 1;
}

/** Provenance of one topology (= legacy) segment. */
export interface TopoSegProv {
  /** Topology segment index (= legacy index). */
  id: number;
  /** Raw index of the representative line. */
  rawRep: number;
  /** Raw indices of the duplicates it absorbed (exact, reversed, near), ascending. */
  rawAliases: number[];
  /** Offset between each absorbed duplicate and the representative (ft). */
  aliasOffsets: { raw: number; offsetFt: number }[];
  /** Every physical wall that contains the representative or any alias (many-to-many). */
  walls: number[];
  /** The wall containing the representative. */
  primaryWall: number;
  /** Set on pieces a future stage splits off: the parent topology segment. They inherit its raw/wall data. */
  parent?: number;
  /** Set on segments a future stage synthesizes. Never set in Stage 3c-0. */
  synthetic?: { kind: "bridge"; from: EndpointRef; to: EndpointRef };
}

export interface WallProvenance {
  /** raw index -> DXF entity index (-1 when the caller did not supply entity indices). */
  entityOfRaw: number[];
  /** raw index -> legacy index of the representative standing for it. */
  rawToLegacy: number[];
  /** legacy index -> provenance. */
  legacy: TopoSegProv[];
  /** wall index -> raw indices of every contributing line. */
  wallRaw: number[][];
  /** wall index -> legacy indices of every topology segment it contains. */
  wallLegacy: number[][];
  /** wall index -> wall id as segmentsToWalls assigns it. */
  wallIds: string[];
}
