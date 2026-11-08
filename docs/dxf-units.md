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

Any other code (miles, km, microns, mils, astronomical units, ...) or a value
that is not an integer is **invalid metadata**: it is ignored with a
`UNIT_METADATA_INVALID` warning and the drawing is handled as unitless.

## Decision order

1. **User-confirmed unit** (`ParseOptions.confirmedUnit`, a unit name or `$INSUNITS` code). Always wins, even over a valid header. Source `user`, `confirmed: true`.
2. **Valid explicit `$INSUNITS`**. Source `header`, confidence `high`. If the drawing then measures as a non-building (outside the plausibility rules below), the header is still used but `UNIT_HEADER_IMPLAUSIBLE` is raised and confidence drops to `medium`. A header is trusted, not verified.
3. **Missing, `0` or invalid header**: extents are evaluated (below). The result is **always** `needsConfirmation: true`.

The max-absolute-coordinate heuristic is gone from `parseDxf()`. Dimensions
(`DIMENSION` entities, dimension text) and `$MEASUREMENT` are not used as proof of unit.

## How extents influence suggestions (unitless drawings only)

* Extents are the bounding box of drawn geometry (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC) in raw units: **width and height**, never distance from the origin. Translating a drawing does not change the decision (tested).
* Each of inch, foot, mm, cm, m is a candidate. A candidate is *plausible* if, converted to feet, the footprint has: short side >= 8 ft, long side <= 400 ft, area 150 to 60,000 sq ft (`PLAUSIBILITY` in `units.ts`; these are assumptions about house-scale plans).
* Site plans: if the full box is implausible for a unit but the 5th to 95th percentile "main body" is plausible, the unit is still a candidate (reason says so). This is only a mitigation for a few stray far-off entities.
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

## Remaining app integration (not done in Phase 1)

The app stores only geometry (`CadFile.geometry`) and has no unit field or unit picker, and `cad-upload`/`sample-project` call the wrapper `parseDxfToGeometry`, so **the web app does not yet enforce confirmation.** To finish:

1. `cad-upload` calls `parseDxf()`; if `unitNeedsConfirmation(meta)` and the request has no `unit` field, it responds with the candidates/warnings and does not store, or stores with a persisted flag.
2. The upload UI (`CardReviewPanel`) shows `meta.unit.candidates` and lets the estimator pick a unit; the request is repeated with `unit` -> `confirmedUnit`.
3. Persist `meta.unit` (new column or JSON field on `CadFile`) and make `finalize` refuse to price while `needsConfirmation && !confirmed`.
4. `sample-project` should pass `confirmedUnit: "millimetre"` (the bundled sample is known to be mm).

## Limitations

* Plausibility is a size heuristic: a 40 x 30 unitless drawing is genuinely feet *or* metres, and a very large or very small real building can fall outside the ranges.
* Extents include every drawn geometry entity (including dimension lines, title blocks, other layers); only the percentile trim mitigates this. No layer filtering.
* Label areas ("Kitchen 240 sq ft"), `$MEASUREMENT`, and `Lead.coveredAreaSqFt` are not yet used as independent cues.
* An explicit header is trusted even when wrong; only an implausible size produces a warning.
* Paper space, block/INSERT scaling and per-viewport scales are not examined.
