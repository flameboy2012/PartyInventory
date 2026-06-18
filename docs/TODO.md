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

- [x] **CORS** — allow the frontend origin (`http://localhost:3000`) to call the API
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
- [ ] **Character inventory** — per-character items + coins
- [ ] **Item editor** — add/edit form (name, qty, value, weight, type, rarity, equipped, location)
- [ ] **Move item** — between stash and characters (drag-drop or a picker)
- [ ] Loading / error / empty states throughout

### Real-time
- [ ] SignalR client — join the party group, apply live updates (after backend SignalR lands)

## Cross-cutting / later

- [ ] Frontend/e2e tests
- [ ] Deployment & hosting config

## Decisions (frontend)

- [x] Server-state / data fetching — **SWR**
- [x] API types — **generate from OpenAPI**, pinned via a committed snapshot (`openapi/v1.json`)
- [x] UI components — **shadcn/ui**
