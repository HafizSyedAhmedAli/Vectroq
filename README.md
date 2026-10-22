# Vectroq

> "Vectroq" is the product name. Each company that signs up also gets its own branding (name, tagline, logo, colour, contact details), edited on the **Settings** page and stored per organization. The platform's own branding lives in `apps/web/src/lib/brand.ts`.

**From floor plan to final quote.** Vectroq is a multi-tenant SaaS for construction companies and contractors (built for the Pakistan market). Upload a DXF house plan and get a priced Bill of Quantities (BOQ), an interactive 3D view, a branded PDF and a shareable client page.

1. **A customer** fills in a 3-step intake form on the company's public page (or an embed on the company's own website) and gets a rough price range.
2. **The team** signs in, turns the enquiry into a project, uploads an AutoCAD `.dxf` drawing, checks what the system read from it, and calculates a BOQ priced from the company's own rates and rules.
3. **The team** downloads the BOQ as a PDF and sends the client a time-limited link to a page with the 3D model and cost summary.

This README has two parts:

- [Part A – Using the app](#part-a--using-the-app)
- [Part B – Developer guide](#part-b--developer-guide)

---

## Part A – Using the app

### Companies, roles and sign-in

Every company is an **organization**. All leads, projects, drawings, rates and settings belong to one organization and are only visible to its members.

| Role | Can do |
|---|---|
| **Owner** | Everything: team and invitations, branding, business rules, plus all Estimator actions |
| **Estimator** | Create projects, upload and correct drawings, calculate BOQs, manage rates, create client share links |
| **Viewer** | Read-only access to projects, BOQs and rates |

- **Sign up** at `/signup` to create a company (you become its Owner). Email verification and password reset are built in.
- **Invite teammates** from **Team** (Owner only). The invite link expires; the last Owner cannot be removed or demoted.
- **Sign in** at `/login`. "Remember me" keeps the session longer.

### Pages

| Page | Address | Used by | Purpose |
|---|---|---|---|
| Landing page | `/` | Visitors | Product overview, pricing examples, sign-up and login |
| Company intake form | `/c/<company slug>` | Customers | Submit a project request to that company |
| Embeddable form | `/embed/<company slug>` | Customers | The same form for an `<iframe>` on the company's own site |
| Dashboard | `/office/dashboard` | Team | Pipeline summary, pending leads, approved rate sets |
| Projects | `/office` | Team | All projects, with search and filters |
| Leads | `/office/leads` | Team | Enquiries that don't have a project yet |
| Project workspace | `/office/<project id>` | Team | Upload drawing, review, BOQ, 3D model, share link |
| Printable BOQ | `/office/<project id>/boq` | Team | Print or download the BOQ as PDF |
| Rates | `/office/rates` | Estimator+ | Import, review and approve rate schedules |
| Business rules | `/office/rules` | Owner | Tax, labour, construction and material assumptions |
| Settings | `/office/settings` | Owner | Company branding and the embed snippet |
| Team | `/office/team` | Owner | Members, roles and invitations |
| Account | `/office/account` | Everyone | Change password, verify email |
| Client page | `/client/<share token>` | Customer | 3D model, cost summary, PDF download (no sign-in) |

`/request` simply redirects to the default company's intake form (`DEFAULT_ORG_SLUG`).

### 1. A customer submits the form (`/c/<slug>`)

1. **Project details** – name, phone/WhatsApp, city, and service type.
2. **Requirements** – house type, floors, bedrooms, budget, plot size, covered area, timeline and material category. An optional plot plan (PDF, DWG, DXF, JPG or PNG, up to 10 MB) and notes can be added.
3. **Contact confirmation** – tick the consent box and submit.

After submitting, the customer sees a **rough range** (±10%) if approved rates exist for their city (or a nearby market). Otherwise they are told someone will follow up. Either way the lead is saved. Plot plans are stored privately and only signed-in members of that company can open them.

To put the form on the company's own website, copy the embed snippet from **Settings**.

### 2. Turn a lead into a project (`/office/leads`)

Check the **City**, **Service type** and **Category**, add optional **Meeting notes**, then click **Create project**.

### Service types, categories and tax

Each company defines its own service types and categories on the **Business rules** page. The defaults:

| Service type | Meaning | Default tax |
|---|---|---|
| 1 | Land & Build, Then Sell | **15%** |
| 2 | Construction on Client's Plot | **10%** |
| 3 | Client's Plot & Construction Cost | **5%** |

| Category | Default label | Flooring in living areas | False ceiling (Rs/sq ft) |
|---|---|---|---|
| A | Premium | Marble | 350 |
| B | Standard | Tiles | 275 |
| C | Economy | Tiles | 200 |

All of these are placeholders. Change them on **Business rules**; the defaults live in `packages/shared-types/src/org-rules.ts`.

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

Defaults used because a plan view can't provide them (editable per company under **Business rules → Construction**): wall height 10 ft, door height 7 ft, window height 4 ft, outer walls 9 in, inner partitions 4.5 in.

### 4. Check and correct

Edit room names, types and areas and wall lengths and heights, delete rows, or drag to re-order. Click **Save corrections**. Saving **clears any BOQ already calculated**. Make sure bathrooms are typed *Bathroom*, because that sets the sanitary count.

### 5. Calculate the BOQ

Click **Calculate BOQ**. Rates come from the latest **approved** rate set for the project's city and category: first the company's own, then the shared default library. If the city has none, the nearest market with rates is used and the BOQ says so. If no rates exist at all, the calculation fails and nothing is saved; import rates on the Rates page first.

The BOQ is grouped into Structure, Masonry & Plaster, Finishes, Services & Fixtures and Materials, with subtotal, sales tax and total. The project status becomes `FINALIZED`. A **"Basis of estimate"** section records the rate source, tax, assumptions and exclusions, and is saved with the BOQ so later rule or rate changes don't alter an issued quote.

- Door and window openings are deducted from wall and plaster quantities.
- Kitchens and bathrooms are always tiled. False ceiling only in dry rooms.
- Steel defaults to 4 kg per sq ft of covered area.
- *Not included by default (editable):* boundary wall and gate, water tank, boring and pump, utility connections, kitchen cabinets and appliances, light fixtures, furniture, consultant and approval fees.
- Foundation and electrical only appear if a rate set includes them.

### 6. 3D model, PDF and client page

The workspace shows an interactive 3D model built from the (corrected) drawing. It is illustrative and is not used to calculate quantities.

- **Download PDF** produces a BOQ with the company's letterhead, grouped items, totals, assumptions, exclusions and signature block.
- **Share** creates a client link valid for **7, 30 or 90 days**. It can be revoked, and the page is marked `noindex`. The link opens `/client/<token>` and includes the PDF download.

### Rates page (`/office/rates`)

- **Shared default library:** every company can price BOQs out of the box from a shared set of default rates. A company **overrides** a city and category by importing its own rates or adding them manually.
- **Import a rate schedule (CSR):** upload a CSV with the columns `city,itemType,unit,unitRate`. Every city needs `brick`, `cement`, `sand` and `steelMaterial`. The whole file is validated first; if anything is wrong, nothing is saved. A template can be downloaded from the page.
- **Drafts:** manual rate sets wait for review. Edit the rates if needed, enter your name under *Approved by*, then approve or reject.
- **Labour rates** (masonry, plaster, shuttering, steel fixing, sanitary, tile and marble fixing, woodwork) are set per company on **Business rules**.

`apps/web/data/pakistan-2026.csv` is **sample data** for trying the import. It is not a verified market price list. Companies should load their own rates before issuing real quotes.

### Common problems

| What you see | What to do |
|---|---|
| ".dwg files aren't supported yet" | Export the drawing as `.dxf` and upload that. |
| "Could not parse this DXF file" | The file is damaged or not a real DXF. Re-export it. |
| "No rooms were detected" | Check layer names and that each room's walls are closed, or correct rooms manually. |
| Areas look 1000× too big or small | The drawing units are wrong. Fix them in AutoCAD and re-export. |
| "No rates loaded for …" | Import rates for that city (or a nearby one) on the Rates page. |
| BOQ disappeared | You saved corrections or uploaded a new drawing. Calculate it again. |
| Verification or reset email never arrives | In development the email is printed in the server console. In production configure SMTP or Resend (see below). |
| Client link says "not found" | The share link expired or was revoked. Create a new one. |

---

## Part B – Developer guide

### Tech stack

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Web app:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/base-ui components, React Three Fiber
- **Database:** PostgreSQL via Prisma 6
- **Files:** Vercel Blob (private customer plot plans, public company logos)
- **PDF:** `@react-pdf/renderer`
- **Email:** Nodemailer (SMTP) or Resend
- **Tests:** Vitest (unit and component), Playwright (end-to-end, configured; see [Commands](#commands))

### Layout

```
apps/
  web/                    Next.js app (pages, API routes, components, scripts)
packages/
  shared-types/           Shared types, city list, org rules (tax, labour, materials)
  lead-intake/            Intake form options and validation (browser and API)
  cad-parser/             DXF -> geometry (walls, rooms, openings) + sample drawings
  boq-engine/             Geometry + rate card + rules -> BOQ line items, tax, total
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

# Create a demo company and its Owner login
pnpm --filter @vectroq/web seed-orgs
pnpm --filter @vectroq/web create-owner -- --org demo --email you@example.com --name "Your Name" --password "min-8-chars"

# Load the shared default rate library (sample data)
pnpm --filter @vectroq/web exec tsx scripts/import-rates.ts data/pakistan-2026.csv \
  --document "Vectroq default rates" --year 2026 --by "Vectroq" --shared

pnpm --filter @vectroq/web dev      # http://localhost:3000
```

`seed-orgs` creates two sample companies (`demo` and `acme-builders`). You can also just sign up at `/signup`.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `packages/db/.env` | `DATABASE_URL` | Postgres connection string |
| `packages/db/.env` | `DIRECT_URL` | Direct (non-pooled) connection used by migrations |
| `apps/web/.env` | `DATABASE_URL` | Same connection string |
| `apps/web/.env` | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (company logos) |
| `apps/web/.env` | `PLANS_READ_WRITE_TOKEN` | Vercel Blob token for the private store holding customer plot plans |
| `apps/web/.env` | `DEFAULT_ORG_SLUG` | Company shown at `/request` (default `demo`) |
| `apps/web/.env` | `APP_URL` | Public base URL used in emailed links (default `http://localhost:3000`) |
| `apps/web/.env` | `SMTP_USER`, `SMTP_PASS` | SMTP login (e.g. a Gmail app password). Optional `SMTP_HOST` (default `smtp.gmail.com`) and `SMTP_PORT` (default `465`) |
| `apps/web/.env` | `RESEND_API_KEY` | Alternative to SMTP |
| `apps/web/.env` | `EMAIL_FROM` | From address, e.g. `Vectroq <no-reply@yourdomain.com>` |

Email provider order: SMTP, then Resend, then (development only) print to the console. In production with no provider configured, sending throws.

### Commands

```bash
pnpm test                                  # unit tests in every package
pnpm typecheck                             # TypeScript check in every package
pnpm test:e2e                              # Playwright (needs the dev server on :3000)
pnpm --filter @vectroq/web build           # production build
pnpm --filter @vectroq/boq-engine test     # one package

# Web app scripts (run from the repo root)
pnpm --filter @vectroq/web seed-orgs
pnpm --filter @vectroq/web create-owner -- --org <slug> --email <e> --name "<n>" --password <pw>
pnpm --filter @vectroq/web import-rates -- data/pakistan-2026.csv \
  --document "Regional CSR" --year 2026 --by "Office" --org <slug>   # one company's rates
# add --shared instead of --org to load the shared default library
```

`playwright.config.ts` points at `tests/e2e`, but no end-to-end specs are committed yet, so `pnpm test:e2e` has nothing to run.

### Data model

- **Organization** – a company: slug, branding, offices, and its `rules` (JSON, see `OrgRules`).
- **User / Membership / Session** – accounts, role per organization (`OWNER`, `ESTIMATOR`, `VIEWER`), and hashed session records.
- **EmailVerification / PasswordReset / Invitation** – single-use, expiring, hashed tokens.
- **Lead** – an intake form submission, scoped to an organization.
- **Project** – created from a lead; holds `model` (service type), `category`, `city`, `status` (`NEW` → `CAD_UPLOADED` → `FINALIZED`), meeting notes, and the client share token and expiry.
- **CadFile** – one per project; parsed `geometry` (JSON, editable) and the calculated `boq` (JSON, with its rate basis).
- **Render** – optional image record per project (reserved; no generation route exists).
- **RateSet** – rates for a city and category, with status (`DRAFT`, `APPROVED`, `REJECTED`, `SUPERSEDED`) and origin (`csr`, `manual`). `organizationId = null` means the shared default library.

### Multi-tenancy and security

- Every office page and API route resolves the signed-in organization and scopes queries to it. API routes use `guard(<minimum role>)` from `apps/web/src/lib/auth/guard.ts`; pages use `requirePage(<minimum role>)`.
- Passwords are hashed with scrypt. Session cookies hold a random token; only its SHA-256 is stored.
- Email verification, password reset and invitation tokens are hashed, expire and are single-use. Password-reset responses don't reveal whether an account exists.
- Client pages use unguessable, expiring, revocable share tokens (`Project.shareToken`), not project IDs.
- Customer plot plans are stored in a private Blob store and served through `/api/leads/<id>/plan` to signed-in members of the owning organization.

### How a BOQ is produced

```
DXF ──► cad-parser ──► Geometry { walls, rooms, openings }   (editable)
                              │
org + city + category ──► getRateCardWithBasis ──► RateCard
                              │
org.rules ──► resolveOrgRules ──► tax %, labour, materials, notes
                              ▼
                  boq-engine.calculateBoq ──► BOQResult
```

1. **Parsing** (`packages/cad-parser`): layers are matched case-insensitively. Rooms come from closed `LWPOLYLINE`s or, if there are none, from axis-aligned wall `LINE`s split into a grid (`line-plan.ts`). Units come from `$INSUNITS`.
2. **Rates** (`apps/web/src/lib/rate-sets.ts`): `getRateCardWithBasis` looks for the latest `APPROVED` set for the city, preferring the company's own over the shared library, then nearby markets (`searchPlacesFor` in `shared-types`). A set must contain brick, cement, sand and steelMaterial. The company's labour rates are overlaid. If nothing is found it throws `RateUnavailableError` and `/finalize` returns 502 without saving.
3. **Quantities** (`packages/boq-engine`): net wall area deducts openings; bricks scale with wall thickness; cement, sand and steel use the company's material assumptions.
4. **Tax:** from the project's service type via the company's rules, not from the rate card.

### API routes

| Route | Min. role | Purpose |
|---|---|---|
| `POST /api/auth/signup` · `login` · `logout` | public | Create a company and Owner; start / end a session |
| `POST /api/auth/forgot` · `reset` | public | Password reset by email |
| `POST /api/auth/verify-email` · `verify-email/send` | public / Viewer | Confirm / resend email verification |
| `POST /api/auth/change-password` | Viewer | Change own password |
| `POST /api/invites/accept` | public (token) | Accept a team invitation |
| `POST /api/leads` | public | Save a lead (JSON, or multipart with `data` + optional `file`); returns a rough `estimate` |
| `GET /api/leads/:id/plan` | Viewer | Download a lead's private plot plan |
| `GET` · `POST /api/projects` | Viewer / Estimator | List / create projects |
| `GET /api/projects/:id` | Viewer | One project with lead, CAD file and render |
| `POST /api/projects/:id/cad-upload` | Estimator | Upload and parse a `.dxf` |
| `PATCH /api/projects/:id/geometry` | Estimator | Save corrected geometry (clears the saved BOQ) |
| `POST /api/projects/:id/finalize` | Estimator | Price the geometry and mark the project `FINALIZED` |
| `GET /api/projects/:id/boq-pdf` | Viewer | Download the BOQ as PDF |
| `POST` · `DELETE /api/projects/:id/share` | Estimator | Create / revoke the client share link |
| `GET /api/share/:token/boq-pdf` | public (token) | PDF for a valid client link |
| `POST /api/rate-sets` | Estimator | Create a manual draft rate set |
| `POST /api/rate-sets/import` | Estimator | Import a CSR CSV |
| `POST /api/rate-sets/:id/approve` · `reject` | Estimator | Approve (optionally with edited items) or reject a draft |
| `GET` · `PUT /api/org/rules` | Viewer / Owner | Read / update business rules |
| `PATCH /api/org` · `POST /api/org/logo` | Owner | Update branding / upload logo |
| `/api/team/members/:id` · `/api/team/invites` | Owner | Manage members and invitations |

### Known limitations

- **DWG is not supported**; only DXF can be parsed.
- **Single storey**, with fixed (but editable-in-rules) heights and thicknesses.
- **Default rates are sample data**, not a verified market price list.
- **No billing.** The landing page shows example plans, but payments, plan limits and usage metering are not implemented.
- **No rate limiting or bot protection** on the public intake endpoint, and no audit log of BOQ changes.
- **No render generation.** The `Render` model is reserved; the 3D view is built from the drawing.
- **English only**, and the PDF uses a standard Latin font.
- **No committed end-to-end tests** yet, although Playwright is configured.
- `RateSet.taxPercent` still exists in the schema (default 17) but nothing reads it.

### Contributing

1. Branch, make the change.
2. Run `pnpm typecheck` and `pnpm test` at the repo root.
3. Add or update tests next to the code you changed.
4. Open a pull request.