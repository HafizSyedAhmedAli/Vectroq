# DXF Parser Improvement Plan: Vectroq

**Scope:** investigation and planning only. No production code or existing test was changed.
**Basis:** static trace of `packages/cad-parser/src/*`, `packages/boq-engine/src/*`, `packages/shared-types/src/index.ts`, the downstream web consumers, the fixtures, `audit/audit-probes.test.ts` and `DXF_PARSER_ACCURACY_AUDIT.md`. I did not execute the test suite; every behaviour below is derived by reading the code.

**Labels used in this document**

| Label | Meaning |
|---|---|
| **[Verified]** | Confirmed by reading the code at the cited location |
| **[Audit-only]** | Stated in the audit; I could not confirm it from the code I have |
| **[Assumption]** | A design choice or number that must be validated on real drawings |
| **[Open]** | A question the owner or a real dataset must answer |

---

## 1. Executive summary

The parser works on drawings that follow its conventions and fails silently on everything else. After tracing the code, the audit's findings are accurate. Most of them come from six shared causes, not sixteen independent bugs:

1. **There is no normalization layer.** Raw entities go straight into one of two room-detection modes. Duplicate, overlapping, near-miss and rotated geometry is never cleaned up. (I-01, I-02 partly, I-03, I-05, I-06, I-12, L5)
2. **Two parallel modes** (`dxfToGeometry` polyline branch vs `roomsFromWallSegments` line branch) have different thickness rules, different room-type regexes, different label rules and different opening handling. (I-04, I-05, I-08, I-10, I-13, N1)
3. **Tolerances are hard-coded, absolute and inconsistent** across files (0.01 ft, 0.05 ft, 0.25 ft, 0.2 ft, 500 units).
4. **Exterior/interior is decided by the global bounding box**, not by topology. (I-07, I-08)
5. **Unit detection guesses from absolute coordinates** of every vertex on every layer. (I-02)
6. **There is no way to report uncertainty.** `Geometry` has no metadata, so a wrong parse looks identical to a good one. (I-15)

I also found problems the audit did not list (section 3.3). The most important is an **undocumented contract between parser and BOQ**: `netWallArea` subtracts opening area from gross wall area, so if the parser ever emits walls broken at door gaps (which real drawings do), openings are deducted twice. Fixing room detection without fixing this contract would trade one error for another.

**Recommendation:** incremental improvement, not a rewrite. The grid/union-find room finder in `line-plan.ts`, the door-arc logic in `door-swing.ts`, `snapToWall` and the polygon helpers are sound and well tested. What is missing is a normalization stage in front of them, a unified wall model behind them, and a report channel alongside them. The new work is roughly three new modules (`units.ts`, `normalize-segments.ts`, `report.ts`) plus targeted changes to existing functions.

---

## 2. Current parser architecture

### 2.1 Data flow (as implemented)

```
DXF text
  └─ parse-dxf.ts: parseDxfToGeometry(text, construction?)
       ├─ DxfParser.parseSync()                       (external dxf-parser)
       ├─ MTEXT -> TEXT (position -> startPoint, "\P" -> " ")
       ├─ maxExtent = max |x|,|y| over every entity's `vertices`   <- all layers
       ├─ k = feetPerUnit($INSUNITS, maxExtent)
       ├─ scaleEntity(e, k) for every entity
       └─ dxf-to-geometry.ts: dxfToGeometry({entities}, construction)
            ├─ split by layerKind(): wall | door | window | (other -> labels)
            ├─ MODE A  if any LWPOLYLINE on wall layer
            │    per polyline:  every edge -> Wall (exterior thickness)
            │                   room = shoelace area, first label inside polygon
            │    openings: toOpening(line, ..., walls)            (no door arcs)
            │    wall LINEs are ignored entirely
            ├─ MODE B  else if wall LINEs exist
            │    dedupeSegments -> segmentsToWalls (exterior iff on global bbox)
            │    roomsFromWallSegments (grid + union-find flood fill)
            │    openings: toOpening(line, ..., walls, doorArcs)
            └─ openings: snapToWall (nearest wall, no distance limit)
                         swingFromArc (hinge + closed direction)
  -> Geometry { walls, rooms, openings }  -> CadFile.geometry (JSON)
  -> boq-engine.calculateBoq(geometry, rateCard, tax, config)
```

### 2.2 Responsibility map

| File | Function | Role | Verdict |
|---|---|---|---|
| `parse-dxf.ts` | `feetPerUnit` | Unit choice | **Replace** logic, keep signature as a wrapper |
| `parse-dxf.ts` | `parseDxfToGeometry` | Entry point | Keep as thin wrapper over a new `parseDxf` |
| `parse-dxf.ts` | `scaleEntity` | Scale vertices, startPoint, center, radius | Keep; also scale bulge-independent fields |
| `dxf-to-geometry.ts` | `dxfToGeometry` | Mode switch, rooms, walls, openings | **Restructure** into one pipeline |
| `dxf-to-geometry.ts` | `layerKind` | Exact layer-name match | Extend (configurable, prefix/suffix patterns) |
| `dxf-to-geometry.ts` | `detectRoomType`, `cleanRoomName` | Polyline-mode classification | **Merge** with the line-mode copy |
| `line-plan.ts` | `dedupeSegments` | Exact-key dedupe | Replace with tolerance clustering |
| `line-plan.ts` | `segmentsToWalls` | Thickness by global bbox | **Replace** with topology classification |
| `line-plan.ts` | `roomsFromWallSegments` | Grid + union-find enclosure | **Keep**, feed it normalized segments |
| `line-plan.ts` | `detectRoomType`, `tidyName` | Line-mode classification | Merge into one module |
| `place-openings.ts` | `snapToWall`, `nearestOnWalls`, `spanBlocked` | Opening placement | Keep; add distance limit and return `placed` status |
| `door-swing.ts` | `swingFromArc`, `arcAngles` | Hinge and swing from ARC | Keep |
| `polygon.ts` | `polygonArea`, `pointInPolygon`, `distance` | Primitives | Keep |

### 2.3 Hard-coded tolerances found [Verified]

| File | Constant | Value | Unit |
|---|---|---|---|
| `line-plan.ts` | `EPS` (grid key, axis test, label lookup) | 0.01 | ft (3 mm) |
| `place-openings.ts` | `EDGE` in `spanBlocked` | 0.25 | ft |
| `door-swing.ts` | hinge match `0.05 + len*0.01`, radius `3%`, angle `tol` | 0.05 | ft / ratio / rad |
| `parse-dxf.ts` | mm-vs-ft threshold | 500 | raw units |
| `wall-cuts.ts` (viewer) | `across <= th/2 + 0.25`, `sin(angle) > 0.2` | 0.25 / 0.2 | ft / ratio |
| `connect-rooms.ts` (viewer) | `EPS`, `MIN_LINK_FT` | 0.2 / 3.5 | ft |

Nothing scales with the drawing, and nothing is shared between files.

### 2.4 Downstream consumers of `Geometry` [Verified]

- `boq-engine/src/material-quantities.ts` and `calculate-boq.ts`
- Viewer: `wall-cuts.ts`, `connect-rooms.ts`, `furniture-layout.ts`, `HouseViewer.tsx`
- `CardReviewPanel.tsx` (edits rooms and walls only; **it has no openings table**)
- `sample-project.ts`, `cad-upload/route.ts`, `finalize/route.ts`

Any change to the `Geometry` shape must stay backward compatible: old rows already stored in `CadFile.geometry` have no new fields.

---

## 3. Confirmed issues and root causes

### 3.1 Shared root causes

