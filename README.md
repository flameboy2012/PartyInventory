# D&D Party Inventory

A web app for a Dungeons & Dragons party to manage its inventory together — a shared
party stash plus per-character inventories, with changes synced live to everyone in the
party. Players join a party with a share code; no accounts required.

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind — `web/` |
| Backend | .NET 10 Minimal API + SignalR (real-time sync) — `api/` |
| Database | PostgreSQL 17 via EF Core (Npgsql) |

## Repository layout

```
.
├── web/                      Next.js frontend
├── api/
│   ├── PartyInventory.slnx    Solution
│   └── PartyInventory.Api/    Minimal API project
├── docker-compose.yml        Local PostgreSQL
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local Postgres container)

## Getting started

### Run the whole stack with Docker (recommended)

```bash
docker compose up --build
```

Brings up Postgres, the API, the web app, and pgAdmin. The API applies its EF
migrations on startup. Then open:

- Web app: http://localhost:3000
- API + Scalar explorer: http://localhost:5140/scalar
- pgAdmin: http://localhost:5050

The browser talks only to the web app; its BFF proxy forwards `/api/*` to the API
over the internal Docker network (`http://api:8080`).

### Hot reload while developing

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml watch
```

Runs the API (`dotnet watch`) and web (`next dev`) in dev mode and syncs source
changes into the containers for hot reload.

### Or run pieces locally

Start just the database, then run each app on the host:

```bash
docker compose up -d db
(cd api/PartyInventory.Api && dotnet run)   # API on http://localhost:5140
(cd web && npm install && npm run dev)       # web on http://localhost:3000
```

When running the web app locally, its BFF reads `API_BASE_URL` (default
`http://localhost:5140`, see `web/.env.example`).

## Status

See [docs/TODO.md](docs/TODO.md) for progress. Core API (parties, characters,
items, stash + moves) and the web UI are in place; real-time sync (SignalR) is
still to come.
