# TM Construction Company – House Construction Platform

A web application for TM Construction Company (TM CC) that takes a customer enquiry all the way to a priced Bill of Quantities (BOQ) and a 3D visual.

**Live app:** https://tm-construction-company.vercel.app/

| Page | Link |
|---|---|
| Customer form | https://tm-construction-company.vercel.app/ |
| Office – Leads | https://tm-construction-company.vercel.app/office/leads |
| Office – Projects | https://tm-construction-company.vercel.app/office |
| Office – Rates | https://tm-construction-company.vercel.app/office/rates |

1. **Customer** fills in a 3-step form on the homepage and gets a rough price range.
2. **Office staff** turn the enquiry into a Project, upload an AutoCAD `.dxf` drawing, check what the system read from it, and calculate a BOQ.
3. **Office staff** generate a 3D render, print or download the BOQ as a PDF, and share a client-facing page.

This README has two parts:

- [Part A – Guide for office staff](#part-a--guide-for-office-staff-no-coding-needed) (no technical knowledge needed)
- [Part B – Guide for developers](#part-b--guide-for-developers)

---

## Part A – Guide for office staff (no coding needed)

### Pages at a glance

| Page | Address | Who uses it | What it is for |
|---|---|---|---|
| Homepage / intake form | `/` | Customers | Submit a project request |
| Leads | `/office/leads` | Office | Enquiries that don't have a project yet |
| Projects | `/office` | Office | All projects, with search and filters |
| Project workspace | `/office/<project id>` | Office | Upload drawing, review, BOQ, render |
| Printable BOQ | `/office/<project id>/boq` | Office | Print or download the BOQ as PDF |
| Rates | `/office/rates` | Office | Review and approve market rates |
| Client page | `/client/<project id>` | Customer | Render and cost summary only |

### Step 1 – A customer submits the form (page `/`)

The customer completes three steps:

1. **Project details** – name, phone/WhatsApp, city, and engagement model.
2. **Requirements** – house type, floors, bedrooms, budget, plot size, covered area, timeline, and material category (A, B or C). They can optionally upload a plot plan (PDF, DWG, DXF, JPG or PNG, up to 10 MB) and add notes.
3. **Contact confirmation** – tick the box agreeing to be contacted, then submit.

After submitting, the customer sees a **rough starting range** (±10%) if the system could find market rates for their city. If not, they see a message that a representative will follow up. Either way, the lead is saved.

### Step 2 – Turn the lead into a project (page `/office/leads`)

1. Open **1 · Leads** in the top menu.
2. Find the customer. Their plot plan, if they uploaded one, is stored with the lead.
3. After you've met the client, check the **City**, **Model** and **Category**. Change them if the meeting changed anything.
4. Add **Meeting notes** (optional).
5. Click **Create project**. You are taken to the project workspace.

### The three engagement models

The model decides which **sales tax** is added to the BOQ. The more of the job the company does, the higher the tax.

| Model | Meaning | Tax |
|---|---|---|
| 1 | Land & Build, Then Sell – TM CC buys the plot, designs, builds and sells | **15%** |
| 2 | Construction on Client's Plot – client gives the plot, TM CC designs and builds | **10%** |
| 3 | Client's Plot & Construction Cost – client provides plot and budget, TM CC manages the work | **5%** |

> These percentages are set in one place in the code (`MODEL_TAX_PERCENT`). If the real figures differ, ask a developer to change them (see Part B).

### Step 3 – Upload the drawing (project workspace)

1. In the **Drawing & cost estimate** box, click **Choose File**.
2. Select your `.dxf` file.
3. Wait for "Parsing drawing…" to finish. The system lists the rooms and walls it found.

**Only `.dxf` files work.** If your drawing is a `.dwg`, open it in AutoCAD and use *Save As → AutoCAD DXF*. Uploading a `.dwg` shows an error.

#### Where do I get a sample file to try?

Two sample drawings are included in the project folder:

| File | What it contains |
|---|---|
| `packages/cad-parser/fixtures/whole_house_simple_plan.dxf` | **Recommended.** A full 12 m × 10 m house: 7 rooms (including 2 bathrooms and a kitchen), 7 doors, 8 windows, drawn in millimetres. |
| `packages/cad-parser/fixtures/sample-house.dxf` | A very small test: 3 rooms (Kitchen, Living Room, Bathroom), 1 door, 1 window, in feet. |

If you can't find them, ask a developer to send you the file or the project folder.

#### How should our own drawings be prepared?

For the system to read a drawing correctly, the drafter should follow these rules:

- **Layers:** put the walls on a layer named `WALLS`, doors on `DOORS`, and windows on `WINDOWS`. Upper or lower case is fine, and `WALL`, `DOOR`, `WINDOW` also work.
- **Walls:** either draw each room as one **closed polyline** on `WALLS`, or draw walls as separate **straight, horizontal/vertical lines** on `WALLS` that fully close each room. Walls that don't close, or diagonal walls in the line style, will not produce rooms.
- **Doors and windows:** draw each as a **line** on its layer. The line's length is the opening width. (Arcs for door swings are ignored.)
- **Room names:** type the room name as **text** (TEXT or MTEXT) on any layer other than the three above, inside the room. Layers beginning with "DIM" are ignored.
  - A name containing *bath*, *washroom*, *toilet* or *WC* is treated as a **bathroom** (used to count sanitary fittings).
  - A name containing *kitchen* is treated as a **kitchen**.
  - Anything else is a general room.
- **Units:** set the drawing units in AutoCAD (millimetres, centimetres, metres, feet or inches). If units are missing, any drawing larger than 500 units across is assumed to be millimetres.
- **Single storey:** the drawing is priced as one floor.

The system **assumes**: wall height 10 ft, door height 7 ft, window height 4 ft, outer walls 9 in thick, inner partitions 4.5 in. A plan view doesn't contain these, so they cannot be read from the file.

### Step 4 – Check and correct what was read

Always glance over the summary tiles and tables before pricing:

- **Rooms table** – you can edit each room's **name**, **type** (General, Kitchen, Bathroom) and **area**, delete a room, or drag rooms to re-order them.
- **Walls table** – edit **length** and **height**, delete a wall, or re-order.
- If you see "No rooms were detected", the drawing probably doesn't follow the layer rules above.

Click **Save corrections** after editing. Saving **clears any BOQ already calculated**, so you must calculate it again.

> Make sure bathrooms are typed **Bathroom**. This is what decides how many bathrooms are charged for.

### Step 5 – Calculate the BOQ

1. Click **Calculate BOQ**.
2. The **first** BOQ for a city and category can take up to about 2 minutes, because the system searches the internet for current prices. After that, the same rates are reused for 30 days, so it is much quicker.
3. The BOQ appears in the **Bill of Quantities** panel, grouped into Structure, Masonry & Plaster, Finishes, Services & Fixtures, and Materials, with subtotal, **sales tax (by model)** and total.
4. The project status changes to **FINALIZED**.

If it fails with *"Could not get live market rates…"*, click **Calculate BOQ** again, or add rates yourself on the **Rates** page. Nothing is saved when this happens.

**What the BOQ includes and excludes:**

- **Category A:** marble flooring in living areas; **Category B/C:** tiles everywhere. Kitchens and bathrooms are always tiled. False ceiling is only in dry (non-kitchen/bathroom) rooms.
- Door and window openings are deducted from wall and plaster quantities.
- Steel is estimated at 4 kg per sq ft of covered area.
- *Not included:* boundary wall and gate, water tank, boring and pump, gas and utility connections, kitchen cabinets and appliances, light fixtures, furniture, consultant and approval fees. (This list is also printed on the BOQ.)
- Foundation and electrical are **not** searched automatically. They only appear in a BOQ if they were added by hand on the Rates page.

### Step 6 – Generate the 3D render

1. In the **3D Visualization** box, click **Generate 3D render**. This needs a drawing to be uploaded first.
2. It can take up to a minute. Click **Regenerate render** for another attempt.
3. If it fails, the **BOQ is not affected**. Just retry later.

The render is an illustrative picture. It is **not** used to calculate any quantities.

### Step 7 – Print, download and share

In the Bill of Quantities panel:

- **Print / Save PDF** opens the printable BOQ page. Use your browser's print dialog, or click **Download PDF** on that page.
- **Client View** opens the page you can show or send to the customer. It shows the **render and cost summary by group only** (no item-by-item rates).

### Rates page (`/office/rates`)

- **Search current prices** – enter a city and category, and the system searches for prices and saves them as a **draft**.
- Review each price (you can edit them, and each shows its source link and date), enter your name under **Approved by**, then click **Approve** or **Reject**.
- Approved rates for a city and category are reused for 30 days. After that they are refreshed automatically the next time a BOQ is calculated.
- **Labour rates are fixed company rates** (they never change by city): masonry Rs 50/sq ft, plaster Rs 30/sq ft, shuttering Rs 45/sq ft, steel fixing Rs 10,000/ton, sanitary Rs 12,000 per bathroom, tile fixing Rs 50/sq ft, marble fixing Rs 40/sq ft, woodwork Rs 350/sq ft, and false ceiling Rs 350 (A), Rs 275 (B) or Rs 200 (C) per sq ft.

### Common problems

| What you see | What it means / what to do |
|---|---|
| ".dwg files aren't supported yet" | Export the drawing as `.dxf` from AutoCAD and upload that. |
| "Could not parse this DXF file" | The file is damaged or not a real DXF. Re-export it. |
| "No rooms were detected" | Check the layer names and that each room's walls are fully closed. Or correct the rooms manually. |
| Room areas look 1000× too big or small | The drawing units are wrong. Set the units in AutoCAD and re-export. |
| "Could not get live market rates" | The price search failed. Try again, or add rates by hand on the Rates page. |
| Render failed | Retry later. It doesn't affect the BOQ. |
| BOQ disappeared | You saved corrections or uploaded a new drawing. Click **Calculate BOQ** again. |

---

## Part B – Guide for developers

### Tech stack

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Web app:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/base-ui components
- **Database:** PostgreSQL via Prisma 6
- **Tests:** Vitest (unit and component), Playwright (end-to-end, `tests/e2e`)
- **PDF:** `@react-pdf/renderer`. **Images:** `sharp`
- **AI services:** Tavily (price search) + Cloudflare Workers AI (price extraction), Cloudflare Flux or Google Gemini (3D render)

### Project layout

```
apps/
  web/                    Next.js app (pages, API routes, components)
packages/
  shared-types/           Shared types, city list, fixed labour rates, model tax table
  lead-intake/            Form options and validation (shared by browser and API)
  cad-parser/             DXF -> geometry (walls, rooms, openings)
  boq-engine/             Geometry + rate card -> BOQ line items, tax, total
  rate-cards/             Rate card helpers, estimate functions, fixed-labour overlay
  rate-research/          Live price search and parsing (Tavily + Cloudflare LLM)
  render-engine/          Schematic building and AI image generation
  db/                     Prisma schema, migrations, client
```

### Prerequisites

- Node.js **20.9 or newer**
- pnpm **10.25** (`corepack enable` then `corepack prepare pnpm@10.25.0 --activate`)
- A PostgreSQL database (local, Supabase, Neon, etc.)
- API keys (see below). The app runs without them, but price search and renders won't work.

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env
#    then fill in the values (see the table below)

# 3. Create the database tables and Prisma client
cd packages/db
pnpm migrate        # prisma migrate dev
pnpm generate       # prisma generate
cd ../..

# 4. Add the static assets the pages expect
#    apps/web/public/tmcc-logo-full.png   (logo)
#    apps/web/public/demo.jpg             (hero / fallback render image)

# 5. Start the dev server
pnpm --filter @tmcc/web dev
#    open http://localhost:3000
```

> `public/` is listed in `.gitignore`, so the logo and `demo.jpg` are **not** in the repository. Copy them in manually on every fresh checkout. Generated renders (`public/renders`) and uploaded customer plans (`public/lead-plans`) are also saved there.

### Environment variables

`packages/db/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by the app |
| `DIRECT_URL` | Direct (non-pooled) connection string used by Prisma migrations |

`apps/web/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Same Postgres connection string |
| `AI_RATE_PROVIDER` | Price search provider (`tavily`) |
| `TAVILY_API_KEY` | Tavily key used for web price searches |
| `AI_RATE_CF_MODEL` | Cloudflare model that extracts prices (default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI credentials (used for price extraction and, if chosen, renders) |
| `AI_IMAGE_PROVIDER` | `cloudflare` (text-to-image) or `google` (Gemini, uses the floor plan as input) |
| `AI_IMAGE_MODEL` | Image model, e.g. `@cf/black-forest-labs/flux-1-schnell` or `gemini-3.1-flash-image` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Needed only when `AI_IMAGE_PROVIDER=google` |
| `RATE_MAX_AGE_DAYS` | *(optional)* How long an approved rate set is reused. Default 30 |
| `RATE_SEARCH_TIMEOUT_MS` | *(optional)* Timeout for each search call. Default 60000 |

### Commands

```bash
pnpm test                      # run unit tests in every package
pnpm typecheck                 # TypeScript check in every package
pnpm test:e2e                  # Playwright (needs the dev server on :3000)

pnpm --filter @tmcc/web dev    # start the app
pnpm --filter @tmcc/web build  # production build
pnpm --filter @tmcc/boq-engine test   # test a single package
```

### Data model (Prisma)

- **Lead** – a customer enquiry from the intake form (contact, city, model, category, requirements, optional plan file).
- **Project** – created from a lead. Holds `model`, `category`, `city`, `status` (`NEW` → `CAD_UPLOADED` → `FINALIZED`) and meeting notes.
- **CadFile** – one per project. Stores the parsed `geometry` (JSON, editable by staff) and the calculated `boq` (JSON).
- **Render** – one per project, with the image URL and prompt used.
- **RateSet** – a city and category set of unit rates, with status (`DRAFT`, `APPROVED`, `REJECTED`, `SUPERSEDED`), origin (`manual`, `gemini`, `gemini-auto`) and sources.

### How a BOQ is produced

```
DXF file ──► cad-parser ──► Geometry { walls, rooms, openings }   (staff can edit)
                                  │
City + Category ──► getLiveRateCard ──► RateCard (unit rates)
                                  │
Project.model ──► MODEL_TAX_PERCENT ──► tax %
                                  ▼
                         boq-engine.calculateBoq ──► BOQResult (line items, subtotal, tax, total)
```

1. **Parsing** (`packages/cad-parser`). Layers `WALLS`/`DOORS`/`WINDOWS` are recognised case-insensitively. Rooms come from closed `LWPOLYLINE`s, or, if there are none, from axis-aligned wall `LINE`s that are split into a grid of cells (`line-plan.ts`). Units are read from `$INSUNITS`, with a guess of millimetres when the drawing is over 500 units wide. `MTEXT` is treated as `TEXT`.
2. **Rates** (`apps/web/src/lib/rate-sets.ts`). `getLiveRateCard(city, category)`:
   - reuses the latest `APPROVED` rate set if it is complete and newer than `RATE_MAX_AGE_DAYS`;
   - if it is fresh but incomplete, searches only the missing items;
   - otherwise searches all items, saves the result as an `APPROVED` `gemini-auto` set, and marks older sets `SUPERSEDED`;
   - if the search fails, falls back to a previously saved complete set, or throws `RateUnavailableError` (the finalize route returns HTTP 502 and saves nothing).

   **There are no built-in market rates.** Fixed TM CC labour rates (`fixedLabourItems` in `shared-types`) are always overlaid and never searched. `foundation` and `electrical` are not searched and only appear if added manually.
3. **Quantities** (`packages/boq-engine/src/material-quantities.ts` and `calculate-boq.ts`). Net wall area deducts openings. Bricks scale with wall thickness. Cement, sand and steel use the assumptions in `MATERIAL_ASSUMPTIONS`. Category A uses marble in dry rooms and tiles in wet rooms. B/C use tiles everywhere.
4. **Tax.** Tax comes from the engagement model, not from the rate card:

   ```ts
   // packages/shared-types/src/index.ts
   export const MODEL_TAX_PERCENT: Record<EngagementModel, number> = {
     1: 15, // Land & Build, Then Sell
     2: 10, // Construction on Client's Plot
     3: 5,  // Client's Plot & Client's Construction Cost
   };
   ```

   `estimateLead` (homepage estimate) and `estimateFromGeometry` (project BOQ) both call `taxPercentForModel(model)`. To change the percentages, edit this one constant and update the matching expectations in `estimate-lead.test.ts` and `estimate-project.test.ts`.

   BOQs already saved keep the tax they were calculated with until **Calculate BOQ** is run again.

### API routes

| Method and route | Purpose |
|---|---|
| `POST /api/leads` | Save a lead (JSON, or multipart with `data` + optional `file`). Returns the lead plus a rough `estimate` |
| `POST /api/projects` | Create a project from a lead |
| `GET /api/projects` | List projects |
| `GET /api/projects/:id` | One project with lead, CAD file and render |
| `POST /api/projects/:id/cad-upload` | Upload a `.dxf` (multipart field `file`) and parse it |
| `PATCH /api/projects/:id/geometry` | Save corrected geometry (clears the saved BOQ) |
| `POST /api/projects/:id/finalize` | Fetch rates, calculate the BOQ, mark project `FINALIZED` |
| `POST /api/projects/:id/render` | Generate the 3D render (failure never affects the BOQ) |
| `GET /api/projects/:id/boq-pdf` | Download the BOQ as PDF |
| `POST /api/rate-sets` | Create a manual draft rate set |
| `POST /api/rate-sets/refresh` | Run a live price search and save a draft |
| `POST /api/rate-sets/:id/approve` / `reject` | Approve (optionally with edited items) or reject a draft |

### Sample and test files

- `packages/cad-parser/fixtures/whole_house_simple_plan.dxf` – full house, LINE walls, millimetres (used in `parse-dxf.real-plan.test.ts`).
- `packages/cad-parser/fixtures/sample-house.dxf` – 3-room polyline sample in feet (used in `parse-dxf.e2e.test.ts`).
- `packages/cad-parser/scripts/generate-fixture.py` – regenerates `sample-house.dxf` (needs Python with `ezdxf`; run from `packages/cad-parser`).
- `packages/rate-cards/src/test-rate-card.ts` – test-only rate card factory. The app itself has no placeholder rates.

### Known limitations and notes

- **No authentication or roles.** All `/office` pages and `/api` routes are open. The client page is reachable by anyone with the project link.
- **Local file storage.** Renders (`public/renders`) and customer plans (`public/lead-plans`) are written to local disk. The app is deployed on Vercel, where the filesystem is read-only or temporary, so on the live site these saves can fail or disappear. Move them to Vercel Blob or S3.
- **DWG is not supported.** Only DXF can be parsed. DWG to DXF conversion is not built.
- **Single storey, fixed heights and thicknesses** are assumed (see `dxf-to-geometry.ts`).
- **Tax percentages and the false-ceiling category mapping** (A 350 / B 275 / C 200) are assumptions that still need to be confirmed by TM CC.
- `RateSet.taxPercent` still exists in the database (default 17) but nothing reads it any more.
- The price search can be slow on the first request for a city, so `/api/leads` and `/finalize` set long `maxDuration` values.

### Contributing

1. Create a branch and make your change.
2. Run `pnpm typecheck` and `pnpm test` at the repo root.
3. Add or update tests next to the code you changed (`*.test.ts` / `*.test.tsx`).
4. Open a pull request.
