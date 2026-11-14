# Vectroq

> "Vectroq" is the product name. Each company that signs up also gets its own branding (name, tagline, logo, colour, contact details), edited on the **Settings** page and stored per organization. The platform's own branding lives in `apps/web/src/lib/brand.ts`.

**From floor plan to final quote.** Vectroq is a multi-tenant SaaS for construction companies and contractors (built for the Pakistan market). Upload a DXF house plan and get a priced Bill of Quantities (BOQ), an interactive 3D view, a branded PDF and a shareable client page.

1. **A customer** fills in a 3-step intake form on the company's public page (or an embed on the company's own website) and gets a rough price range.
2. **The team** signs in, turns the enquiry into a project, uploads an AutoCAD `.dxf` drawing, checks what the system read from it, and calculates a BOQ priced from the company's own rates and rules.
3. **The team** downloads the BOQ as a PDF and sends the client a time-limited link to a page with the 3D model and cost summary.

Visitors can also try the whole flow without signing up through the **live demo** (`/demo`).

This README has two parts:

- [Part A – Using the app](#part-a--using-the-app)
- [Part B – Developer guide](#part-b--developer-guide)

---

## Part A – Using the app

### Try the demo

Open `/demo` and press **Start the demo**. You get a private demo company with a sample plan and (if default rates are loaded) a priced BOQ. No sign-up is needed.

- A demo company is deleted after **24 hours**.
- Demos cannot invite teammates or upgrade the plan.
- At most 200 demo companies exist at a time, and one IP can start 10 per hour.
- Create a real company at `/signup` to keep your work.

### Companies, roles and sign-in

Every company is an **organization**. All leads, projects, drawings, rates and settings belong to one organization and are only visible to its members.

| Role | Can do |
|---|---|
| **Owner** | Everything: team and invitations, branding, business rules, billing, audit log, plus all Estimator actions |
| **Estimator** | Create projects, upload and correct drawings, calculate BOQs, manage rates, create client share links, load the sample project |
| **Viewer** | Read-only access to projects, BOQs and rates |

- **Sign up** at `/signup` to create a company (you become its Owner). Email verification and password reset are built in.
- **Confirm your email** using the banner in the office. Owners must confirm their email before they can invite teammates.
- **Invite teammates** from **Team** (Owner only). The invite link is valid for 7 days; the last Owner cannot be removed or demoted.
- **Sign in** at `/login`. "Remember me" keeps the session for 30 days instead of 1 day.
- **Change password** on **Account**. Every other device is signed out and a notice email is sent.

### Pages

| Page | Address | Used by | Purpose |
|---|---|---|---|
| Landing page | `/` | Visitors | Product overview, sample BOQ, pricing, demo, sign-up and login |
| Live demo | `/demo` | Visitors | Start a private 24-hour demo company |
| Sign up / Log in | `/signup` · `/login` | Everyone | Create a company / sign in |
| Password reset | `/forgot-password` · `/reset-password/<token>` | Everyone | Reset a password by email |
| Email confirmation | `/verify-email/<token>` | Everyone | Confirm an email address |
| Invitation | `/invite/<token>` | Invitee | Join a company |
| Company intake form | `/c/<company slug>` | Customers | Submit a project request to that company |
| Embeddable form | `/embed/<company slug>` | Customers | The same form for an `<iframe>` on the company's own site |
| Dashboard | `/office/dashboard` | Team | Pipeline summary, onboarding checklist, pending leads, approved rate sets |
| Projects | `/office` | Team | All projects, with search and filters |
| Search | `/office/search?q=` | Team | Search projects, leads and rates by client, phone or city |
| Leads | `/office/leads` | Team | Enquiries that don't have a project yet |
| Project workspace | `/office/<project id>` | Team | Upload drawing, review, BOQ, 3D model, share link |
| Printable BOQ | `/office/<project id>/boq` | Team | Print or download the BOQ as PDF |
| Rates | `/office/rates` | Estimator+ | Import, review and approve rate schedules |
| Business rules | `/office/rules` | Owner | Tax, labour, construction and material assumptions |
| Settings | `/office/settings` | Owner | Company branding and the embed snippet |
| Team | `/office/team` | Owner | Members, roles and invitations |
| Billing | `/office/billing` | Owner | Plan, usage meters, upgrade and the Stripe billing portal |
| Audit log | `/office/audit` | Owner | Who changed drawings, BOQs, rates and rules (latest 200 entries) |
| Account | `/office/account` | Everyone | Change password, verify email |
| Platform admin | `/office/admin` | Platform admins | Companies per plan, usage and limits. Returns 404 for everyone else |
| Client page | `/client/<share token>` | Customer | 3D model, cost summary, PDF download (no sign-in) |

`/request` simply redirects to the default company's intake form (`DEFAULT_ORG_SLUG`).

### Getting set up (onboarding)

The dashboard shows a six-step checklist until it is complete: set branding, add your own rates (optional), receive a first request, create a project, upload a drawing, calculate a first BOQ. Estimators and Owners also get a **Load sample project** button that creates a sample client, project and drawing and prices it, so you can see a finished BOQ immediately.

### 1. A customer submits the form (`/c/<slug>`)

1. **Project details** – name, phone/WhatsApp, city, and service type.
2. **Requirements** – house type, floors, bedrooms, budget, plot size, covered area, timeline and material category. An optional plot plan (PDF, DWG, DXF, JPG or PNG, up to 10 MB) and notes can be added.
3. **Contact confirmation** – tick the consent box and submit.

After submitting, the customer sees a **rough range** (±10%) if approved rates exist for their city (or a nearby market). Otherwise they are told someone will follow up. Either way the lead is saved. Plot plans are stored privately and only signed-in members of that company can open them. File contents are checked against the file extension, so a renamed `.exe` is rejected.

The form is protected against bots (hidden honeypot field, a minimum fill time of 4 seconds, an optional Cloudflare Turnstile challenge) and rate limited (see [Security](#multi-tenancy-and-security)).

To put the form on the company's own website, copy the embed snippet from **Settings**. The embed resizes itself to fit its content.

### 2. Turn a lead into a project (`/office/leads`)

Check the **City**, **Service type** and **Category**, add optional **Meeting notes**, then click **Create project**. On the Starter plan this is limited to 3 projects per calendar month (see [Plans and billing](#plans-and-billing)).

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

In the project workspace, choose a `.dxf` file (ASCII DXF, up to 10 MB). The system lists the rooms, walls, doors and windows it found. **Only `.dxf` is supported.** For a `.dwg`, use *Save As → AutoCAD DXF* first.

Sample drawings:

| File | Contents |
|---|---|
| `packages/cad-parser/fixtures/whole_house_simple_plan.dxf` | A 12 m × 10 m house: 7 rooms, 7 doors, 8 windows, in millimetres. Two halves of the house are not joined by a door |
| `packages/cad-parser/fixtures/whole_house_connected.dxf` | The same house with the connecting door drawn |
| `packages/cad-parser/fixtures/sample-house.dxf` | 3 rooms, 1 door, 1 window, in feet (closed polylines) |
| `apps/web/public/samples/sample-house-plan.dxf` | The plan used by the demo and the "Load sample project" button |

**How drawings should be prepared**

- **Layers:** walls on `WALLS`, doors on `DOORS`, windows on `WINDOWS` (case-insensitive; singular also works).
- **Walls:** draw each room as one closed polyline on `WALLS`, or draw straight horizontal/vertical lines that fully close each room.
- **Doors and windows:** a line on its layer; the line length is the opening width. A door drawn as a leaf line plus a quarter-circle `ARC` on the door layer is read as a swinging door, so the 3D view shows which way it opens.
- **Room names:** `TEXT` or `MTEXT` inside each room, on any layer other than the three above (layers starting with `DIM` are ignored). Names containing *bath*, *washroom*, *toilet* or *WC* become bathrooms; *kitchen* becomes a kitchen.
- **Units:** set in AutoCAD (inch, ft, mm, cm, m). If missing, a drawing wider than 500 units is assumed to be millimetres.
- **Single storey only.**

Defaults used because a plan view can't provide them (editable per company under **Business rules → Drawing assumptions**): wall height 10 ft, door height 7 ft, window height 4 ft, outer walls 9 in, inner partitions 4.5 in. They apply to drawings uploaded after the change.

### 4. Check and correct

Edit room names, types and areas and wall lengths and heights, delete rows, or drag to re-order. Click **Save corrections**. Saving **clears any BOQ already calculated**. Make sure bathrooms are typed *Bathroom*, because that sets the sanitary count. If you press **Calculate BOQ** with unsaved edits, they are saved first.

### 5. Calculate the BOQ

Click **Calculate BOQ**. Rates come from the latest **approved** rate set for the project's city and category: first the company's own, then the shared default library. If the city has none, the nearest market with rates is used and the BOQ says so. If no rates exist at all, the calculation fails and nothing is saved; import rates on the Rates page first.

The BOQ is grouped into Structure, Masonry & Plaster, Finishes, Services & Fixtures and Materials, with subtotal, sales tax and total. The project status becomes `FINALIZED`. A **"Basis of estimate"** section records the rate source, tax, assumptions and exclusions, and is saved with the BOQ so later rule or rate changes don't alter an issued quote.

- Door and window openings are deducted from wall and plaster quantities.
- Kitchens and bathrooms are always tiled. False ceiling only in dry rooms.
- Steel defaults to 4 kg per sq ft of covered area.
- *Not included by default (editable):* boundary wall and gate, water tank, boring and pump, utility connections, kitchen cabinets and appliances, light fixtures, furniture, consultant and approval fees.
- Foundation and electrical only appear if a rate set includes them.

### 6. 3D model, PDF and client page

The workspace shows an interactive 3D model built from the (corrected) drawing. It is illustrative and is not used to calculate quantities. Controls include:

- **Views:** 3D, 2D plan, and a first-person **Walk** mode (drag to look, W A S D or arrow keys, or the on-screen pad on touch screens). Walls and furniture block you; doorways are the only way through.
- **Look:** roof off / on / lifted, day or night, labels, soft shadows, a cut-height slider that slices the house open, open doors, surroundings (driveway and trees), field of view in walk mode, fullscreen and PNG download.
- **Interior:** furniture is placed automatically from room names and types, and optional false ceilings follow the category (plain, dropped border, or stepped with cove light). **Link rooms** adds archways where the drawing leaves rooms cut off from each other.

Only flooring and false ceilings are priced in the BOQ. Furniture, finishes, trees, driveway, lighting and linking archways are illustrative.

- **Download PDF** produces a BOQ with the company's letterhead, grouped items, totals, assumptions, exclusions and signature block. On the Starter plan the footer also reads "Prepared with Vectroq".
- **Share** creates a client link valid for **7, 30 or 90 days**. It can be revoked, and the page is marked `noindex`. The link opens `/client/<token>` and includes the PDF download. Anyone with the link can see the BOQ and the client's contact details until it expires.

### Rates page (`/office/rates`)

- **Shared default library:** every company can price BOQs out of the box from a shared set of default rates. A company **overrides** a city and category by importing its own rates or adding them manually.
- **Import a rate schedule (CSR):** upload a CSV with the columns `city,itemType,unit,unitRate`. Every city needs `brick`, `cement`, `sand` and `steelMaterial`. The whole file is validated first; if anything is wrong, nothing is saved. A template can be downloaded from the page. City names are matched against the built-in list of Pakistani cities (aliases such as "Benazirabad" are accepted).
- **Drafts:** manual rate sets wait for review. Edit the rates if needed, enter your name under *Approved by*, then approve or reject.
- **Labour rates** (masonry, plaster, shuttering, steel fixing, sanitary, tile and marble fixing, woodwork) are set per company on **Business rules**.

`apps/web/data/pakistan-2026.csv` is **sample data** for trying the import. It is not a verified market price list. Companies should load their own rates before issuing real quotes.

### Plans and billing

| Plan | Price | Projects per month | Team members | PDF footer |
|---|---|---|---|---|
| Starter (`FREE`) | Free | 3 | 1 | "Prepared with Vectroq" |
| Pro | Rs 4,999 / month | Unlimited | 5 | Company branding only |
| Business | Rs 14,999 / month | Unlimited | Unlimited | Company branding only |

- Owners upgrade on **Billing**, which opens Stripe Checkout. Plan changes, downgrades and cancellation happen in the Stripe billing portal. A cancelled plan stays active until the period ends.
- Pending invitations count as seats.
- Hitting a limit returns HTTP 402 with a message asking the owner to upgrade.
- Upgrades are disabled in demo companies and when Stripe is not configured on the server.
- The Billing page shows usage meters for projects (this month, UTC) and seats.

### Common problems

| What you see | What to do |
|---|---|
| ".dwg files aren't supported yet" | Export the drawing as `.dxf` and upload that. |
| "Could not parse this DXF file" | The file is damaged, binary, or not a real DXF. Re-export it as ASCII DXF. |
| "No rooms were detected" | Check layer names and that each room's walls are closed, or correct rooms manually. |
| Areas look 1000× too big or small | The drawing units are wrong. Fix them in AutoCAD and re-export. |
| "No rates loaded for …" | Import rates for that city (or a nearby one) on the Rates page, or load the shared default library. |
| BOQ disappeared | You saved corrections or uploaded a new drawing. Calculate it again. |
| "The Starter plan allows 3 projects per month" | Upgrade on the Billing page, or wait for the next month. |
| "Too many attempts. Try again in N minutes." | You hit a rate limit (login, sign-up, reset email or intake form). Wait and retry. |
| Intake form says "We couldn't verify your submission" | The bot check failed. Reload the page and submit again after a few seconds. |
| Verification or reset email never arrives | In development the email is printed in the server console. In production configure SMTP or Resend (see below). |
| Client link says "no longer available" | The share link expired or was revoked. Create a new one. |

---

## Part B – Developer guide

### Tech stack

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Web app:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/base-ui components, React Three Fiber
- **Database:** PostgreSQL via Prisma 6
- **Files:** Vercel Blob (private customer plot plans, public company logos)
- **PDF:** `@react-pdf/renderer`
- **Email:** Nodemailer (SMTP) or Resend
- **Billing:** Stripe subscriptions (Checkout, billing portal, webhook)
- **Bot protection:** honeypot, timing check, optional Cloudflare Turnstile, Postgres-backed rate limiter
- **Scheduled jobs:** Vercel Cron
- **Tests:** Vitest (unit and component), Playwright (end-to-end)

### Layout

```
apps/
  web/                    Next.js app (pages, API routes, components, scripts, vercel.json)
packages/
  shared-types/           Shared types, city list, org rules (tax, labour, materials)
  lead-intake/            Intake form options and validation (browser and API)
  cad-parser/             DXF -> geometry (walls, rooms, openings) + sample drawings
  boq-engine/             Geometry + rate card + rules -> BOQ line items, tax, total
  rate-cards/             Rate card helpers, CSV parsing, estimate functions
  db/                     Prisma schema, migrations, client
tests/
  e2e/                    Playwright specs (see tests/e2e/README.md)
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

`seed-orgs` creates two sample companies (`demo` and `acme-builders`). You can also just sign up at `/signup`. Load the default rate library before trying the demo, otherwise the demo's sample project is created but not priced.

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| `packages/db/.env` | `DATABASE_URL` | Postgres connection string |
| `packages/db/.env` | `DIRECT_URL` | Direct (non-pooled) connection used by migrations |
| `apps/web/.env` | `DATABASE_URL` | Same connection string |
| `apps/web/.env` | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (company logos) |
| `apps/web/.env` | `PLANS_READ_WRITE_TOKEN` | Vercel Blob token for the **private** store holding customer plot plans |
| `apps/web/.env` | `DEFAULT_ORG_SLUG` | Company shown at `/request` (default `demo`) |
| `apps/web/.env` | `APP_URL` | Public base URL used in emailed links (default: the request origin) |
| `apps/web/.env` | `SMTP_USER`, `SMTP_PASS` | SMTP login (e.g. a Gmail app password). Optional `SMTP_HOST` (default `smtp.gmail.com`) and `SMTP_PORT` (default `465`) |
| `apps/web/.env` | `RESEND_API_KEY` | Alternative to SMTP |
| `apps/web/.env` | `EMAIL_FROM` | From address, e.g. `Vectroq <no-reply@yourdomain.com>` |
| `apps/web/.env` | `STRIPE_SECRET_KEY` | Enables billing. Without it, upgrades are disabled |
| `apps/web/.env` | `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` |
| `apps/web/.env` | `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Stripe price IDs of the two paid plans |
| `apps/web/.env` | `PLATFORM_ADMIN_EMAILS` | Comma-separated emails allowed to open `/office/admin` |
| `apps/web/.env` | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile on the intake form (see note below) |
| `apps/web/.env` | `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/cleanup`. The route returns 401 without it |
| `apps/web/.env` | `LEAD_IP_LIMIT` | Intake submissions allowed per IP per 10 minutes (default `8`) |

Email provider order: SMTP, then Resend, then (development only) print to the console. In production with no provider configured, sending throws.

**Turnstile:** with no `TURNSTILE_SECRET_KEY`, the check is skipped in development but **rejects every submission in production**, so set both keys before going live.

### Production checklist

1. Run `prisma migrate deploy` against the production database.
2. Set `APP_URL`, an email provider, `BLOB_READ_WRITE_TOKEN`, and `PLANS_READ_WRITE_TOKEN` (a private Blob store).
3. Set both Turnstile keys.
4. Set `CRON_SECRET` and keep `apps/web/vercel.json`, which schedules `/api/cron/cleanup` daily at 03:00 UTC.
5. Create the two Stripe prices, set the `STRIPE_*` variables, and point a Stripe webhook at `/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`.
6. Set `PLATFORM_ADMIN_EMAILS`.
7. Load the shared default rate library (or your own verified rates).

### Commands

```bash
pnpm test                                  # unit tests in every package
pnpm typecheck                             # TypeScript check in every package
pnpm e2e:db:up && pnpm test:e2e            # Playwright (starts its own server; needs Docker, see tests/e2e/README.md)
pnpm --filter @vectroq/web build           # production build
pnpm --filter @vectroq/boq-engine test     # one package

# Web app scripts (run from the repo root)
pnpm --filter @vectroq/web seed-orgs
pnpm --filter @vectroq/web create-owner -- --org <slug> --email <e> --name "<n>" --password <pw>
pnpm --filter @vectroq/web import-rates -- data/pakistan-2026.csv \
  --document "Regional CSR" --year 2026 --by "Office" --org <slug>   # one company's rates
# add --shared instead of --org to load the shared default library
```

**End-to-end tests** live in `tests/e2e` (public pages, auth, security, demo flow, office smoke test, the full intake-to-project flow, the public intake form, and the CAD upload / unit / geometry / BOQ regression specs). They run against a throwaway Postgres database that the harness resets and seeds itself. See `tests/e2e/README.md` for setup, and the **Continuous integration** section there for what GitHub Actions runs.

### Data model

- **Organization** – a company: slug, branding, offices, its `rules` (JSON, see `OrgRules`), billing fields (`plan`, `planStatus`, `planRenewsAt`, `planCancelsAt`, Stripe customer and subscription ids) and demo fields (`isDemo`, `demoExpiresAt`).
- **User / Membership / Session** – accounts, role per organization (`OWNER`, `ESTIMATOR`, `VIEWER`), and hashed session records.
- **EmailVerification / PasswordReset / Invitation** – single-use, expiring, hashed tokens.
- **Lead** – an intake form submission, scoped to an organization. `source` is `FORM`, or `SAMPLE` for the generated sample client.
- **Project** – created from a lead; holds `model` (service type), `category`, `city`, `status` (`NEW` → `CAD_UPLOADED` → `FINALIZED`), meeting notes, and the client share token and expiry.
- **CadFile** – one per project; parsed `geometry` (JSON, editable) and the calculated `boq` (JSON, with its rate basis).
- **Render** – optional image record per project (reserved; no generation route exists).
- **RateSet** – rates for a city and category, with status (`DRAFT`, `APPROVED`, `REJECTED`, `SUPERSEDED`) and origin (`csr`, `manual`). `organizationId = null` means the shared default library.
- **AuditLog** – who did what, per organization (action, entity, metadata). Kept for 12 months.
- **RateLimit** – fixed-window counters used by the rate limiter.

### Multi-tenancy and security

- Every office page and API route resolves the signed-in organization and scopes queries to it. API routes use `guard(<minimum role>)` from `apps/web/src/lib/auth/guard.ts`; pages use `requirePage(<minimum role>)`. `src/proxy.ts` additionally redirects signed-out visitors (pages) or answers 401 (APIs) for the protected paths.
- Tests enforce this: `route-guards.test.ts` fails if an API route has no guard and is not on the documented public list, if a guarded route touches tenant tables without `organizationId`, or if a write route allows less than Estimator. `tenant-isolation.test.ts` checks that one company cannot read or change another's project.
- Passwords are hashed with scrypt (legacy hashes still verify). Session cookies hold a random token; only its SHA-256 is stored.
- Email verification, password reset and invitation tokens are hashed, expire and are single-use. Password-reset responses don't reveal whether an account exists.
- Client pages use unguessable, expiring, revocable share tokens (`Project.shareToken`), not project IDs.
- Customer plot plans are stored in a private Blob store and served through `/api/leads/<id>/plan` to signed-in members of the owning organization. Uploads are checked against the file's real contents, not just its extension.
- **Rate limits** (per IP unless noted): intake 8 per 10 minutes plus 500 per company per day; login 30 per 15 minutes plus 8 per IP and email; sign-up 5 per hour; password-reset email 5 per hour; demo start 10 per hour. Counters live in Postgres; if the database is unreachable the limiter falls back to per-instance memory and fails open. The client IP comes from `x-forwarded-for`, which is only trustworthy behind Vercel or a proxy that sets it.
- **Security headers** (`next.config.ts`): `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and `frame-ancestors 'self'` everywhere except `/embed/*`, which may be framed by any site.
- **Audit log** records: CAD uploaded, geometry edited, BOQ calculated (with the previous total), share created or revoked, rules updated, rates imported, rate set approved, member role changed or removed, login, lead created. Writing a log entry never breaks the action being logged.

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

1. **Parsing** (`packages/cad-parser`): layers are matched case-insensitively. Rooms come from closed `LWPOLYLINE`s or, if there are none, from axis-aligned wall `LINE`s split into a grid (`line-plan.ts`). Openings are snapped onto the nearest wall (`place-openings.ts`), and door `ARC`s give the hinge and swing direction (`door-swing.ts`). Units come from `$INSUNITS`.
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
| `POST /api/demo/start` | public (rate limited) | Create a 24-hour demo company and sign in |
| `POST /api/onboarding/sample-project` | Estimator | Create a sample client, project and priced BOQ |
| `POST /api/leads` | public (rate limited, bot checked) | Save a lead (JSON, or multipart with `data` + optional `file`); returns a rough `estimate` |
| `GET /api/leads/:id/plan` | Viewer | Download a lead's private plot plan |
| `GET` · `POST /api/projects` | Viewer / Estimator | List / create projects (plan limit applies) |
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
| `GET` · `PATCH /api/org/rules` | Viewer / Owner | Read / update (or reset) business rules |
| `PATCH /api/org` · `POST /api/org/logo` | Owner | Update branding / upload logo |
| `PATCH` · `DELETE /api/team/members/:id` | Owner | Change role / remove a member |
| `POST /api/team/invites` · `DELETE /api/team/invites/:id` | Owner | Create (plan seat limit applies) / revoke an invitation |
| `POST /api/billing/checkout` · `portal` | Owner | Start Stripe Checkout / open the billing portal |
| `POST /api/stripe/webhook` | public (Stripe signature) | Sync the plan from Stripe subscription events |
| `GET /api/cron/cleanup` | `CRON_SECRET` | Delete old audit logs, expired sessions, rate-limit rows and expired demos |

### Known limitations

- **DWG is not supported**; only ASCII DXF can be parsed.
- **Single storey**, with fixed (but editable-in-rules) heights and thicknesses.
- **Default rates are sample data**, not a verified market price list.
- **Plan enforcement is partial.** Only the monthly project limit, the seat limit and the PDF footer are enforced. Other plan bullets on the landing page (custom rate schedules, custom tax and labour rules, priority support) are marketing copy and are not gated by plan.
- **No invoicing or tax receipts** beyond what Stripe provides.
- **No render generation.** The `Render` model is reserved; the 3D view is built from the drawing.
- **English only**, and the PDF uses a standard Latin font.
- `RateSet.taxPercent` still exists in the schema (default 17) but nothing reads it.
- Demo companies live in the same database as real ones until the daily cleanup removes them.

### Contributing

1. Branch, make the change.
2. Run `pnpm typecheck` and `pnpm test` at the repo root.
3. Add or update tests next to the code you changed. New API routes must call `guard()` (or be added, with a reason, to the public list in `route-guards.test.ts`) and scope tenant data by `organizationId`.
4. Open a pull request.