# TODO

Working task list for the D&D Party Inventory app. See [REQUIREMENTS.md](REQUIREMENTS.md)
for the product spec and data model.

## Done

- [x] Monorepo scaffolding (Next.js `web/`, .NET 10 minimal API `api/`, Postgres via Docker)
- [x] Domain model + EF Core migration (Party, Character, Item, CoinPurse)
- [x] Party endpoints: list / create / join / get
- [x] Character endpoints: list / create / get / update / delete
- [x] Item endpoints: list / create / get / update+move / delete + stash view
- [x] Integration tests (xUnit + Testcontainers) — 34 passing
- [x] Scalar API explorer at `/scalar` (dev)

## Backend — remaining

- [x] **CORS** — added for direct browser calls, then **removed** once the BFF made it unnecessary
- [ ] **SignalR** — per-party hub group; broadcast item & character changes for live sync
- [ ] **Coin management** — endpoints to adjust stash and character purses
- [ ] (stretch) Identity / claim-a-character → restricted per-character permissions
- [ ] (stretch) DM / admin role
- [x] Remember joined parties in browser storage — landing page lists only your created/joined parties (promoted from stretch: a global directory would leak ids and defeat the join code)

## Frontend

### Setup
- [x] OpenAPI snapshot test + committed `openapi/v1.json` (build types against a repo artifact)
- [x] Generate TS types from `openapi/v1.json` (openapi-typescript, `npm run gen:api`)
- [x] SWR setup (fetcher + provider)
- [x] shadcn/ui init
- [x] API client + base URL config (`NEXT_PUBLIC_API_BASE_URL`)
- [ ] Shared money helper (gp decimal → cp/sp/ep/gp/pp display)

### Pages / flows
- [x] **Landing** — your remembered parties (localStorage) + create / join-by-code dialogs
- [x] **Party view** — header (name, share code, characters, party gold) + items table; add character / add item / delete item
- [ ] **Stash** — list/add/edit/move/delete items in the shared stash
- [x] **Character inventory** — per-character items via tab strip on the party page (coins editing still TODO)
- [x] **Item editor** — add + edit dialogs (name, qty, value, weight, type, rarity, equipped); location changes via Move
- [x] Tidy up the items table actions — Edit/Move/Delete consolidated into a row kebab dropdown menu
- [x] **Move item** — Move button opens a destination picker; drag-drop onto tabs is a later enhancement
- [ ] Loading / error / empty states throughout

### Real-time
- [ ] SignalR client — join the party group, apply live updates (after backend SignalR lands)

## Architecture & infrastructure

### Frontend as a BFF (backend-for-frontend)
- [x] Route browser → API calls through the Next.js server instead of calling the .NET API directly from the browser
  - [x] Generic proxy route handler `app/api/[...path]/route.ts` (one export per verb) forwards to the .NET API
  - [x] Validates the slug against the known API surface (generated `routes.ts` from the OpenAPI spec) before forwarding
  - [x] Browser calls same-origin endpoints; `API_BASE_URL` is now server-only (read in the proxy), client uses a relative base URL
  - [x] Server-side seam in place for future auth/session handling
  - [x] Removed CORS from the API — the browser never calls it directly anymore

### Full-stack Docker
- [ ] Dockerfile for the API (.NET 10 multi-stage: SDK build → runtime image)
- [ ] Dockerfile for the web app (Next.js standalone output, multi-stage)
- [ ] Extend `docker-compose.yml` to run **api + web** alongside `db` (and `pgadmin`)
  - [ ] Wire env: web `API_BASE_URL` → `http://api:<port>`; api connection string → the `db` service
  - [ ] Apply EF migrations on API startup (or a dedicated migration step)
- [ ] `docker compose watch` (`develop.watch`) for hot reload — sync source into the containers, rebuild on dependency changes
- [ ] Goal: whole stack up with a single `docker compose up` / `docker compose watch`

## Cross-cutting / later

- [ ] Frontend/e2e tests
- [ ] Deployment & hosting config

## Decisions (frontend)

- [x] Server-state / data fetching — **SWR**
- [x] API types — **generate from OpenAPI**, pinned via a committed snapshot (`openapi/v1.json`)
- [x] UI components — **shadcn/ui**
