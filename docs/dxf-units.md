# DXF unit detection and confirmation (Phase 1)

Every length in `Geometry` is **feet**. The parser converts drawing units to feet
in one place: `resolveUnits()` in `packages/cad-parser/src/units.ts`, called by
`parseDxf()`. Unit detection is a best-effort aid. It is **not** perfectly
accurate, and an unitless drawing can never be proven to be in a given unit.

## Supported units

| `$INSUNITS` | Unit | Feet per unit |
|---|---|---|
| 0 | unitless | unknown, needs confirmation |
| 1 | inch | 1/12 |
| 2 | foot | 1 |
| 4 | millimetre | 1/304.8 |
| 5 | centimetre | 1/30.48 |
| 6 | metre | 3.280839895 |
| 10 | yard | 3 |
| 14 | decimetre | 1/3.048 |
| 21 | US survey foot | 1200/3937 |

### Every `$INSUNITS` code (standard enumeration 0-24)

| Class | Codes | Handling |
|---|---|---|
| Supported | 1, 2, 4, 5, 6, 10, 14, 21 | Converted (table above). |
| Unitless | 0 | `UNIT_METADATA_MISSING`; extents suggestion; confirmation required. |
| Valid but unsupported | 3 miles, 7 km, 8 microinches, 9 mils, 11 angstroms, 12 nanometres, 13 microns, 15 decametres, 16 hectometres, 17 gigametres, 18 astronomical units, 19 light years, 20 parsecs, 22 US survey inches, 23 US survey yards, 24 US survey miles | `UNIT_UNSUPPORTED` (names the unit). **Not converted, never guessed as feet or mm.** Handled as unitless: extents suggestion only, confirmation required. |
| Invalid / malformed | negative, > 24, non-numeric (read as NaN), non-integer type | `UNIT_METADATA_INVALID`. Same handling. |
| Missing header | none | `UNIT_METADATA_MISSING`. Same handling. |

Phase 1 originally mislabelled 3 and 7 (and the other valid unsupported codes) as invalid; corrected in the review. Note: the installed `dxf-parser` 1.1.2 coerces group 70 to an integer, so a fractional value such as `2.5` reaches us as `2` and cannot be detected.

## Decision order

1. **User-confirmed unit** (`ParseOptions.confirmedUnit`, a unit name or `$INSUNITS` code). Always wins, even over a valid header. Source `user`, `confirmed: true`.
2. **Valid explicit `$INSUNITS`**. Source `header`, confidence `high`. If the drawing then measures as a non-building (outside the plausibility rules below), the header is still used but `UNIT_HEADER_IMPLAUSIBLE` is raised and confidence drops to `medium`. A header is trusted, not verified.
3. **Missing, `0` or invalid header**: extents are evaluated (below). The result is **always** `needsConfirmation: true`.

The max-absolute-coordinate heuristic is gone from `parseDxf()`. Dimensions
(`DIMENSION` entities, dimension text) and `$MEASUREMENT` are not used as proof of unit.

## How extents influence suggestions (unitless drawings only)

* Extents are the bounding box of drawn geometry (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC) in raw units: **width and height**, never distance from the origin. Translating a drawing does not change the decision (tested).
* Each of inch, foot, mm, cm, m is a candidate. A candidate is *plausible* if, converted to feet, the footprint (bounding box) has: short side >= 8 ft, long side <= 400 ft, area 150 to 60,000 sq ft (`PLAUSIBILITY` in `units.ts`).
* Site plans: a unit is also a candidate if the full box is implausible but the 5th to 95th percentile "main body" (needs >= 20 coordinates) is plausible. The core test can only **add** candidates (plausible = full OR core); it never removes or hides valid geometry, and the geometry itself is never trimmed. It can add a wrong candidate, which only increases ambiguity (the safe direction).
* 0 plausible: unit `unknown`, source `none`, factor 1 (coordinates left as drawn), `UNIT_CONFIRMATION_REQUIRED`.
* 1 plausible: suggested, confidence `medium`, source `plausibility`.
* 2+ plausible: **ambiguous** (`UNIT_AMBIGUOUS`), confidence `low`. The one whose area is closest to a typical 1,500 sq ft house is the provisional pick. That ordering is a tie-break, not evidence.

