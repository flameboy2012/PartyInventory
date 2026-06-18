# Requirements & Data Model

Living spec for the D&D Party Inventory app. Captures decisions made during planning.

## Product summary

A web app for a D&D party to manage inventory together: a shared **party stash** plus
**per-character** inventories, synced **live** to everyone in the party. Players join a
party with a **share code** — no accounts.

## Key decisions

| Area | Decision |
|------|----------|
| Collaboration | Real-time shared (SignalR pushes changes to all connected party members) |
| Inventory scope | Shared party stash + per-character inventories; items can move between them |
| Identity | Party-code join, no accounts. **Anyone with the code can edit anything** for now. (Real identity is a stretch goal — see below.) |
| Currency | Full D&D coins: cp / sp / ep / gp / pp — held by the party stash **and** each character |
| Permissions | **Open** — any party member can add/move/delete items anywhere (stash and any character). Restricted per-character permissions are a stretch goal. |
| Stack | Next.js + TS frontend · .NET 10 minimal API + SignalR · PostgreSQL via EF Core |

## Proposed data model

### Party
- `Id` (Guid)
- `Name`
- `JoinCode` (short, unique)
- `CreatedAt`
- `Coins` (owned coin purse — see below) — the shared stash's money

### Character
- `Id` (Guid)
- `PartyId`
- `Name`
- `Class` (nullable), `Level` (nullable)
- `Coins` (owned coin purse) — this character's money

### Item
- `Id` (Guid)
- `PartyId` (scoping)
- `CharacterId` (nullable — **null = party stash**, otherwise the owning character)
- `Name`
- `Description` (nullable)
- `Quantity` (int)
- `Value` (decimal — cost in **gold pieces (gp)**)
- `Weight` (lbs)
- `Type` (enum: Weapon, Armor, Potion, Scroll, Gear, Treasure, Other)
- `Rarity` (enum: Common, Uncommon, Rare, VeryRare, Legendary, Artifact)
- `Equipped` (bool — meaningful only when on a character)

### CoinPurse (owned value object)
- `Copper`, `Silver`, `Electrum`, `Gold`, `Platinum` (ints) — discrete coins held by a party/character.

## Party stash & item location

The **party stash** is not a separate entity — it is the party's shared **container**: the
party's own `CoinPurse` plus all items with `CharacterId == null`. The stash and each
character share the same shape (coins + items); the stash is simply the default home for
items nobody is holding.

**Item location is expressed by `Item.CharacterId`** (null = stash). The item API is flat
under the party:

- `GET/POST   /api/parties/{partyId}/items` — list / create (create body may set `characterId`; null = stash)
- `GET/PUT/DELETE /api/parties/{partyId}/items/{itemId}` — get / update / delete
- **Moving** an item between inventories = changing `characterId` (via `PUT`).
- `GET /api/parties/{partyId}/stash` — convenience read view returning `{ coins, items[] }` for the stash.

A `characterId` supplied on create/move must reference a character in the **same party**.

## Money display

Monetary **values** (e.g. item cost) are stored as a decimal of **gp**. A display helper
converts a gp amount into a cp/sp/ep/gp/pp breakdown for the UI (1 pp = 10 gp, 1 gp = 2 ep
= 10 sp = 100 cp). Coins *held* (CoinPurse) are already discrete denominations.

## Stretch goals

- **Identity** — players sign in / claim a character (browser-stored token or accounts).
  This unlocks **restricted per-character permissions** ("own + stash only" — a player edits
  their claimed character and the shared stash, but not other characters). Until then,
  editing is fully open to anyone with the party code.
- **DM / admin role** — elevated permissions (edit anyone, manage the party).
- Optional carry-weight total per character (weight is captured; encumbrance rules out of scope for now).
