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

- [ ] **CORS** — allow the frontend origin (`http://localhost:3000`) to call the API *(blocks frontend integration)*
- [ ] **SignalR** — per-party hub group; broadcast item & character changes for live sync
- [ ] **Coin management** — endpoints to adjust stash and character purses
- [ ] (stretch) Identity / claim-a-character → restricted per-character permissions
- [ ] (stretch) DM / admin role

## Frontend

### Setup
- [ ] Decide stack bits — data fetching, type generation, UI components *(see Decisions)*
- [ ] API client + base URL config (`NEXT_PUBLIC_API_BASE_URL`)
- [ ] Shared money helper (gp decimal → cp/sp/ep/gp/pp display)

### Pages / flows
- [ ] **Landing** — list parties (discovery), create a party, join by code
- [ ] **Party view** — overview of the stash + characters, with coins
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

## Decisions to make (frontend)

- [ ] Server-state / data fetching approach
- [ ] API types — generate from OpenAPI vs hand-write
- [ ] UI components — plain Tailwind vs a component library
