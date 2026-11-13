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
2. **Valid explicit `$INSUNITS`**. Source `header`, confidence `high`. **If the drawing then measures as a non-building (outside the plausibility rules below), the header is used provisionally but the drawing needs confirmation** (`UNIT_HEADER_IMPLAUSIBLE` + `UNIT_CONFIRMATION_REQUIRED`, confidence `low`): safety over silently pricing a possibly wrong unit. A header is trusted, not verified; a wrong header that still gives a plausible size is not caught.
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

`meta.unit.needsConfirmation && !meta.unit.confirmed` (helper `unitNeedsConfirmation(meta)` in `@vectroq/shared-types`) means: **geometry is provisional and must not feed a trusted BOQ.** `meta.unit.candidates` lists each interpretation with the resulting size in feet and the reason; `meta.warnings` carries `UNIT_METADATA_MISSING` / `UNIT_METADATA_INVALID` / `UNIT_UNSUPPORTED`, `UNIT_AMBIGUOUS`, `UNIT_HEADER_IMPLAUSIBLE`, `UNIT_CONFIRMATION_REQUIRED`.

## How a confirmed unit is applied

Call `parseDxf(text, { confirmedUnit: "metre" })` (or a code such as `6`). The coordinates are converted with that unit's exact factor, `meta.unit` becomes `{ source: "user", confirmed: true, needsConfirmation: false, unit, feetPerUnit }`, `suggestedUnit` records what the parser would have used, and `UNIT_USER_CONFIRMED` says whether it overrode the header or the suggestion. An unsupported choice throws. If the confirmed unit gives an implausible building size the unit is still used (it is the user's decision) but `UNIT_CONFIRMED_IMPLAUSIBLE` is raised.

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

## Application integration (Phase 1B, implemented)

**Storage.** `CadFile.unit` (nullable JSON) holds a `CadUnitState` (`ParseUnitInfo` + warnings + optional `geometryEditedAt`); `CadFile.dxfBlobKey` (nullable text) is the private-blob pathname of the original DXF (`cad-dxf/<projectId>-<suffix>.dxf`, `PLANS_READ_WRITE_TOKEN`, same conventions as lead plans). Both are server-owned and never taken from a request body. `Geometry` is unchanged. Migration `20261108120000_add_cadfile_unit` adds the two columns with no default and no backfill.

**Flow.**

1. `POST /api/projects/[id]/cad-upload` (multipart `file`, optional `unit`): invalid `unit` -> 422. Parses with `parseDxf()`, stores the original DXF in blob storage (failure -> 502, nothing saved), upserts geometry + unit state + blob key, clears any BOQ, deletes the previously stored DXF blob (best-effort). Returns the geometry and `unitState` (`unit`, `warnings`, `needsConfirmation`, `geometryEdited`, candidates inside `unit`). The blob key is never returned.
2. `POST /api/projects/[id]/cad-unit` (JSON `{ unit, replaceEditedGeometry? }`): validates the unit (422), reads the original DXF from blob storage (409 `ORIGINAL_DXF_UNAVAILABLE` if absent), refuses with 409 `MANUAL_EDITS_WOULD_BE_LOST` if the geometry has manual edits unless `replaceEditedGeometry === true`, re-parses with `confirmedUnit`, replaces geometry and unit state, clears the BOQ, sets the project back to `CAD_UPLOADED`, audits `CAD_UNIT_CONFIRMED`. The body can carry no geometry or unit state.
3. `POST /api/projects/[id]/finalize`: reads the persisted unit state first. No state (legacy) or `needsConfirmation && !confirmed` -> 409 `UNIT_CONFIRMATION_REQUIRED` before rates are fetched or `estimateFromGeometry` is called; nothing is written and the project status is unchanged.
4. `PATCH /api/projects/[id]/geometry`: accepts only walls/rooms/openings (a client `meta`, `unit` or key is dropped), keeps the unit decision unchanged, never confirms, and stamps `geometryEditedAt` when a unit state exists.
5. `lib/sample-project.ts`: the bundled sample is genuinely millimetres (its own annotations read "12m x 10m", "12000 mm OVERALL WIDTH"), so it is parsed with `confirmedUnit: "millimetre"` and the unit state is persisted. It goes through the same `evaluateUnitGate` before pricing. It has no `dxfBlobKey` (re-upload to change its unit).
6. UI (`CardReviewPanel` + `UnitConfirmation`): shows warnings, each candidate with its size in feet, lets the user pick a unit (overriding the suggestion), posts to `cad-unit`, shows a confirmed state, disables "Calculate BOQ" while unconfirmed or legacy, asks before replacing unsaved or saved corrections, and shows server errors (including 409). The disabled button only mirrors the server rule.

The BOQ is created in exactly two places, `finalize` and `sample-project`, and both enforce the gate. BOQ readers (PDFs, client page, office pages) only read what was stored.

**Legacy rows (`unit` is null).** Existing finalized projects keep their BOQ untouched (nothing is cleared or backfilled; they are not marked verified). Their unit status is "legacy/unverified": `finalize` returns 409 and prices nothing, so an unfinalized legacy project cannot get a BOQ until the drawing is re-uploaded with a confirmed unit (legacy rows have no stored DXF, so `cad-unit` cannot be used for them). The panel shows "Drawing units not verified" with that instruction.

**Manual edits.** `PATCH geometry` marks the geometry as edited; `cad-unit` then requires an explicit `replaceEditedGeometry: true`. The panel applies the same prompt to unsaved edits.