| ID | Root cause | Kind | Issues it produces |
|---|---|---|---|
| RC1 | No normalization (snap, split, merge, dedupe, rotate) before detection | Architecture | I-01, I-03, I-06, I-12, L1, L2, L5 |
| RC2 | Two modes with different semantics | Architecture | I-04, I-05, I-08, I-10, I-13, N1 |
| RC3 | Absolute, unshared tolerances | Heuristic | I-01, I-09, O2 |
| RC4 | Exterior = "on global bbox" | Heuristic | I-07, I-08, L4 |
| RC5 | Unit guess from absolute coordinates, all layers | Heuristic | I-02, U1-U3 |
| RC6 | No report/confidence channel | Architecture | I-15 and the silence of every other failure |

### 3.2 Audit findings re-verified against the code

| Audit ID / probe | Verified? | Where it happens |
|---|---|---|
| I-02 / U1 | **Verified.** `feetPerUnit(0, 12)` returns 1 because code 0 is falsy in `FEET_PER_UNIT` and `12 > 500` is false | `parse-dxf.ts: feetPerUnit` |
| I-02 / U2 | **Verified.** extent 1200 > 500 returns the mm factor | same |
| I-02 / U3 | **Verified.** `maxExtent` is `Math.max(Math.abs(x), Math.abs(y))` over vertices, so an offset drawing reads as large | `parseDxfToGeometry` |
| I-04 / P1, P2 | **Verified.** `roomPolylines` filters only on type and layer. No closed flag or vertex-count check. A 2-vertex polyline yields 2 walls (i=0 and i=1 wrap) and area 0 | `dxfToGeometry`, polyline branch |
| I-03 / P3 | **Verified.** One wall per edge per room. Hand check: three rectangles total 64+66+28 = 158 ft. Shared runs are 12 ft (x=20, y 0-12) and 8 ft (x=35, y 0-8), so the unique length is 138 ft. The code comment on shared walls admits it | `dxfToGeometry` |
| I-05 / P4 | **Verified.** `if (roomPolylines.length === 0 && wallLines.length > 0)` skips line mode whenever one polyline exists | `dxfToGeometry` |
| I-08 / P5 | **Verified in code, but probe P5 is weak.** It uses a single rectangle, where all four walls really are exterior, so it passes for the right reason and does not demonstrate the bug. The bug appears only with shared edges (P3 geometry). The 2x brick difference between modes is real (`thickness` 0.75 vs 0.375 in `segmentsToWalls`) | `dxfToGeometry` vs `line-plan.ts` |
| I-10 / P6 | **Verified.** `/bath\|washroom\|toilet/` in `dxf-to-geometry.ts` vs `/bath\|washroom\|toilet\|wc/` in `line-plan.ts` | both `detectRoomType` |
| I-01 / L1, L2 | **Verified.** Cells merge unless a segment blocks the shared edge. A 4 ft gap or a 0.02 ft corner miss connects the interior to `OUT`, and every cell connected to `OUT` is discarded | `roomsFromWallSegments` |
| I-06 / L3 | **Verified.** The cavity between two nested rectangles is enclosed and not connected to `OUT`, so it becomes a room. Total room area equals the full footprint | `roomsFromWallSegments` |
| I-07 / L4 | **Verified.** `onEdge` compares against min/max of all segment coordinates, so the plot boundary becomes the "exterior" and the house walls fall back to partition thickness | `segmentsToWalls` |
| I-12 / L5 | **Verified.** `roomsFromWallSegments` returns `[]` if any segment fails `isAxisAligned`. `segmentsToWalls` still runs, so walls come back without rooms | `line-plan.ts` |
| I-09 / O1 | **Verified.** One opening per LINE, no grouping | `dxfToGeometry` |
| I-09 / O2 | **Verified.** `nearestOnWalls` has no maximum distance; `snapToWall` returns a placement for any line | `place-openings.ts` |
| I-13 | **Verified.** `labels.find(...)` takes the first label in the polygon, and labels are never consumed, so one label can name several nested rooms. Only `\P` is stripped from MTEXT. `cleanRoomName` runs only in polyline mode; `tidyName` only in line mode | `dxfToGeometry`, `parse-dxf.ts`, `line-plan.ts` |
| I-11 | **Verified in principle.** Area is centreline polygon area. My own estimate for `whole_house_simple_plan.dxf` with the parser's default 9 in / 4.5 in thicknesses: about 54 sq ft of exterior half-thickness plus about 22 sq ft interior, roughly 6% of 1292 sq ft. These thicknesses are parser defaults, not measured values | `dxfToGeometry` |
| I-14 (paper space, frozen layers, bulge, R12 POLYLINE) | **[Audit-only].** The code never reads these, so absence of handling is verified. Whether `dxf-parser@^1.1.2` exposes `inPaperSpace`, layer `frozen/visible`, LWPOLYLINE `shape` and `bulge` must be checked against the installed version | **[Open]** |
| I-16 | **Verified**, low impact. `arcAngles` guesses degrees vs radians by magnitude | `door-swing.ts` |
| `whole_house_connected.dxf` has a duplicate door | **Verified by reading the file.** 8 door LINEs, 7 ARCs; two lines share hinge (8500, 6500) | fixture |

### 3.3 New findings not in the audit

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| **N1** | Polyline mode never passes `doorArcs` to `toOpening`, so swing direction is only detected in line mode | `dxfToGeometry`, polyline branch calls `toOpening(line, i, "door", d.doorHeightFt, walls)` | Doors in polyline drawings always default to one swing direction in the 3D view |
| **N2** | **Opening double-deduction contract.** `netWallArea = wallFaceArea - openingArea`. If walls are broken at door gaps (typical in real CAD), the gap is already missing from wall length and the opening is subtracted again | `material-quantities.ts: netWallArea`, `calculate-boq.ts` | Masonry, plaster, bricks, cement, sand, paint understated. Must be fixed by a written invariant (section 4.4) |
| **N3** | Unit extent uses every entity with `vertices` on any layer, including title blocks, borders, dimension lines and site outlines | `parseDxfToGeometry` builds `coords` from `normalised.flatMap(e => e.vertices)` | One stray far-away entity flips a feet drawing to mm. Text, arcs and circles are not counted at all |
| **N4** | Grid keys use `Math.round(n/EPS)*EPS`. Two points 0.004 ft apart that straddle a rounding boundary get different keys | `line-plan.ts: key`, `dedupeSegments` | Grid snapping is not clustering: near-duplicate and near-touching points are non-deterministically separated |
| **N5** | `dedupeSegments` only drops identical segments. Collinear overlapping or partially overlapping segments (a long wall plus its two halves) both survive | `line-plan.ts` | Wall length overcounted in line mode too, not just polyline mode |
| **N6** | Unified `wc` matching must use word boundaries. `/wc/i` matches "sho**wc**ase" | `line-plan.ts: detectRoomType` | Risk when merging the two classifiers |
| **N7** | `CadReviewPanel` has Rooms and Walls tables but **no Openings table**. A wrong or duplicated opening cannot be corrected in the UI, although openings drive `woodwork` and wall deduction | `CardReviewPanel.tsx` | Opening fixes need an escape hatch |
| **N8** | README and UI copy state "Units are detected automatically (mm, cm, m, ft)". This overstates reliability | `README.md`, `CardReviewPanel.tsx` | Copy must change when confirmation is added |
| **N9** | `shared-types/src/index.ts` declares `Opening` and `RateCardItem` twice (interface merging). Adding fields later to the wrong declaration would be confusing | `index.ts` | Hygiene: consolidate before extending |
| **N10** | Probe weakness: P5 as noted; `parse-dxf.test.ts` mocks `./dxf-to-geometry`, so it pins the call signature `dxfToGeometry({entities}, construction)` | `parse-dxf.test.ts` | Constrains refactoring (section 7.5) |
| **N11** | Existing fixtures already contain independent cross-check data: `sample-house.dxf` labels carry areas ("Kitchen 240 sq ft"); `whole_house_*` carries "12000 mm OVERALL WIDTH" dimension text; the intake form collects `coveredAreaSqFt` and `plotSizeSqYd` on the `Lead` | fixtures, `schema.prisma` | Usable to disambiguate units and sanity-check area (section 5.A) |

