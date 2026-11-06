# DXF Parser Accuracy Audit: Vectroq

**Method:** static code review of `packages/cad-parser`, its tests and fixtures, plus the generator scripts.
**Not done:** test suite and fixtures were NOT executed, and no accuracy percentages are reported.
**Status of claims:** each finding is "static, unconfirmed" until `audit/audit-probes.test.ts` is run.

## Executive Summary
The parser is clean and readable, and it works on drawings that follow its conventions exactly:
- closed rectangular room polylines, or fully closed axis-aligned wall lines;
- doors and windows drawn as a single line each;
- explicit `$INSUNITS`, or a metric plan in millimetres.

It is fragile against real-world CAD habits. Its failures are mostly **silent**: no warning channel exists, so a wrong parse looks like a successful one. Existing tests prove it reproduces the author's own fixtures, not that it is accurate on real drawings.

## Existing Architecture
1. `parse-dxf.ts`
   - dxf-parser reads the file.
   - MTEXT is mapped to TEXT.
   - Scale is chosen from `$INSUNITS` (1, 2, 4, 5 or 6), otherwise a heuristic: max |vertex coordinate| > 500 means mm, else feet.
   - Every entity is scaled to feet.
2. `dxf-to-geometry.ts`
   - Layer matching is exact (`WALL(S)`, `DOOR(S)`, `WINDOW(S)`).
   - Any other non-`DIM*` layer's TEXT is treated as a room label.
   - **Mode A:** if any LWPOLYLINE is on the wall layer, each one is a room.
     - Each edge becomes a wall at the exterior thickness.
     - Area comes from the shoelace formula.
     - The label is the first TEXT inside the polygon.
   - **Mode B:** otherwise wall LINEs are used (`line-plan.ts`).
     - Segments are deduped by exact endpoints.
     - Rooms come from a coordinate grid plus union-find flood fill; cells connected to the outside are dropped.
     - Thickness is exterior only if the segment lies on the global bounding box.
3. Doors and windows
   - Each LINE on the door or window layer is one opening, and its width is the line length.
   - `snapToWall` snaps it to the nearest wall.
   - A door ARC supplies hinge and swing direction.
   - Heights are assumed (door 7 ft, window 4 ft).
4. `boq-engine` consumes this geometry.
   - Quantities are net wall area, total room area, and bathroom count (rooms typed bathroom).
   - Parser errors flow straight into the BOQ.

## Test Execution Results
**Executed: none** (no checkout available). Tests read:

| Test file | What it actually checks | Limitation |
|---|---|---|
| `dxf-to-geometry.test.ts` | Hand-built entities | Asserts 12 walls, which encodes the shared-wall double-count as correct |
| `parse-dxf.test.ts` | `dxf-parser` mocked | Real unit handling is tested only via the two fixtures below |
| `parse-dxf.e2e.test.ts` | `sample-house.dxf` → 3 rooms / 12 walls / 2 openings | Expected values come from the same generator script |
| `parse-dxf.real-plan.test.ts` | Simple plan: 7 rooms, 79.5 m, 7 doors, 8 windows | Expected values come from the author's script |
| `line-plan`, `door-swing`, `place-openings`, `polygon` | Unit tests | Good unit coverage, but the inputs are always ideal (closed, axis-aligned, gap-free) |

The simple plan's 79.5 m was re-derived by hand from `generate-whole-house.py` (24+20+10+5.5+5+7+4+4 = 79.5), so it is arithmetically consistent with the drawn segments.

## Fixture Analysis (expected values from generators; "detected" values not observed)
- **sample-house.dxf** (feet, 3 closed polylines, R2010)
  - Expected: 3 rooms (240, 270, 48 sq ft, matching the labels), 1 door (3 ft), 1 window (4 ft).
  - Wall segments: 12 drawn, but two partitions are drawn twice. The drawn total is 158 ft against a unique run of 138 ft, a **+14.5% overcount** (finding I-03).
- **whole_house_simple_plan.dxf** (mm, no `$INSUNITS`, LINE walls)
  - Expected: 7 rooms, 12 wall segments, 7 doors, 8 windows. This exercises the mm heuristic, the line-mode grid and door arcs.
  - The walls are continuous through every door position, which is unlike most real drawings.
- **whole_house_connected.dxf**
  - No generator script is in the repo, so there is no independent ground truth.
  - By reading the file I count 9 wall lines, 7 rooms, 8 windows and **8 door LINEs for 7 ARCs**.
  - Two door lines share the hinge (8500,6500): one is 1000 mm with an arc, one is 800 mm with none. This looks like a duplicate door, and the parser has no opening dedupe.
  - The only existing test asserts the number of added archways (0).

## Accuracy Metrics
**Not computed.** There is no independent, verified ground truth for any real drawing. All three fixtures were authored alongside the parser, so P/R/F1 on them would be circular. If the existing tests pass, they only show reproduction of the author's expectations.