**Not handled.** DXF blobs of deleted demo organisations and of deleted projects are not removed (the repo has no blob-deletion practice; only a replaced DXF is deleted). Confirming a unit re-reads the file, so it cannot preserve manual corrections (by design: the user must choose to discard them). The `parseDxfToGeometry()` wrapper remains for compatibility but no application code path uses it any more.

## Concurrency (Phase 1B fixes)

`CadFile.revision` is an integer (default 0, migration `20261109120000_add_cadfile_revision`)
that **every** write to the row advances: geometry PATCH, unit confirmation, upload,
and the BOQ write in finalize / sample project. A writer reads the row, remembers the
revision, and writes with `updateMany WHERE projectId AND revision = <remembered>`;
zero matched rows means someone else wrote first, and the request returns
**409 `CAD_FILE_REVISION_CONFLICT`** without overwriting anything.

- The browser receives `revision` in every CadFile response it edits from
  (upload, PATCH, cad-unit, finalize) and must send it back as `expectedRevision`
  on PATCH and `cad-unit` (400 `CAD_FILE_REVISION_REQUIRED` if missing).
- **Why the conditional WHERE and not just a transaction:** under Postgres READ
  COMMITTED an UPDATE locks the row and re-checks its WHERE against the newest committed
  version, so a stale revision matches nothing. Reading inside a transaction alone would
  not prevent the race.
- **Finalize** prices from one snapshot (row + revision), then saves the BOQ *and* sets
  `FINALIZED` in one transaction, only if the revision is unchanged; otherwise the stale
  BOQ is discarded (409).
- **cad-unit and upload** write the row and the project status in one transaction. Upload
  stores the new blob first, deletes the *previous* blob only after the transaction
  commits, and deletes the *new* blob if it does not (including a conflict).
- **Unit gate is fail-closed** (`isTrustedUnit`): trusted only for `source: "user"` with
  `confirmed: true`, or `source: "header"` with `confirmed: false`, each with
  `needsConfirmation === false`, a known unit name (never `unknown`) and a positive
  factor. Phase 0 shapes, `source: "none" | "plausibility" | "legacy"`, missing or
  non-boolean flags, invented unit names all block (`untrusted-state`).
- **Sample project** parses the bundled DXF without a unit first and only applies the
  controlled millimetre confirmation if the parser itself reads it as millimetres at a
  plausible size; otherwise it is stored unconfirmed and not priced.
- Upload is rate limited (20/h per user, 60/h per organisation, 10/h for demo orgs);
  expired-demo cleanup deletes the blobs after the rows.

### Revision semantics

`revision` is the version of the **row** a request saw, not a count of user edits.
It advances on every write to `CadFile`, including the BOQ write in finalize. What it
guarantees: a request can only write if nothing wrote since it read. Consequences:

- Finalize prices one snapshot and saves only if the row is still at that revision.
- After a finalize the revision has moved, so another tab that loaded the drawing
  *before* the finalize gets a 409 on its next edit and must reload. Nothing is lost
  (the BOQ and geometry are intact); it is deliberately conservative. Not advancing on
  the BOQ write would also be safe, because every writer of geometry, unit or DXF also
  clears the BOQ, but that is a behaviour change, so it is a decision, not a bug fix.
- Every response the editor uses carries the new `revision` (upload, PATCH, cad-unit,
  finalize) and the page load passes it in; the panel replaces its copy from each.
- Clearing a BOQ always demotes a FINALIZED project to CAD_UPLOADED in the same
  transaction: geometry PATCH, unit change and re-upload alike. Other statuses are
  left unchanged.

### Real-PostgreSQL integration test

`cad-concurrency.test.ts` models the database in memory and proves the *routes'* logic.
It does not prove PostgreSQL behaviour. `cad-concurrency.pg.test.ts` runs the real
route handlers against a real PostgreSQL server through the real Prisma client
(auth, audit, rate limit, blob storage and the rate-card lookup are the only fakes).
It is skipped unless `TEST_DATABASE_URL` is set, and refuses databases whose name does
not end in `_test`.

```bash
createdb vectroq_test
DATABASE_URL=postgresql://localhost/vectroq_test \
  pnpm --filter @vectroq/db exec prisma migrate deploy
TEST_DATABASE_URL=postgresql://localhost/vectroq_test \
  pnpm --filter web exec vitest run cad-concurrency.pg
```

It covers: a row-lock wait followed by the READ COMMITTED re-check of the conditional
UPDATE; simultaneous unit confirmations; upload vs confirmation; finalize vs PATCH
(deterministic and simultaneous); real rollback using a database trigger that fails the
second write; and two first uploads racing on the unique `projectId`.

**Known limits.** Blobs orphaned by a crash between "blob saved" and "transaction
result" (or by a failed best-effort delete) are not swept automatically; that needs a
periodic job listing `cad-dxf/` and comparing with `CadFile.dxfBlobKey`. Project
deletion has no route today; when one is added it must delete the blob.

## Limitations

* Plausibility is a size heuristic: a 40 x 30 unitless drawing is genuinely feet *or* metres; very large, very small, multi-building, and fragment drawings can fall outside the ranges (see above).
* No layer filtering; extents include every drawn LINE/POLYLINE/CIRCLE/ARC.
* Label areas ("Kitchen 240 sq ft"), `$MEASUREMENT`, and `Lead.coveredAreaSqFt` are not used as independent cues.
* An explicit header is trusted even when wrong, unless the resulting size is implausible (then confirmation is required). A wrong header that still gives a plausible size is not caught.
* Paper space, block/INSERT scaling and per-viewport scales are not examined.