### 3.4 Not verified

- Behaviour of `dxf-parser` for `shape`, `inPaperSpace`, frozen layers, `bulge`, INSERT, DIMENSION (**[Open]**: inspect `node_modules/dxf-parser` at the pinned version).
- The audit's "5-6%" net-area figure beyond my own estimate above.
- Anything about real client drawings. No real DXF with measured ground truth is in the repo.

---

## 4. Proposed target architecture

### 4.1 Decision: incremental, with one new pipeline spine

A rewrite is not justified. The grid enclosure finder, door-arc matching and snapping are correct on their domain and carry unit tests. The defects are in what is fed to them (RC1), what is decided around them (RC2, RC4), and what is hidden (RC6). So: add stages in front, unify the wall model behind, add a report alongside.

### 4.2 Pipeline

```
 S1 extract        entities -> typed primitives (+ layer map, paper-space/frozen filter)
 S2 units          primitives + header + cues -> UnitDecision (factor, confidence, needsConfirm)
 S3 normalize      scale to feet, translate near origin, snap/cluster endpoints,
                   explode polylines, split at junctions, merge collinear overlaps,
                   remove zero-length, detect dominant angle and rotate upright
 S4 wall graph     one segment set (from polylines AND lines AND double-line collapse)
 S5 closure        extend/bridge dangling ends so enclosures close (flagged `inferred`)
 S6 faces          rooms = enclosed regions (existing grid algorithm); region tree
 S7 region triage  classify regions: room | wall-cavity | site | outdoor; drop non-rooms
 S8 wall classify  exterior/interior from face adjacency; measured thickness if double-line
 S9 label+type     label->room scoring; one room-type classifier; net area
 S10 openings      cluster -> dedupe -> associate to wall and rooms -> placed/unplaced
 S11 validate      invariants, plausibility checks, warnings, confidence, parserVersion
```

Each stage is a pure function so it can be tested in isolation.

| Stage | Input | Output | Techniques | Solves | Could go wrong |
|---|---|---|---|---|---|
| S1 | `DxfParser` result | `Primitives {segments, polylines, arcs, texts, openingSymbols}` with layer role | Layer role mapping with configurable patterns; skip paper space and frozen/off layers if exposed by the parser | I-14 | Wrong layer role hides walls. Mitigation: warn with entity counts per role and list unmapped layers |
| S2 | primitives, `$INSUNITS`, `$MEASUREMENT`, labels, optional `Lead.coveredAreaSqFt` | `UnitDecision {feetPerUnit, source, confidence, candidates}` | Section 5.A | I-02, N3 | Genuinely ambiguous drawings; must ask the user |
| S3 | primitives in feet | `Segment[]`, `Transform {rotationRad, translate}` | Endpoint clustering (union-find with tolerance), T-junction split, collinear overlap merge, dominant-angle rotation | I-01, I-03, N4, N5, I-12 | Over-aggressive snapping merges distinct walls; tolerance must be small relative to wall length |
| S4 | segments | one `WallSegment[]` set | Treat polyline edges and LINEs identically after S3 | I-05, I-08, RC2 | Polyline room outlines that are not walls (furniture, hatching on the wall layer) |
| S5 | segments, opening symbols | segments + `inferred` closers | Extend dangling end to nearest segment within `extendTol`; bridge two facing dangling ends within `bridgeMax` | I-01 | False rooms from bridging; every bridge emits a warning |
| S6 | segments | `Region[]` with polygons, adjacency | Existing `roomsFromWallSegments` core | rooms | Non-orthogonal plans (see 5.B) |
| S7 | regions | rooms vs non-rooms | Region tree depth, ring-width test, label presence, coverage ratio | I-06, I-07 | Heuristic thresholds; low-confidence results must warn |
| S8 | regions, segments | `Wall.kind`, thickness | Segment adjacent to the outer face = exterior; adjacent to two rooms = interior; double-line gives measured thickness | I-07, I-08 | Interior wall bordering a non-room area |
| S9 | rooms, texts | named, typed rooms, `netArea` | Scored label assignment; one keyword table with token matching | I-10, I-11, I-13 | New room types need BOQ semantics (section 5.E) |
| S10 | opening symbols, walls, rooms | `Opening[]` with `wallId`, `roomIds`, `placed` | Section 5.D | I-09, N1 | Dropping vs keeping unplaced openings changes quantities |
| S11 | everything | `Geometry.meta` | Section 5.F | I-15 | Too many warnings train users to ignore them |

### 4.3 Backward-compatible output contract

Add optional fields only. Old stored geometry stays valid.

```ts
// packages/shared-types/src/index.ts (proposed, not implemented)
export type ParseSeverity = "info" | "warning" | "error";

export interface ParseWarning {
  code: string;                 // e.g. "UNIT_AMBIGUOUS", "ROOM_NOT_CLOSED"
  severity: ParseSeverity;
  message: string;              // user-readable
  entity?: { kind: "wall" | "room" | "opening"; id: string };
}

export interface ParseMeta {
  parserVersion: string;
  unit: {
    feetPerUnit: number;
    source: "header" | "plausibility" | "label-area" | "user";
    confidence: "high" | "medium" | "low";
    confirmed: boolean;         // true after user confirmation
  };
  rotationRad?: number;         // plan was rotated upright by this angle
  warnings: ParseWarning[];
  stats: Record<string, number>; // counts per stage, dropped entities, etc.
}

// Optional additions, all with safe defaults when absent:
// Geometry.meta?: ParseMeta
// Wall.kind?: "exterior" | "interior"; Wall.inferred?: boolean; Wall.source?: "polyline" | "line" | "double-line"
// Room.netArea?: number; Room.labelConfidence?: number
// Opening.wallId?: string; Opening.roomIds?: string[]; Opening.placed?: boolean
```

Add a new entry point and keep the old one as a wrapper so existing callers and tests do not change:

```ts
// parse-dxf.ts (proposed)
export interface ParseResult { geometry: Geometry; meta: ParseMeta }
export function parseDxf(text: string, opts?: ParseOptions): ParseResult;

// unchanged signature, used by sample-project.ts, cad-upload route, tests
export function parseDxfToGeometry(text: string, c?: ConstructionDefaults): Geometry {
  return parseDxf(text, { construction: c }).geometry;
}
```

### 4.4 Parser-to-BOQ invariants (must be written down and tested)

```
INV-1  Walls are gross: a wall runs continuously through door and window openings.
       Openings are deducted once, by boq-engine netWallArea.
INV-2  Every physical wall run appears once (no shared-wall duplicates).
INV-3  A room is an enclosed, roofed, labelled-or-unlabelled space; wall cavities,
       site boundaries and outdoor areas are not rooms.
INV-4  Room.area stays centreline-based (today's convention) until the BOQ owner
       decides otherwise; Room.netArea is additional.
INV-5  All lengths are feet, in one coordinate frame (rotation recorded in meta).
```

---

## 5. Detailed technical solutions

### 5.A Unit detection and normalization

**Problem:** the choice is made from absolute coordinates over all layers (N3), and code 0 or an unsupported code falls through to a heuristic with no confidence.

**Design**

1. **Span, not absolute coordinate.** Compute the bounding box of **wall-layer** entities (fall back to all geometry if none), then `span = max(width, height)`. This removes the origin-offset failure (U3) and the title-block failure (N3). Optionally drop outlier entities beyond a robust percentile of the wall-layer extent.
2. **Header is a candidate, not a verdict.** Accepted codes: 1 (in), 2 (ft), 4 (mm), 5 (cm), 6 (m). Codes such as 3, 7, 8, 9, 10, 11 are unsupported: report `UNIT_UNSUPPORTED` and require confirmation. Code 0 means unitless.
3. **Plausibility scoring.** For each candidate unit compute the resulting footprint in feet and test it against a configurable plausible range for a single-storey house.
4. **Independent cues**, in priority order:
   - Room labels carrying an area ("Kitchen 240 sq ft", `cleanRoomName` already recognizes the pattern): compare the label's number against the polygon area under each candidate unit.
   - Dimension text such as "12000 mm" (fixtures contain it on a `DIM*` layer): optional, fragile free-text parsing.
   - `$MEASUREMENT` (0 imperial, 1 metric) as a weak hint.
   - Declared `Lead.coveredAreaSqFt` when the project's lead has it (absent for the `SAMPLE` lead).