## Identified Issues
| ID | Sev | Issue | Evidence (static) | Probe |
|---|---|---|---|---|
| I-01 | Critical | Line mode loses or merges rooms when walls are broken at doors, or when endpoints miss by more than 0.01 ft (3 mm). | `line-plan.ts`: cells join unless blocked, and any cell touching the outside is dropped. An exterior door gap removes every connected room, silently (only a UI warning when rooms = 0). | L1, L2 |
| I-02 | Critical | Unit detection fails silently. Unitless metric (INSUNITS 0, common) is read as feet, so a 12 m house comes out 3.28x too small and areas 10.8x too small. cm is read as mm. A feet plan offset from the origin is read as mm. | `feetPerUnit` uses the max absolute coordinate, not the extent. No warning, no confidence value. | U1–U3 |
| I-03 | High | Shared walls are double-counted in polyline mode, inflating masonry, plaster and bricks. | The code comment admits it. The test asserts 12. Fixture: +14.5% wall length. | P3 |
| I-04 | High | Any 2-vertex or open LWPOLYLINE on the wall layer becomes a "room", plus a phantom closing wall (a 2-vertex wall is doubled). | No closed-flag or vertex-count check. | P1, P2 |
| I-05 | High | One polyline on the wall layer (border, column outline) discards ALL wall LINEs. | `roomPolylines.length === 0 &&` branch. | P4 |
| I-06 | High | Double-line walls (the most common real drafting style) create a phantom cavity room, and room area includes the wall cavity. | Grid enclosure logic. | L3 |
| I-07 | High | A plot boundary or any outer enclosure becomes a huge "room" (inflating tile, steel and shuttering) and takes the exterior thickness, so the house walls are treated as 4.5 in partitions. | `onEdge` uses the global bounding box. | L4 |
| I-08 | High | Wall thickness is inconsistent between modes: polylines make every wall 9 in, lines assume partitions are 4.5 in. Brick count differs by 2x. | `dxf-to-geometry.ts` | P5 |
| I-09 | Medium | Openings. | - | O1, O2 |
|  |  | - No distance tolerance when snapping, so stray lines attach to the nearest wall. | `snapToWall` | O2 |
|  |  | - Multi-line windows are counted once per line. | One opening per LINE | O1 |
|  |  | - No opening dedupe. | Possible in `whole_house_connected` | - |
|  |  | - INSERT blocks (how most real CAD draws doors and windows) are unsupported. | Entities are filtered by type | - |
|  |  | - Openings are not linked to a room or wall id. | `Opening` type | - |
| I-10 | Medium | Room classification. | - | P6 |
|  |  | - Two divergent regexes (`wc` only in line mode). | `dxf-to-geometry.ts`, `line-plan.ts` | P6 |
|  |  | - No pantry/store/utility/porch/balcony/garage/courtyard types, so open-to-sky areas get steel, tiles and ceilings. | - | - |
|  |  | - "W.C", "Ensuite" and "Lavatory" are missed, which changes the sanitary count. | - | - |
| I-11 | Medium | Room areas are centreline-to-centreline, so floor, tile and steel quantities are overstated by the wall half-thicknesses (roughly 5–6% on the simple plan). | Assumption text says "wall centre-lines". | - |
| I-12 | Medium | Line mode requires every segment axis-aligned. One diagonal, or a rotated plan, returns no rooms while walls are still returned. | `roomsFromWallSegments` | L5 |
| I-13 | Medium | Labels. | - | - |
|  |  | - The first label wins. | - | - |
|  |  | - Dimension text on a non-DIM layer can name a room. | - | - |
|  |  | - MTEXT format codes (`{\f…}`, `\A1;`) are not stripped. | - | - |
|  |  | - Only polyline mode strips "240 sq ft"; only line mode title-cases names. | - | - |
| I-14 | Medium | Unsupported entities and state. | - | - |
|  |  | - Paper space, frozen or off layers and xrefs are not filtered. | - | - |
|  |  | - Legacy R12 POLYLINE/VERTEX is ignored. | - | - |
|  |  | - LWPOLYLINE `bulge` is ignored, so curves become chords. | - | - |
|  |  | - ARC and CIRCLE walls are ignored (and leak rooms in line mode). | - | - |
|  |  | - Layer matching is exact, so `A-WALL` or `WALLS-EXT` is not recognised. | - | - |
| I-15 | Low | No warnings or confidence channel (unit guess, snap distance, dropped entities). README says units are "detected automatically", which overstates it. | `Geometry` has no metadata. | - |
| I-16 | Low | `arcAngles` guesses degrees vs radians by magnitude; ambiguous for arcs with endpoints under 2π degrees. | `door-swing.ts` | - |

## Unsupported Scenarios
INSERT blocks, double-line walls, curved walls, non-orthogonal or rotated plans in line mode, multiple storeys or sheets, plot or site plans mixed with the house, gap-style doors and windows, polyline bulge, R12 POLYLINE, layer conventions other than the three expected names, scaled or paper-space drawings.

## Recommended Improvements (by impact on BOQ)
1. **Surface parse quality**: add warnings, a unit-confidence flag and a "review required" status, and block BOQ calculation while it is set. (I-02, I-15)
2. **Fix unit detection**: use bounding-box span rather than absolute coordinates, and require explicit user confirmation when INSUNITS is 0.
3. **Deduplicate walls**: merge collinear overlapping segments in both modes. (I-03, I-05)
4. **Filter room candidates**: require closed polylines with at least 3 vertices, and reject rooms whose area is too large for the plot. (I-04, I-07)
5. **Add gap tolerance and door-gap bridging** to line mode, and handle double-line walls via offset detection. (I-01, I-06)
6. **Unify wall thickness and room classification** in one shared function. (I-08, I-10)
7. **Opening hardening**: add a snap-distance limit, dedupe, group multi-line windows, and support INSERT blocks. (I-09)
8. **Net-area option** (subtract wall half-thickness). (I-11)
9. **Build a real validation set**: 10–20 real client drawings with hand-measured rooms, walls and openings, then report P/R/F1 and % error.

## Final Verdict: **Needs Improvement**
The parser is dependable only on drawings that follow its conventions. On arbitrary real-world DXFs the identified failure modes (I-01 to I-08) can change quantities by large factors without any error message. Until a real-drawing validation set exists, its accuracy on real drawings is **unknown**, and BOQs derived from it need human review. This verdict is provisional until the probes confirm the static findings.