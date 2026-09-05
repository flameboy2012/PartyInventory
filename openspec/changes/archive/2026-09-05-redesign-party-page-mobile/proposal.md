## Why

The party page was laid out for a desktop browser, but it is used on a phone at a table. Its holder switcher is a `TabsList` holding the stash plus one trigger per character, so it overflows the moment a party has four or five characters — exactly the size a real party reaches. Below it, an item table with a `⋯` overflow menu, a coin bar and the full audit feed are stacked into one long column that a player has to scroll past to reach anything.

A design handoff (`Party inventory mobile redesign.zip`) proposes a mobile-first rework. Part of that handoff depends on item fields the API does not have. This change delivers the part that needs no API work, so the page stops overflowing now rather than after a schema migration.

## What Changes

- Replace the overflowing holder `TabsList` with a single picker button that opens a bottom sheet on phone and a popover on desktop. It cannot overflow, however many characters a party has.
- Split the page into two top-level tabs, **Inventory** and **History**, reflected in the URL as `?tab=`. History is the existing audit feed, which today always renders below the items.
- Replace the item table with one flat list of tappable rows. Tapping a row expands it to show details and per-item actions, removing the `⋯` dropdown. Desktop renders the same list as aligned grid columns.
- Give each rarity a colour, add `--rarity-*` tokens to `globals.css`, and display `VeryRare` as "Very rare".
- Show `equipped` and `description` in the expanded row. `description` is currently stored and editable but never displayed anywhere.
- Add a confirmation step before deleting an item. Today the first click deletes.
- Sort the item list client-side by rarity, name, value or quantity, defaulting to rarity descending.
- Filter the History feed by category (Everyone / Items / Coins / Characters) over the entries already loaded, and state plainly how many of the loaded entries match so the window is never mistaken for the whole history.
- Group History entries by day, and lead each entry with the change itself rather than the actor's name. The server writes `detail` as a complete capitalised sentence ("Added Longsword to the party stash"), so prefixing it with the actor reads as "Zorina Added Longsword…". The actor moves to the line beneath, next to the time.
- Raise interactive controls to a 44px minimum on phone by adding a size variant to the shared `Input` and applying it across all five party dialogs, rather than sizing one dialog differently from the rest.
- Make the share code copyable, with a visible confirmation and a fallback for browsers where `navigator.clipboard` is unavailable — the app is commonly served over plain HTTP on a LAN, where that API does not exist.
- Keep a way back to the party list on phone. The handoff's phone header drops it.

This change is confined to the web frontend. No endpoint, contract, audit message, or database column is touched, so the deferred parts of the handoff fall into two groups.

Deferred until an API change makes them possible, and shaped for in the layouts here so they can be dropped in later: item provenance (`Added by` / `Added`), server-side audit filtering, and a rarity tag on audit entries.

**Item charges are not deferred work on this design — they are a separate feature.** The handoff shows a Charges cell in the expanded row as though the field merely needs surfacing, but nothing in the domain, the database or the contracts models charges at all. What a charge is, how it is spent and restored, and whether it belongs to an item or to a stack are product questions, not layout ones. They are left out of this change entirely and should be designed on their own.

## Capabilities

### New Capabilities

- `party-inventory-view`: How a player reads and manages one party's items and coins on a single screen — choosing whose inventory to view, seeing and acting on items, reading party history, and doing all of it on a phone.

### Modified Capabilities

None. The audit trail's recording rules and feed API are unchanged; this change only alters how that feed is presented.

## Impact

**Rewritten**

- `web/src/app/parties/[id]/page.tsx` — page shell, tabs, tab state in the URL
- `web/src/components/party/party-header.tsx` — name, share code copy, back link
- `web/src/components/party/party-items-section.tsx` — holder picker replaces tabs, coins card
- `web/src/components/party/party-items-table.tsx` — flat expandable list replaces the table
- `web/src/components/party/party-audit-feed.tsx` — day grouping, filters, entry layout
- `web/src/components/party/add-item-dialog.tsx` — bottom sheet on phone

**Added**

- `web/src/components/ui/sheet.tsx`, `web/src/components/ui/popover.tsx` — thin wrappers over primitives `@base-ui/react` already ships
- `web/src/lib/use-media-query.ts` — for the two surfaces that swap primitive rather than restyle

**Touched**

- `web/src/components/ui/{input,button,select,checkbox}.tsx` — a shared 44px size variant
- `web/src/app/globals.css` — `--rarity-*` tokens
- `web/src/lib/item-options.ts` — rarity display labels
- `web/src/lib/money.ts` — coin separator
- `web/src/components/party/{edit-item,coins,transfer-coins,add-character}-dialog.tsx` — adopt the size variant

**Unchanged**

- Everything outside `web/`. No endpoint, contract, migration or domain type is edited
- The audit `detail` strings. The feed renders the server's wording verbatim and is laid out around it
- Every generated type in `web/src/lib/api/`, and the API calls that use them
- `use-party-realtime.ts` and the SWR keys it revalidates
- The dialogs' fields and submit behaviour

**Risk**

Every party-page component changes at once, so there is no partial rollout.

`web/e2e/audit-trail.spec.ts` drives the party page through the UI and will need updating alongside the components. It selects the character tab (`getByRole("tab", { name: "Thorin" })`), table rows (`getByRole("row")`), the `Item actions` overflow menu, the icon-button labels `Add coins` / `Spend coins` / `Transfer coins`, the `Share code:` text and `span.font-mono` for the join code — all of which this change replaces. Its assertions on audit `detail` strings and on the actor's name must keep passing unchanged; that constrains how a history entry is composed.