5. **Decision rule**

```ts
type UnitDecision = {
  feetPerUnit: number;
  source: "header" | "plausibility" | "label-area";
  confidence: "high" | "medium" | "low";
  needsConfirmation: boolean;
  candidates: { unit: "in"|"ft"|"mm"|"cm"|"m"; spanFt: number; plausible: boolean }[];
};

// Pseudocode
function detectUnits(prims, header, cues): UnitDecision {
  const span = wallLayerSpan(prims);
  const cands = UNITS.map(u => ({ u, spanFt: span * FT_PER[u] }))
                     .map(c => ({ ...c, plausible: inPlausibleRange(c.spanFt) }));
  const header = headerCandidate(headerCode);              // may be null
  if (header && isPlausible(header)) return decision(header, "header", "high");
  if (header && !isPlausible(header)) warn("UNIT_HEADER_IMPLAUSIBLE");
  const byLabel = matchLabelAreas(prims.rooms, cands);     // picks unit whose areas match labels
  if (byLabel) return decision(byLabel, "label-area", "high");
  const ok = cands.filter(c => c.plausible);
  if (ok.length === 1) return decision(ok[0], "plausibility", "medium");
  return { ...decision(best(ok), "plausibility", "low"), needsConfirmation: true };
}
```

**Worked cases (my arithmetic, not parser output)**

| Drawing | Span | Candidates that give a plausible house | Result |
|---|---|---|---|
| `whole_house_simple_plan.dxf`, no header, mm | 12000 | mm gives 39 ft; ft, cm, m, in give hundreds to tens of thousands of ft | Unique, mm, medium confidence |
| Unitless 12 m x 10 m (probe U1) | 12 | ft gives 12 ft x 10 ft (120 sq ft, implausibly small for a house, **[Assumption]**); m gives 39 ft x 33 ft | Unique, metres |
| Unitless drawing 20 x 15 | 20 | ft gives 300 sq ft; m gives about 3200 sq ft; both plausible | **Ambiguous: ask the user** |

**[Assumption]** The plausible footprint range (for example 200 to 40,000 sq ft, shorter side at least 10 ft) is a product decision informed by the Pakistani residential market; it must be validated on real drawings and kept in configuration.

**Header trust:** drafting templates often leave `$INSUNITS` at a default that does not match how the drawer actually drew. This is general CAD experience, not something verified in this repo, so the header is cross-checked for plausibility instead of being trusted blindly (**[Assumption]**).

**Confirmation flow:** when `needsConfirmation`, `cad-upload/route.ts` returns the candidates with their implied dimensions (for example "39 ft x 33 ft" vs "12 ft x 10 ft"); the UI asks the user; the chosen unit is stored as `meta.unit.confirmed = true`. `finalize/route.ts` refuses to price while `unit.needsConfirmation && !confirmed`.

**What could go wrong:** wrong plausibility range; plans where the wall layer holds only part of the house; a user who confirms the wrong option (show resulting dimensions and covered area next to the choice to reduce this).

### 5.B Geometry tolerance and room detection

**Normalization (S3), new module `normalize-segments.ts`**

```ts
export interface Tolerances {            // feet; initial values are [Assumption], tune on real data
  snap: number;        // endpoint clustering, ~0.05 (15 mm)
  extend: number;      // extend dangling end to a segment, ~0.4
  bridgeMax: number;   // bridge facing dangling ends, ~7
  minWall: number;     // discard shorter segments, ~0.5
  pairMin: number;     // double-line wall pair distance, ~0.2
  pairMax: number;     // ~1.25
}
```

Steps:
1. **Cluster endpoints** with union-find over a spatial hash (cell = `snap`), replacing the rounding key in `line-plan.ts` (fixes N4). Replace each cluster by its centroid.
2. **Explode** polylines and closed outlines into segments (see 5.C), so polylines and LINEs share the same path.
3. **Split at junctions:** where an endpoint lies on another segment's interior (distance within `snap`), split that segment.
4. **Merge** collinear overlapping or touching segments into maximal runs. This removes duplicates and partial overlaps (N5, I-03).
5. **Rotate:** weight each segment angle (mod 90 degrees) by length, find the dominant angle, and rotate the whole plan if more than a threshold of wall length (**[Assumption]** about 80%) is within 1 degree of an axis. Record `meta.rotationRad`. This reuses the existing axis-aligned grid algorithm and fixes L5 without a general planar-face algorithm. Rotating labels and openings with the plan keeps everything consistent. If significant non-orthogonal length remains, emit `PLAN_NON_ORTHOGONAL` and fall back to walls-only with no rooms, as today but with an explicit error instead of silence.

**Gap handling (S5)** (fixes L1, L2)

```
for each dangling endpoint p (touches no other segment):
    1. if an endpoint q != p within snap          -> already clustered
    2. if a segment s within `extend` of p along p's direction -> extend p to s   (inferred, warn)
    3. else if a facing dangling endpoint q on the same line within bridgeMax
            -> add bridge segment p..q                                           (inferred, warn)
       (prefer pairs with a door/window symbol within a wall thickness of the gap)
```

Bridged segments become ordinary walls flagged `inferred: true`. By INV-1 this is correct: the wall is continuous and the door is deducted once by the BOQ.