## Mandatory confirmation

`meta.unit.needsConfirmation && !meta.unit.confirmed` (helper `unitNeedsConfirmation(meta)` in `@vectroq/shared-types`) means: **geometry is provisional and must not feed a trusted BOQ.** `meta.unit.candidates` lists each interpretation with the resulting size in feet and the reason; `meta.warnings` carries `UNIT_METADATA_MISSING` / `UNIT_METADATA_INVALID`, `UNIT_AMBIGUOUS`, `UNIT_CONFIRMATION_REQUIRED`.

## How a confirmed unit is applied

Call `parseDxf(text, { confirmedUnit: "metre" })` (or a code such as `6`). The coordinates are converted with that unit's exact factor, `meta.unit` becomes `{ source: "user", confirmed: true, needsConfirmation: false, unit, feetPerUnit }`, `suggestedUnit` records what the parser would have used, and `UNIT_USER_CONFIRMED` says whether it overrode the header or the suggestion. An unsupported choice throws.

## Backward compatibility

* `parseDxfToGeometry(text, construction?)` keeps its signature and returns the same geometry shape. For unitless drawings it returns the **provisional** geometry (it cannot carry the flag), so callers that need trust must use `parseDxf()`.
* `feetPerUnit(insunits, maxExtent)` is unchanged and deprecated (audit probes U1-U3 pin its old behaviour). It is no longer used by the parser.
* Provisional (suggested) mm/cm/m factors keep the Phase 0 constants (0.00328084 etc.) so geometry for the unitless fixtures is bit-identical to the legacy baselines. Header and user-confirmed units use the exact factors (differences ~3e-8 relative).
* `ParseUnitInfo` gained only optional fields (`unit`, `insunits`, `needsConfirmation`, `extents`, `candidates`, `suggestedUnit`) and the `"none"` source. Geometry never carries meta.
* Behaviour change to be aware of: drawings with an explicit header now report `source: "header"` instead of `"legacy"`.

## Why these thresholds, and what they get wrong

