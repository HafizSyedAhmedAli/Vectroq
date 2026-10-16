# Vectroq

> "Vectroq" is a working name. The name, tagline, logo, colors and contact details live in one file: `apps/web/src/lib/brand.ts`.

Upload a house plan, get a priced Bill of Quantities (BOQ) and an interactive 3D view.

1. **A customer** fills in a 3-step intake form on the homepage and gets a rough price range.
2. **The team** turns the enquiry into a project, uploads an AutoCAD `.dxf` drawing, checks what the system read from it, and calculates a BOQ.
3. **The team** prints or downloads the BOQ as a PDF and shares a client-facing page with the 3D model and cost summary.

This README has two parts:

- [Part A – Using the app](#part-a--using-the-app)
- [Part B – Developer guide](#part-b--developer-guide)

---

## Part A – Using the app

### Pages

| Page | Address | Used by | Purpose |
|---|---|---|---|
| Intake form | `/` | Customers | Submit a project request |
| Leads | `/office/leads` | Team | Enquiries that don't have a project yet |
| Projects | `/office` | Team | All projects, with search and filters |
| Project workspace | `/office/<project id>` | Team | Upload drawing, review, BOQ, 3D model |
| Printable BOQ | `/office/<project id>/boq` | Team | Print or download the BOQ as PDF |
| Rates | `/office/rates` | Team | Import and approve rate schedules |
| Client page | `/client/<project id>` | Customer | 3D model, cost summary, PDF download |

### 1. A customer submits the form (`/`)

1. **Project details** – name, phone/WhatsApp, city, and engagement model.
2. **Requirements** – house type, floors, bedrooms, budget, plot size, covered area, timeline and material category (A, B or C). An optional plot plan (PDF, DWG, DXF, JPG or PNG, up to 10 MB) and notes can be added.
3. **Contact confirmation** – tick the consent box and submit.

After submitting, the customer sees a **rough range** (±10%) if approved rates exist for their city (or a nearby market). Otherwise they are told someone will follow up. Either way the lead is saved.

### 2. Turn a lead into a project (`/office/leads`)

Check the **City**, **Model** and **Category**, add optional **Meeting notes**, then click **Create project**.

### Engagement models and tax

The model decides which sales tax is added to the BOQ.

| Model | Meaning | Tax |
|---|---|---|
| 1 | Land & Build, Then Sell | **15%** |
| 2 | Construction on the Client's Plot | **10%** |
| 3 | Client's Plot & Client's Construction Cost | **5%** |

These values are placeholders defined in one place: `MODEL_TAX_PERCENT` in `packages/shared-types/src/index.ts`.

### 3. Upload the drawing

In the project workspace, choose a `.dxf` file. The system lists the rooms, walls, doors and windows it found. **Only `.dxf` is supported.** For a `.dwg`, use *Save As → AutoCAD DXF* first.

Sample drawings:

| File | Contents |
|---|---|
| `packages/cad-parser/fixtures/whole_house_simple_plan.dxf` | A 12 m × 10 m house: 7 rooms, 7 doors, 8 windows, in millimetres |
| `packages/cad-parser/fixtures/sample-house.dxf` | 3 rooms, 1 door, 1 window, in feet |

**How drawings should be prepared**

- **Layers:** walls on `WALLS`, doors on `DOORS`, windows on `WINDOWS` (case-insensitive; singular also works).
- **Walls:** draw each room as one closed polyline on `WALLS`, or draw straight horizontal/vertical lines that fully close each room.
- **Doors and windows:** a line on its layer; the line length is the opening width.
- **Room names:** `TEXT` or `MTEXT` inside each room, on any layer other than the three above (layers starting with `DIM` are ignored). Names containing *bath*, *washroom*, *toilet* or *WC* become bathrooms; *kitchen* becomes a kitchen.
- **Units:** set in AutoCAD (mm, cm, m, ft, in). If missing, a drawing wider than 500 units is assumed to be millimetres.
- **Single storey only.**

Assumed values (a plan view can't provide them): wall height 10 ft, door height 7 ft, window height 4 ft, outer walls 9 in, inner partitions 4.5 in.

### 4. Check and correct

Edit room names, types and areas and wall lengths and heights, delete rows, or drag to re-order. Click **Save corrections**. Saving **clears any BOQ already calculated**. Make sure bathrooms are typed *Bathroom*, because that sets the sanitary count.

### 5. Calculate the BOQ

Click **Calculate BOQ**. Rates come from the latest **approved** rate set for the project's city and category. If the city has none, the nearest market with rates is used and the BOQ says so. If no rates exist at all, the calculation fails and nothing is saved; import rates on the Rates page first.

The BOQ is grouped into Structure, Masonry & Plaster, Finishes, Services & Fixtures and Materials, with subtotal, sales tax and total. The project status becomes `FINALIZED`.

- **Category A:** marble flooring in living areas. **B/C:** tiles everywhere. Kitchens and bathrooms are always tiled. False ceiling only in dry rooms.
- Door and window openings are deducted from wall and plaster quantities.
- Steel is estimated at 4 kg per sq ft of covered area.
- *Not included:* boundary wall and gate, water tank, boring and pump, utility connections, kitchen cabinets and appliances, light fixtures, furniture, consultant and approval fees.
- Foundation and electrical only appear if a rate set includes them (they are not required in a CSR).

### 6. 3D model, PDF and client page

The workspace shows an interactive 3D model built from the (corrected) drawing. It is illustrative and is not used to calculate quantities. **Print / Save PDF** opens the printable BOQ; **Client view** opens the page to share with the customer.

### Rates page (`/office/rates`)

- **Import a rate schedule (CSR):** upload a CSV with the columns `city,itemType,unit,unitRate`. Every city needs `brick`, `cement`, `sand` and `steelMaterial`. The whole file is validated first; if anything is wrong, nothing is saved. A template can be downloaded from the page.
- **Drafts:** rate sets created through `POST /api/rate-sets` wait here for review. Edit the rates if needed, enter your name under *Approved by*, then approve or reject.
- **Labour rates are fixed defaults** and are the same for every city: masonry Rs 50/sq ft, plaster Rs 30, shuttering Rs 45, steel fixing Rs 10,000/ton, sanitary Rs 12,000 per bathroom, tile fixing Rs 50, marble fixing Rs 40, woodwork Rs 350, and false ceiling Rs 350 (A), 275 (B) or 200 (C) per sq ft.

`apps/web/data/pakistan-2026.csv` is **sample data** for trying the import. It is not a verified market price list.

### Common problems

| What you see | What to do |
|---|---|
| ".dwg files aren't supported yet" | Export the drawing as `.dxf` and upload that. |
| "Could not parse this DXF file" | The file is damaged or not a real DXF. Re-export it. |
| "No rooms were detected" | Check layer names and that each room's walls are closed, or correct rooms manually. |
| Areas look 1000× too big or small | The drawing units are wrong. Fix them in AutoCAD and re-export. |
| "No rates loaded for …" | Import a CSR for that city (or a nearby one) on the Rates page. |
| BOQ disappeared | You saved corrections or uploaded a new drawing. Calculate it again. |

---

## Part B – Developer guide

### Tech stack

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Web app:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/base-ui components, React Three Fiber
- **Database:** PostgreSQL via Prisma 6
- **Files:** Vercel Blob (customer plot plans)
- **PDF:** `@react-pdf/renderer`
- **Tests:** Vitest (unit and component), Playwright (end-to-end, `tests/e2e`)

### Layout

```
apps/
  web/                    Next.js app (pages, API routes, components)
packages/
  shared-types/           Shared types, city list, fixed labour rates, model tax table
  lead-intake/            Intake form options and validation (browser and API)
  cad-parser/             DXF -> geometry (walls, rooms, openings)
  boq-engine/             Geometry + rate card -> BOQ line items, tax, total
  rate-cards/             Rate card helpers, CSV parsing, estimate functions
  db/                     Prisma schema, migrations, client
```

Packages are published inside the workspace under the `@vectroq/*` scope.

### Setup

Requirements: Node.js 20.9+, pnpm 10.25, a PostgreSQL database.

```bash
pnpm install

cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env
# fill in the values (see below)

cd packages/db && pnpm migrate && pnpm generate && cd ../..

pnpm --filter @vectroq/web dev      # http://localhost:3000
```

Optional assets in `apps/web/public/`: `demo.jpg` (hero image) and a logo file referenced from `brand.ts`. Without a logo, the product name is shown as text.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `packages/db/.env` | `DATABASE_URL` | Postgres connection string |
| `packages/db/.env` | `DIRECT_URL` | Direct (non-pooled) connection used by migrations |
| `apps/web/.env` | `DATABASE_URL` | Same connection string |
| `apps/web/.env` | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for plot plan uploads |

### Commands

```bash
pnpm test                                  # unit tests in every package
pnpm typecheck                             # TypeScript check in every package
pnpm test:e2e                              # Playwright (needs the dev server on :3000)
pnpm --filter @vectroq/web build        # production build
pnpm --filter @vectroq/boq-engine test  # one package

# Import a rate schedule from the command line
pnpm --filter @vectroq/web exec tsx scripts/import-rates.ts data/pakistan-2026.csv \
  --document "Sample rates" --year 2026 --by "Your name" --categories A,B,C
```

### Data model

- **Lead** – an intake form submission.
- **Project** – created from a lead; holds `model`, `category`, `city`, `status` (`NEW` → `CAD_UPLOADED` → `FINALIZED`) and meeting notes.
- **CadFile** – one per project; parsed `geometry` (JSON, editable) and the calculated `boq` (JSON).
- **Render** – optional image record per project (reserved; no generation route exists).
- **RateSet** – rates for a city and category, with status (`DRAFT`, `APPROVED`, `REJECTED`, `SUPERSEDED`) and origin (`csr`, `manual`).

### How a BOQ is produced

```
DXF ──► cad-parser ──► Geometry { walls, rooms, openings }   (editable)
                              │
city + category ──► getRateCardWithBasis ──► RateCard
                              │
project.model ──► MODEL_TAX_PERCENT ──► tax %
                              ▼
                  boq-engine.calculateBoq ──► BOQResult
```

1. **Parsing** (`packages/cad-parser`): layers are matched case-insensitively. Rooms come from closed `LWPOLYLINE`s or, if there are none, from axis-aligned wall `LINE`s split into a grid (`line-plan.ts`). Units come from `$INSUNITS`.
2. **Rates** (`apps/web/src/lib/rate-sets.ts`): `getRateCardWithBasis` looks for the latest `APPROVED` set with origin `csr` or `manual` for the city, then for nearby markets (`searchPlacesFor` in `shared-types`). A set must contain brick, cement, sand and steelMaterial. Fixed labour rates are always overlaid. If nothing is found it throws `RateUnavailableError` and `/finalize` returns 502 without saving.
3. **Quantities** (`packages/boq-engine`): net wall area deducts openings; bricks scale with wall thickness; cement, sand and steel use `MATERIAL_ASSUMPTIONS`.
4. **Tax:** from the engagement model, not the rate card.

### API routes

| Route | Purpose |
|---|---|
| `POST /api/leads` | Save a lead (JSON, or multipart with `data` + optional `file`); returns the lead and a rough `estimate` |
| `POST /api/projects` · `GET /api/projects` | Create / list projects |
| `GET /api/projects/:id` | One project with lead, CAD file and render |
| `POST /api/projects/:id/cad-upload` | Upload and parse a `.dxf` |
| `PATCH /api/projects/:id/geometry` | Save corrected geometry (clears the saved BOQ) |
| `POST /api/projects/:id/finalize` | Price the geometry and mark the project `FINALIZED` |
| `GET /api/projects/:id/boq-pdf` | Download the BOQ as PDF |
| `POST /api/rate-sets` | Create a manual draft rate set |
| `POST /api/rate-sets/import` | Import a CSR CSV |
| `POST /api/rate-sets/:id/approve` · `reject` | Approve (optionally with edited items) or reject a draft |

### Known limitations

- **No authentication or roles.** All `/office` pages and `/api` routes are open, and client pages are reachable by anyone with the project link.
- **Customer plot plans are stored with public Blob URLs.**
- **DWG is not supported**; only DXF can be parsed.
- **Single storey**, with fixed heights and thicknesses.
- Tax percentages, fixed labour rates and the false-ceiling category mapping are placeholder business rules.
- `RateSet.taxPercent` still exists in the schema (default 17) but nothing reads it.

### Contributing

1. Branch, make the change.
2. Run `pnpm typecheck` and `pnpm test` at the repo root.
3. Add or update tests next to the code you changed.
4. Open a pull request.