**[Assumption]** A door gap with no symbol is bridged only with a warning. The alternative, declaring the enclosure open, makes all rooms vanish (today's behaviour).

**Double-line walls (S4/S7)** (fixes L3 and the root of I-06)

Prefer pair detection before enclosure: find parallel segment pairs with overlap, separation in `[pairMin, pairMax]`, and collapse each pair into one centreline segment with `thickness = separation`. If pairs are only found after enclosure, treat a thin enclosed region as a wall cavity: a region whose ring width (about `2 * area / perimeter`) is at most `pairMax` and which fully surrounds another region is a cavity, not a room.

**Region triage (S7)** (fixes L4)

Build the adjacency tree of enclosed regions from `OUT`. Then:
- A thin ring region is a wall cavity: remove it and convert it to wall thickness.
- A wide ring region around the house is a site region: not a room. Its boundary is a plot line, excluded from walls.
- Discriminator **[Assumption]**: coverage ratio of inner rooms to the outer region area. For L4 it is 240 / 1280, about 0.19, which says site. A ratio near 1 means the outer outline is the building envelope and the inner rooms tile it. Layer names (`PLOT`, `SITE`, `BOUNDARY`) are a stronger cue when present.
- Low-confidence triage emits a warning and appears in the review UI.

**What could go wrong:** thresholds are tuned on synthetic data only until real drawings exist; bridging can invent a room across an open veranda; rotation changes coordinates seen by anything that later compares against the original DXF.

### 5.C Unified wall model

Replace the two thickness rules with one topology rule:

```
exterior  = segment with the outer face (OUT) on one side
interior  = segment with two room regions on its two sides
other     = anything else -> "interior" default + info warning (e.g. wall onto a courtyard)
thickness = measured from double-line pair if available,
            else rules.construction.exteriorWallThicknessFt / partitionThicknessFt
```

For polygon-mode input (closed polylines as rooms), the same rule applies after S3 merging: an edge owned by exactly one room is exterior; an edge shared by two rooms is interior, and it is emitted once.

**Closed vs open polylines (I-04)**

A polyline is a room outline if it has at least 3 distinct vertices, positive area, and is closed, where "closed" means the closed flag **or** first and last vertex within `snap`. Both forms are in the repo: `sample-house.dxf` has flag 70 = 0 with a repeated closing vertex; the `cad-upload` test DXF has flag 1 and 4 vertices. Requiring only the flag would break `sample-house.dxf`. Everything else on the wall layer is a wall chain and is exploded into segments.

**Mixed entities (I-05):** after S4 all wall polylines and LINEs form one segment set. There is no mode switch.

**Worked example of the BOQ effect (synthetic, my arithmetic)** for `sample-house.dxf`: walls 158 ft to 138 ft unique, and the two shared runs (20 ft total) become interior at 0.375 ft:

- Masonry (net wall area, with openings 21 + 16 = 37 sq ft): (158 x 10 - 37) = 1543 to (138 x 10 - 37) = 1343 sq ft, about -13%.
- Brick-equivalent length: 158 ft to 118 + 20 x 0.5 = 128 ft thickness-weighted, about -19%.

These are the expected changes to explain, not numbers to hard-code.

### 5.D Doors and windows

Current: one opening per LINE (`dxfToGeometry`), `nearestOnWalls` with no limit, openings carry no wall or room link, polyline mode ignores arcs (N1).

Design (S10):

1. **Symbols.** LINE (as today), thin closed rectangle polylines on the opening layers (width = long side), and optionally INSERT blocks **[Open]: needs `dxf-parser` block support check**.
2. **Cluster and dedupe.** Group symbols of the same type whose projections onto a wall overlap by more than a fraction (**[Assumption]** 50%) and whose perpendicular offset is within one wall thickness. Merge to one opening with the union width (fixes O1 and the duplicate door in `whole_house_connected.dxf`).
3. **Associate.** For each opening compute the distance from its centre (or hinge for leaf doors) to each wall. Accept only if distance is within `max(thickness/2 + 0.25, 0.5)` ft **[Assumption]** and the direction is compatible. Otherwise mark `placed: false` and warn (fixes O2).
4. **Wall and room links.** Set `wallId`; sample points at plus/minus 0.8 ft along the wall normal (the same trick `connect-rooms.ts: addConnectingOpenings` already uses with its own `roomAt`) to set `roomIds`. Move the shared point-in-room helper into `cad-parser` instead of duplicating it.
5. **Arcs everywhere.** Pass `doorArcs` in all paths (fixes N1).
6. **Gap-style openings.** A wall gap with a door or window symbol is handled by S5 bridging and the symbol, consistent with INV-1.

**Policy [Open]:** should an unplaced opening still count in `openingArea` and `woodwork`? Dropping it hides a door the client has; keeping it deducts wall area that may not be there. Recommendation: keep it, flag it, and block silent finalization via the report (section 5.F). Because the review UI has no openings table (N7), add one so the user can resolve it.

### 5.E Room classification and area

**Classification:** one module (`room-type.ts`) replacing both `detectRoomType` copies, matching on word tokens, not raw substrings (N6).

```ts
// keyword table, extend freely; token match on /\b…\b/ after lowercasing and stripping punctuation
const TABLE: [RoomType, RegExp][] = [
  ["bathroom", /\b(bath(room)?|washroom|toilet|w\.?\s?c|lavatory|ensuite|powder)\b/],
  ["kitchen",  /\b(kitchen|kitchenette)\b/],
];
```

**New room kinds are a BOQ decision, not only a parser decision.** `wetRoomArea` and `dryRoomArea` in `material-quantities.ts` only know bathroom/kitchen/general. Porch, balcony, garage, courtyard, terrace and store would currently get steel, tiles, marble and false ceiling like living areas. Options: (a) leave `type` as is and add an optional `Room.kind` (e.g. `"outdoor"`, `"service"`) that the BOQ ignores until the owner defines rules; (b) change BOQ semantics. Recommendation: (a) now, **[Open]** for (b).

**Label association (S9):**
- Candidate labels: text with its insertion point inside the room (point-in-polygon with a tolerance; nearest room within a distance if on a boundary, replacing the lower-left-cell behaviour of `lastAtOrBelow`).
- Reject labels that look like dimensions (`^\d+(\.\d+)?\s*(mm|cm|m|'|")?(\s*[x×]\s*\d+.*)?$`) or sit on `DIM*` layers (already excluded) or are clearly titles (**[Assumption]**: far larger text height than the median).
- Score by keyword match, alphabetic content, and distance to the room's visual centre; one label serves one room.
- Strip MTEXT format codes (`\\[A-Za-z][^;]*;`, `{\\f…;…}`, `%%u`) in `parse-dxf.ts`, and apply `cleanRoomName` and title-casing in both paths.

**Area:**
- Keep `Room.area` centreline-based (INV-4) so existing BOQs do not shift unexpectedly.
- Add `Room.netArea` using per-edge inward offset. For a rectangle: `(w - t1/2 - t2/2) x (h - t3/2 - t4/2)`. For general rectilinear: `A - sum(L_i t_i / 2) + sum(corner t_a t_b / 4)`. For irregular shapes use polygon offset.
- **[Open]:** which quantities should use which area. Today tiles, marble, false ceiling and paint-ceilings use the same `floorArea`, so tiles are overstated by roughly the wall-halves (about 6% on the simple plan, my estimate). Steel and slab items per "covered area" arguably should use gross built-up area including walls. Do not change prices silently: gate behind a rules flag after the owner decides.

### 5.F Validation and confidence reporting (S11)

Checks, each with a code, a severity and an entity link:

| Code | Severity | Trigger |
|---|---|---|
| `UNIT_AMBIGUOUS` / `UNIT_HEADER_IMPLAUSIBLE` / `UNIT_UNSUPPORTED` | error | section 5.A |
| `NO_ROOMS` / `ROOM_NOT_CLOSED` | error | zero rooms, or rooms lost at a gap |
| `GAP_BRIDGED` / `WALL_EXTENDED` | warning | S5 inferred geometry |
| `PLAN_ROTATED` | info | rotation applied |
| `PLAN_NON_ORTHOGONAL` | error | diagonal wall length above a threshold |
| `SITE_REGION_REMOVED` / `CAVITY_REMOVED` | info/warning | S7 |
| `OPENING_UNPLACED` / `OPENING_MERGED` | warning/info | S10 |
| `AREA_LABEL_MISMATCH` | warning | computed room area vs label area differs by more than 15% (**[Assumption]**) |
| `AREA_VS_LEAD_MISMATCH` | warning | total area vs `Lead.coveredAreaSqFt` outside 0.5 to 1.5 (**[Assumption]**, lead data is client-declared and rough) |
| `ROOM_AREA_ZERO_OR_HUGE` | error | zero-area room, or one room above 60% of total with no label |
| `UNLABELLED_ROOMS` | info | rooms still named "Room N" |

**Gating:** `finalize/route.ts` refuses to price while any `error` is unresolved. Users resolve errors by confirmation or correction; warnings are shown, not blocking. `CardReviewPanel.tsx` shows the report above the tables. Change the "Units are detected automatically" copy (N8).

---

## 6. Prioritized implementation phases

Order changed from your suggestion in one respect: **the report channel and API wrapper come first (Phase 0)**, because every later phase emits warnings and the BOQ-gating depends on it. The rest follows your order.

### Phase 0: safety net and contract (Complexity: Medium)

| Field | Content |
|---|---|
| Priority | Critical (enabler) |
| Problem | No warning channel, undefined parser-to-BOQ invariants, no way to measure progress |
| Root cause | RC6; N2 |
| Source files | `shared-types/src/index.ts` (consolidate the duplicate `Opening`, add optional fields), `parse-dxf.ts` (add `parseDxf` + wrapper), new `report.ts`, `finalize/route.ts` (read meta, no blocking yet) |
| Solution | Types in 4.3; INV-1..5 documented in `shared-types`; empty-report plumbing; eval harness skeleton (section 7) |
| Tests required | Wrapper returns identical geometry for all fixtures (snapshot of current output stored as a **legacy baseline**, never edited); type-level tests |
| Dependencies | None |
| Risk | Low. Optional fields only. `parse-dxf.test.ts` mocks `dxfToGeometry`; keep the call signature |

### Phase 1: unit detection (Complexity: Medium)

| Field | Content |
|---|---|
| Priority | Critical (errors of 3x to 100x on every quantity) |
| Problem | U1, U2, U3, N3 |
| Root cause | RC5 |
| Source files | `parse-dxf.ts: feetPerUnit, parseDxfToGeometry`; new `units.ts`; `cad-upload/route.ts`; `finalize/route.ts`; `CardReviewPanel.tsx`; README copy |
| Solution | Section 5.A. Keep `feetPerUnit(insunits, maxExtent)` exported (existing tests call it) but mark deprecated, and implement the new logic separately |
| Tests required | Probes U1-U3 converted to spec; metamorphic unit invariance (section 7); plausibility range table; ambiguous case returns `needsConfirmation` |
| Dependencies | Phase 0 |
| Risk | Medium. Drawings that "worked by luck" now prompt for confirmation. Existing `feetPerUnit` tests pin current behaviour, so the new decision must be a different function |

### Phase 2: tolerance and normalization (Complexity: Medium-High)

| Field | Content |
|---|---|
| Priority | Critical |
| Problem | L2 near-miss corners, N4, N5, I-03 partial overlaps, L5 rotation |
| Root cause | RC1, RC3 |
| Source files | New `normalize-segments.ts`; `line-plan.ts: dedupeSegments, key, isAxisAligned`; `dxf-to-geometry.ts` |
| Solution | Section 5.B steps 1-5. `dedupeSegments` stays exported and its tests stay green; it becomes a thin call into the new module |
| Tests required | Unit tests per step; invariance under translation, rotation, shuffle, duplicate and split; `line-plan.test.ts` untouched and green |
| Dependencies | Phase 0 (warnings), Phase 1 (everything is in feet) |
| Risk | Medium. Snapping can merge distinct walls; keep `snap` small and report the cluster count |

### Phase 3: unified wall graph and thickness (Complexity: High)

| Field | Content |
|---|---|
| Priority | Critical |
| Problem | I-03, I-04, I-05, I-08, polyline walls always exterior, plot boundary affecting classification |
| Root cause | RC2, RC4 |
| Source files | `dxf-to-geometry.ts: dxfToGeometry` (both branches), `line-plan.ts: segmentsToWalls` |
| Solution | Section 5.C. One segment set, one classification rule. Polyline closed-flag/vertex rules |
| Tests required | P1-P5, L4 converted to spec; unique-length test (138 ft); `sample-house.dxf` and `parse-dxf.e2e.test.ts` regression; BOQ golden deltas (section 8) |
| Dependencies | Phase 2 |
| Risk | **High.** Changes masonry, plaster, bricks, cement, sand, paint for polyline drawings. `parse-dxf.e2e.test.ts` currently asserts 12 walls for `sample-house.dxf`; it encodes the double-count and needs a justified, documented update (see 7.5) |

### Phase 4: room boundary detection (Complexity: High)

| Field | Content |
|---|---|
| Priority | Critical |
| Problem | I-01, I-06, I-07, L1, L3, L4 |
| Root cause | RC1, RC4 |
| Source files | `line-plan.ts: roomsFromWallSegments` (keep the core, add region tree and triage), new `closure.ts` |
| Solution | Sections 5.B closure, double-line and triage |
| Tests required | L1, L2, L3, L4 converted; gap-size sweep; double-line sweep; plot-boundary coverage-ratio cases; existing `line-plan.test.ts` green |
| Dependencies | Phase 2, 3 |
| Risk | **High.** False rooms from bridging; thresholds are guesses until real data |

### Phase 5: doors and windows (Complexity: Medium)

| Field | Content |
|---|---|
| Priority | High |
| Problem | O1, O2, duplicate door, N1, N7 |
| Root cause | RC3 and missing association |
| Source files | `place-openings.ts: snapToWall, nearestOnWalls`, `dxf-to-geometry.ts: toOpening`, `CardReviewPanel.tsx` (openings table) |
| Solution | Section 5.D. Keep `snapToWall` semantics; add a limit and a status instead of changing geometry math |
| Tests required | O1, O2 converted; duplicate-door fixture (`whole_house_connected.dxf`); arc handling in polyline mode; `place-openings.test.ts` and `door-swing.test.ts` green |
| Dependencies | Phase 3 (stable walls, wall ids) |
| Risk | Medium. Dropping or merging an opening changes `woodwork` and wall deductions |

### Phase 6: classification, labels, areas (Complexity: Medium)

| Field | Content |
|---|---|
| Priority | Medium |
| Problem | P6, I-10, I-11, I-13 |
| Root cause | RC2 |
| Source files | `dxf-to-geometry.ts: detectRoomType, cleanRoomName`, `line-plan.ts: detectRoomType, tidyName`, `parse-dxf.ts` (MTEXT cleaning), new `room-type.ts` |
| Solution | Section 5.E |
| Tests required | P6 converted; "showcase" must not become a bathroom; label scoring cases; `netArea` against hand-computed rectangles; viewer `furniture-layout` tests untouched |
| Dependencies | Phase 4 |
| Risk | Medium. `RoomType` changes affect `wetRoomArea`; use the optional `Room.kind` and no BOQ change until decided |

### Phase 7: validation, confidence, gating (Complexity: Medium)

| Field | Content |
|---|---|
| Priority | High (can ship in slices alongside earlier phases) |
| Problem | I-15 |
| Root cause | RC6 |
| Source files | `report.ts`, `finalize/route.ts`, `cad-upload/route.ts`, `CardReviewPanel.tsx`, `onboarding.ts` copy |
| Solution | Section 5.F |
| Tests required | Route tests: finalize returns 4xx while an unresolved error exists; UI test renders warnings; `route-guards.test.ts` stays green |
| Dependencies | Phase 0 for plumbing, each earlier phase for its codes |
| Risk | Low to medium. Over-warning; blocking legitimate quotes |

### Phase 8: real-drawing validation set (Complexity: High, ongoing)

| Field | Content |
|---|---|
| Priority | High |
| Problem | Accuracy on real drawings is unknown |
| Solution | Section 7.3 |
| Dependencies | Data rights and permission (the product's origin with TM Construction means client drawings need explicit permission and anonymization) |
| Risk | Tuning to a small set (overfitting); mitigate with a held-out subset |

---

## 7. Testing and accuracy measurement strategy

### 7.1 Test layers

| Layer | Purpose | Location (proposed) |
|---|---|---|
| Unit | Each algorithm in isolation (clustering, merge, bridging, ring-width, scoring) | `packages/cad-parser/src/*.test.ts` |
| Synthetic fixtures | Known geometry built by a TypeScript DXF builder, so expected values come from construction, not from the parser | `packages/cad-parser/test-support/` |
| Metamorphic | Properties that must hold regardless of absolute values | `packages/cad-parser/src/metamorphic.test.ts` |
| Spec regressions | One test per confirmed issue, expected value derived by hand | `packages/cad-parser/src/regressions.test.ts` |
| Real fixtures | Real drawings with independently measured ground truth | `packages/cad-parser/fixtures/real/` + `ground-truth.json` |
| Integration | Parser to BOQ golden quantities | `packages/rate-cards/src/` or `apps/web/` |

### 7.2 Metamorphic properties (the strongest correctness checks available without real data)

For a synthetic plan P with known rooms and walls, all of these must give the same rooms and wall lengths in feet, within a stated tolerance:

```ts
// sketch, not implemented
for (const unit of ["in","ft","mm","cm","m"]) expect(parse(scale(P, unit), {insunits: code(unit)})).toMatchGeometry(P);
expect(parse(translate(P, randomOffset))).toMatchGeometry(P);       // U3
expect(parse(rotate(P, theta))).toMatchGeometry(P);                 // L5, areas and lengths only
expect(parse(shuffleEntities(P))).toMatchGeometry(P);
expect(parse(addExactDuplicates(P))).toMatchGeometry(P);            // I-03
expect(parse(splitWallsInTwo(P))).toMatchGeometry(P);               // N5
expect(parse(addGapsAtDoors(P, {width: 3}))).toMatchGeometry(P);    // L1 (with symbols)
expect(parse(jitterEndpoints(P, snap * 0.5))).toMatchGeometry(P);   // L2
```

### 7.3 Ground truth: what counts and what does not

- **Synthetic expectations:** derived from the construction parameters (for example "a 20 x 12 ft rectangle has area 240"). Valid for algorithm correctness, not for real-world accuracy.
- **Independently verified real-world measurements:** taken by a person from the drawing's own dimension annotations or a scale measurement, recorded in `ground-truth.json` **without running the parser**, with a second person checking a subset.
- **Never** generate ground truth from parser output. The three existing fixtures were authored alongside the parser and are synthetic for this purpose.
- **Never** invent values: where no independent measure exists, mark the metric "not available".

Real set: 10 to 20 drawings **[Assumption]**, varied in CAD style (single-line, double-line, with and without door gaps, blocks, rotated, offset, different units). Needs client permission and anonymization **[Open]**.

### 7.4 Accuracy metrics

Define matching explicitly so numbers are reproducible:

```
Room match:     predicted room R matches truth room T if IoU(R, T) >= 0.5   [Assumption]
Room P/R/F1:    P = matched / predicted, R = matched / truth
Wall match:     predicted wall W matches truth wall T if collinear within tol and
                overlap_length / T.length >= 0.8                            [Assumption]
Wall P/R:       over matched counts as above
Wall-length error  = (Σ predicted length − Σ truth length) / Σ truth length
Room-area error    = per matched room (area − truthArea) / truthArea; report median and max
Opening P/R:    match by type, position along wall within 0.5 ft, width within 15%   [Assumption]
Duplicate wall rate    = (predicted walls overlapping another predicted wall by > 50%) / predicted walls
Duplicate opening rate = same for openings
Unit correctness       = % of drawings where chosen unit equals truth unit (or flagged for confirmation)
Silent-failure rate    = % of drawings with a wrong result AND no error-severity warning   <- the key safety metric
```

A runner `packages/cad-parser/eval/run-eval.ts` prints a table per fixture. Gate CI on the synthetic suite; keep the real suite report-only until it has enough drawings, then add thresholds.

### 7.5 Handling the characterization probes

- Do **not** delete or rewrite `audit/audit-probes.test.ts` now. When a fix lands, its probe fails by design; that failure is the signal that the bug is fixed.
- In the fix PR, move that probe's assertion into `regressions.test.ts` with the **hand-derived correct value** and a comment naming the probe ID and the reasoning, and leave a skipped or renamed pointer in the audit file. This is a spec change, not "changing the expected output so the test passes", and must be reviewed as such.
- Proposed spec values (all derived by arithmetic or by definition, none from parser output):

| Probe | Correct behaviour |
|---|---|
| U1 | 12 x 10 unitless is resolved to metres (or flagged), never silently feet |
| U2 | 1200-unit unitless span with plausible cm reading is resolved to cm or flagged |
| U3 | Feet drawing offset 1000 units from the origin with span 40 is not read as mm |
| P1 | 2-vertex polyline produces no room; at most a wall chain |
| P2 | Open polyline with endpoints far apart is a wall chain, not a room, with a warning |
| P3 | Wall run total = 138 ft |
| P4 | 4 outline walls + 1 interior line = 5 unique segments |
| P5 | Replace with a shared-wall case; single rectangle stays 4 exterior walls |
| P6 | WC is a bathroom in both paths |
| L1 | 1 room of 240 sq ft with a bridged closure warning, or an explicit `ROOM_NOT_CLOSED` error. Never silently zero rooms |
| L2 | 1 room (gap below `snap`) |
| L3 | 1 room, no cavity room; wall thickness measured from the pair |
| L4 | 1 room (the house); plot outline excluded; house walls exterior |
| L5 | 1 room of 240 sq ft |
| O1 | 1 window |
| O2 | Opening `placed: false` with a warning, not snapped to a wall 100 ft away |

- **`parse-dxf.e2e.test.ts` and `dxf-to-geometry.test.ts`** assert 12 walls for the three-rectangle layout, which encodes the double count. After Phase 3 the unique count is lower. Treat that as a documented spec change with the 138 ft derivation next to it, not as a casual edit.
- **`parse-dxf.test.ts`** mocks `./dxf-to-geometry` and asserts how `parseDxfToGeometry` calls it. Keep `dxfToGeometry({entities}, construction)` callable with the same arguments, or those tests must be rewritten with the same intent.

---

## 8. BOQ regression risks

### 8.1 How geometry feeds quantities [Verified]

| BOQ item | Formula (`calculate-boq.ts`, `material-quantities.ts`) | Geometry sensitivity |
|---|---|---|
| masonry | `netWallArea = Σ(length x height) - Σ(width x height of openings)` | wall length, opening area (N2) |
| plaster | `2 x netWallArea` | same |
| brick | `Σ length x height x bricksPerSqft x (thickness / refThickness)`, scaled by net/gross | length, thickness |
| cement, sand | bricks and plaster area | same |
| tileFixing / marbleFixing | wet or dry room area (by `type`), per category | room area, room `type` |
| falseCeiling | dry room area | room area, `type` |
| shuttering, foundation, rccRoof, electrical | `floorArea` | total room area, including phantom rooms |
| steelMaterial, steelFixing | `floorArea x kgPerSqft / 1000` | total room area |
| paint | `plasterArea + floorArea` | both |
| woodwork | `Σ opening width x height` | opening count and size |
| sanitary | count of rooms with `type === "bathroom"` | classification |

### 8.2 Expected effect of each parser change

| Change | Quantities affected | Direction |
|---|---|---|
| Wall dedupe (Phase 3) | masonry, plaster, bricks, cement, sand, paint | down |
| Interior thickness (Phase 3) | bricks, cement, sand | down |
| Phantom room removal (Phase 4) | all `floorArea` items | down |
| Gap bridging (Phase 4) | rooms appear where none existed; all `floorArea` items | up from zero |
| Unit correction (Phase 1) | everything | by factors such as 3.28 or 10 |
| Opening dedupe (Phase 5) | woodwork, masonry deductions | woodwork down, masonry up |
| Wall gaps kept continuous (INV-1) | masonry and plaster | prevents double deduction |
| `netArea` adoption (Phase 6, if approved) | tiles, marble, ceilings | down about 6% on the simple plan (my estimate) |
| Room kind classification | tile, steel, ceiling for outdoor spaces | depends on owner rules **[Open]** |

### 8.3 Regression tests to add

1. **Golden BOQ per fixture** (`sample-house.dxf`, `whole_house_simple_plan.dxf`, `whole_house_connected.dxf`, `sample-house-plan.dxf`): freeze line-item quantities **before** Phase 1 as `legacy-baseline.json`, never edited. After each phase, compare against a separate `expected-delta.md` listing each changed line item with the geometric reason. A line item that changes without a listed reason fails review.
2. **Invariant tests** in `boq-engine`: `netWallArea` never negative; BOQ is invariant when a wall is split into two collinear pieces; BOQ is invariant when an exact duplicate wall is removed only if the parser did the dedupe (i.e., test parser output, not engine input).
3. **N2 test:** a geometry with a wall split at a door gap plus the door opening must produce the same net area as a continuous wall plus the door.
4. **Unit invariance test at BOQ level:** the same plan in mm and in feet gives the same BOQ total.
5. **Round-trip test:** upload route to `finalize` route on each fixture with a known rate card, assert totals within the documented delta.
6. Keep `correctness.test.ts`, `calculate-boq.test.ts`, `material-quantities.test.ts`, `estimate-project.test.ts` untouched; they test the engine on hand-built geometry and should not change at all.
7. **Viewer smoke:** `wall-cuts.test.ts`, `connect-rooms.test.ts` (uses two real fixtures), `furniture-layout*.test.ts` must stay green; the viewer assumes wall and opening coordinate agreement (`across <= th/2 + 0.25`), which Phase 3 and 5 must preserve.

### 8.4 Stored data

Existing `CadFile.geometry` and `boq` JSON rows are unaffected (optional fields only, `boq` is a saved snapshot). Improvements apply on re-upload. Show `meta.parserVersion` and a "re-upload to re-read this drawing" hint on old projects. No Prisma migration is needed.

---

## 9. Recommended implementation order

1. **Phase 0:** types, wrapper, report plumbing, eval harness, legacy baselines.
2. **Phase 1:** units, with confirmation flow and finalize gating (largest silent error).
3. **Cheap Phase 3 slice:** closed/vertex-count filter for polylines and the single wall-set merge (P1, P2, P4). Low risk, high value.
4. **Phase 2:** normalization module.
5. **Phase 3 remainder:** shared-wall dedupe and topology thickness. Ship with the BOQ delta document.
6. **Phase 4:** closure, double-line, region triage.
7. **Phase 5:** openings and the openings table in the review UI.
8. **Phase 6:** classification, labels, `netArea`.
9. **Phase 7:** complete the validation codes, tighten gating.
10. **Phase 8:** real-drawing set, tune tolerances, add real-set thresholds.

---

## 10. Definition of done per phase

| Phase | Done when |
|---|---|
| 0 | `parseDxf` returns `{geometry, meta}`; `parseDxfToGeometry` output is byte-identical on all fixtures; invariants INV-1..5 are in `shared-types` docs; eval runner prints a table; legacy baselines committed |
| 1 | U1-U3 spec tests pass; unit-invariance metamorphic test passes; ambiguous case blocks finalize until confirmed; README and UI copy corrected; no existing `feetPerUnit` test edited |
| 2 | Translation, rotation, shuffle, duplicate, split and jitter properties hold on all synthetic plans; `line-plan.test.ts` unchanged and green; L2 and L5 spec tests pass |
| 3 | Unique wall length 138 ft on the three-rectangle plan; no mode switch; polylines and lines coexist (P4); BOQ delta document reviewed and signed off; interior and exterior thickness correct for shared walls |
| 4 | L1, L3, L4 spec tests pass; gap and double-line sweeps characterized; every inferred geometry element has a warning |
| 5 | O1, O2 spec tests pass; every opening has `placed` and, when placed, a `wallId`; openings table exists in the review UI; arcs work in all paths |
| 6 | One classifier module; P6 and "showcase" tests pass; one label per room; `netArea` matches hand-computed values; BOQ semantics for new room kinds decided or explicitly deferred |
| 7 | Every error code is covered by a test; finalize blocks on unresolved errors; UI shows the report; silent-failure rate on the real set is reported |
| 8 | At least 10 real drawings with measured ground truth; all metrics in 7.4 reported; thresholds agreed; held-out subset reported separately |

---

## 11. Remaining limitations and unresolved questions

**Limitations after all phases**

- Single storey only; multiple floors or stacked sheets are out of scope.
- DWG remains unsupported.
- Curved walls (arcs, bulge) are not supported unless added deliberately.
- Non-orthogonal plans beyond a uniform rotation will return walls without rooms (with an explicit error) unless a general planar-face algorithm is added later.
- No guarantee of correct interpretation of arbitrary DXFs; the target is "correct on common styles, and loudly flagged otherwise".

**Open questions**

1. What does the pinned `dxf-parser` (^1.1.2) expose: LWPOLYLINE `shape` and `bulge`, `inPaperSpace`, layer `frozen/visible`, INSERT and block definitions, DIMENSION entities? (Check `node_modules/dxf-parser`.)
2. Plausible footprint range and unit prior for the Pakistani market; are marla or sq yd drawings common, and do users draw in feet or mm in practice?
3. Which area (centreline, net, gross built-up) should each BOQ item use? Needs the business owner, not the parser.
4. How should porch, balcony, garage, courtyard and store be priced? (`RoomType` and BOQ semantics.)
5. Keep or drop unplaced openings in quantities?
6. Are client drawings drafted with door gaps, symbol-only doors, or blocks (INSERT)? This decides how much Phase 4 and 5 matter.
7. Can real client drawings be used for the validation set, and under what anonymization terms?
8. Are the initial tolerances (`snap` 0.05 ft, `extend` 0.4 ft, `bridgeMax` 7 ft, double-line 0.2 to 1.25 ft) right? These are **[Assumption]**s with no real-data support yet.
9. Should the user be allowed to override layer mapping (for example `A-WALL`) in the UI, and where is it stored (per organization)?

---

## Final summary

### The five most important changes to implement first

1. **Report channel and `parseDxf` wrapper.** Without it nothing else can be flagged or gated. (Phase 0)
2. **Unit detection by span with plausibility and user confirmation.** Prevents 3x to 100x errors on every quantity. (Phase 1)
3. **Polyline room filter** (closed or first-equals-last, at least 3 vertices, positive area) **and one merged wall set** for polylines and lines. Cheap and removes P1, P2, P4. (early Phase 3)
4. **Segment normalization:** tolerance clustering, split at junctions, merge collinear overlaps, rotate upright. (Phase 2)
5. **Topology-based wall dedupe and exterior/interior classification** plus the written INV-1 rule (walls continuous through openings). (Phase 3)

### Files and functions to modify first

| Order | File | Function / area |
|---|---|---|
| 1 | `packages/shared-types/src/index.ts` | `Geometry`, `Wall`, `Room`, `Opening` (consolidate duplicate `Opening`, add optional fields) |
| 2 | `packages/cad-parser/src/parse-dxf.ts` | `feetPerUnit`, `parseDxfToGeometry` (add `parseDxf`), MTEXT cleanup |
| 3 | `packages/cad-parser/src/dxf-to-geometry.ts` | `dxfToGeometry` (mode switch, polyline filter, wall merge), `detectRoomType`, `cleanRoomName`, `toOpening` |
| 4 | `packages/cad-parser/src/line-plan.ts` | `dedupeSegments`, `segmentsToWalls`, `roomsFromWallSegments` |
| 5 | `packages/cad-parser/src/place-openings.ts` | `snapToWall`, `nearestOnWalls` (distance limit, `placed`) |
| 6 | `apps/web/src/app/api/projects/[id]/cad-upload/route.ts`, `finalize/route.ts`, `components/CardReviewPanel.tsx` | report, confirmation, gating, openings table |

### Highest-risk changes

1. **Wall dedupe and interior thickness** (Phase 3): changes prices on existing workflows; needs a signed-off delta document.
2. **Gap bridging and region triage** (Phase 4): can create false rooms or remove real ones; thresholds are unvalidated.
3. **Unit confirmation gating** (Phase 1): changes the upload and finalize flow users already know.
4. **Opening dedupe and unplaced policy** (Phase 5): changes `woodwork` and deductions, and there is no openings editor today.
5. **Rotation** (Phase 2): changes coordinates relative to the source DXF.

### Implementation complexity

| Phase | Scope | Complexity |
|---|---|---|
| 0 | Contract, wrapper, harness | Medium |
| 1 | Units and confirmation | Medium |
| 2 | Normalization and rotation | Medium-High |
| 3 | Unified wall graph | High |
| 4 | Closure, double-line, triage | High |
| 5 | Openings | Medium |
| 6 | Classification, labels, areas | Medium |
| 7 | Validation and gating | Medium |
| 8 | Real validation set | High (ongoing, data-dependent) |
