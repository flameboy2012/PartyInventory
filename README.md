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

### 1. Start the database

```bash
docker compose up -d
```

This runs PostgreSQL on `localhost:5432` (db `party_inventory`, user `party`,
password `party_dev_pw` — dev only). The dev connection string is set in
`api/PartyInventory.Api/appsettings.Development.json`.

### 2. Run the API

```bash
cd api/PartyInventory.Api
dotnet run
```

### 3. Run the frontend

```bash
cd web
npm install
npm run dev
```

The frontend runs on http://localhost:3000.

## Status

Project scaffolding is in place. The domain model (parties, characters, items,
inventories) and the real-time endpoints are still to be designed.
