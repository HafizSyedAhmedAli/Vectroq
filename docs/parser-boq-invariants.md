# Parser-to-BOQ invariants

The parser (`packages/cad-parser`) produces `Geometry`; `packages/boq-engine`
turns it into quantities. These rules are the contract between them.
Machine-readable copy: `PARSER_BOQ_INVARIANTS` in `@vectroq/shared-types`.

| ID | Rule |
|---|---|
| INV-1 | Walls are gross. A wall runs continuously through door and window openings. Openings are deducted once, by `netWallArea`. |
| INV-2 | Every physical wall run appears once in `Geometry.walls`. |
| INV-3 | A room is an enclosed space. Wall cavities, site boundaries and outdoor areas are not rooms. |
| INV-4 | `Room.area` is centreline-based. Net area, if added, is a separate field (`Room.netArea`). |
| INV-5 | All lengths are feet, in one frame. Any rotation is recorded in `ParseMeta.rotationRad`. |

## Status at Phase 0 (documentation only; behaviour is unchanged)

| ID | Today | Known cause (audit/plan) |
|---|---|---|
| INV-1 | Holds for the fixtures. Real drawings with door gaps are not handled (rooms vanish instead), so it is unverified in general. | I-01, N2 |
| INV-2 | **Violated.** Polyline mode counts shared walls once per room; line mode keeps overlapping collinear segments. | I-03, N5 |
| INV-3 | **Violated.** Open or 2-vertex polylines, wall cavities and plot outlines can become rooms. | I-04, I-06, I-07 |
| INV-4 | Holds. | |
| INV-5 | Lengths are converted to feet. Phase 1: explicit units convert exactly; unitless or invalid-unit drawings are flagged (`needsConfirmation`, warnings, candidates) and need user confirmation, and the web app enforces it server-side: `finalize` returns 409 until the unit is confirmed, and legacy rows without unit state are unverified (see `docs/dxf-units.md`). Rotation is not applied yet. | I-02 |

Each later phase must state which invariants it brings into compliance.