They are **assumptions I chose, not measured or standard values**, for single-building residential plans (the product's use): 8 ft = narrowest sensible room/dwelling width; 150 sq ft = smallest dwelling-sized footprint; 400 ft and 60,000 sq ft = generous upper bounds for a large villa or small block, wide enough that metre and cm readings of ordinary houses are not rejected. The bounding box area over-estimates built area, so thresholds are loose on purpose. Plausibility never establishes the unit; unitless drawings always need confirmation.

Drawings they can reject (the true unit is then missing from the plausible list; measured with probe drawings in the Phase 1 review):

* Details and fragments: a bathroom or stair detail (< 150 sq ft or < 8 ft wide).
* Large or long projects: commercial/apartment blocks over 60,000 sq ft, plans longer than 400 ft.
* **Multi-building site plans**: six 40 x 30 ft houses spread over about 1 km read as feet are 3,000 ft long, so feet is rejected and inch/cm come out plausible instead (the wrong ones are suggested; confirmation is still required). Two houses 150 ft apart work fine.
* A small outbuilding far from the house when there are fewer than 20 coordinates: the core test is skipped, so the true unit (feet) is rejected.
* Elevations and sections are not footprints but can pass the size test; nothing detects drawing type.

Annotations and extents: text and dimension *entities* (TEXT, MTEXT, DIMENSION, INSERT, POINT) are excluded, but dimension *lines* drawn as LINE, title-block frames, grids and hatch lines are ordinary geometry and enlarge the box. A moderate frame or dimension lines did not change the outcome in the probes (the unit stayed plausible), a frame much larger than the building can. No layer filtering is done (layer names are not reliable).

## Application integration: traced workflow and required changes

Current flow (Phase 1 leaves it unchanged):

| Step | Where | Today |
|---|---|---|
| Upload | `CardReviewPanel.handleFileChange` -> `POST /api/projects/[id]/cad-upload` | Sends only `file`. |
| Parse | `cad-upload/route.ts` calls `parseDxfToGeometry()`; `lib/sample-project.ts` calls it for the bundled sample | Unitless drawings get provisional geometry with no flag. |
| Persist | `cad-upload` upserts `CadFile.geometry` (and clears `boq`); `PATCH .../geometry` overwrites `CadFile.geometry` and clears `boq`; `sample-project` creates `CadFile` | `CadFile` has no unit field; meta is discarded. |
| Finalize | `POST .../finalize` loads `CadFile.geometry`, calls `estimateFromGeometry`, saves `CadFile.boq`, sets status `FINALIZED` | No unit check. |
| BOQ generation | `finalize/route.ts` and `sample-project.ts` (both call `estimateFromGeometry`) | `sample-project` prices immediately. |
| BOQ consumers | `boq-pdf`, share `boq-pdf`, client page, office pages read `CadFile.boq` | Only read what was stored. |

The only way to stop an unconfirmed unitless drawing producing a trusted BOQ is to (a) carry the unit decision to the persistence layer and (b) check it at the two places a BOQ is created. Required changes:

1. **DB (migration)**: add to `CadFile` a nullable JSON column `unit` (store `meta.unit` and `meta.warnings` for unit codes) or scalar columns `unitSource`, `unitConfirmed`, `unitNeedsConfirmation`. Existing rows: backfill `needsConfirmation = false` (legacy, accepted as is) or `true` if you want old drawings re-reviewed.
2. **API, `cad-upload`**: switch to `parseDxf()`. Read an optional multipart field `unit` and pass it as `confirmedUnit` (invalid value -> 422). Persist `meta.unit`. Return `{ geometry, unit, warnings }`; do not change status to a state that allows pricing while `unitNeedsConfirmation(meta)`.
3. **API, new endpoint** (e.g. `POST .../unit`): body `{ unit }`. It must re-parse the original DXF, so the file text must be stored (add `CadFile.dxfText` or object-store key) because geometry is already converted; re-running with `confirmedUnit` replaces geometry and `unit`, and clears `boq`.
4. **API, `finalize`**: if the stored unit `needsConfirmation && !confirmed`, return 409 `{ code: "UNIT_CONFIRMATION_REQUIRED" }` and do not price.
5. **API, `geometry` PATCH**: keep the stored unit state. A manual geometry edit does not confirm a unit.
6. **`sample-project`**: call `parseDxf(text, { construction, confirmedUnit: "millimetre" })` (the bundled sample is known to be mm) so it may price, and persist the confirmed unit.
7. **UI, `CardReviewPanel`**: when the upload response has `needsConfirmation`, show the candidates (`unit`, size in ft, `reason`) and the warnings, require choosing one (can override the suggestion), call the unit endpoint, and disable the Finalize button until confirmed.
8. **Tests**: route tests for 409 on finalize, 422 on a bad `unit`, upload with `unit`, sample project confirmed; a panel test for the picker. Existing mocks of `parseDxfToGeometry` in `cad-upload/route.test.ts` and `sample-project.test.ts` must switch to `parseDxf`.

Until these land, `parseDxfToGeometry` callers remain unprotected: the parser can flag the problem, but the app does not stop on it.

## Limitations

* Plausibility is a size heuristic: a 40 x 30 unitless drawing is genuinely feet *or* metres; very large, very small, multi-building, and fragment drawings can fall outside the ranges (see above).
* No layer filtering; extents include every drawn LINE/POLYLINE/CIRCLE/ARC.
* Label areas ("Kitchen 240 sq ft"), `$MEASUREMENT`, and `Lead.coveredAreaSqFt` are not used as independent cues.
* An explicit header is trusted even when wrong; only an implausible size produces a warning.
* Paper space, block/INSERT scaling and per-viewport scales are not examined.
* The web app does not yet enforce confirmation (section above).
