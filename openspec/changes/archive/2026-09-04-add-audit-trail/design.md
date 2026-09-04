## Context

See proposal.md — Why.

Constraints that shape the approach:

- The API has no identity infrastructure. `Program.cs` registers no authentication or authorization, and no handler touches `HttpContext` or `ClaimsPrincipal`. Anything resembling "who" has to be introduced from nothing.
- All eleven audit-emitting handlers already end with the same two lines: `await db.SaveChangesAsync()` followed by `await notifier.PartyChanged(partyId)`. That is a ready-made seam — audit rows can join the existing unit of work rather than needing a new one.
- Handlers use constructor-free minimal-API parameter injection (`AppDbContext db, IPartyNotifier notifier`) and return `Results.ValidationProblem(...)` for field errors. New plumbing should look like the existing plumbing.
- The browser never talks to the API directly. Everything crosses the Next.js BFF at `web/src/app/api/[...path]/route.ts`, which allowlists paths against a generated route table and forwards a deliberately narrow set of headers.
- `openapi/v1.json` is a committed snapshot pinned by a test, and `web/src/lib/api/schema.ts` is generated from it. Any API surface change is a three-step ritual, not a one-line edit.
- `web/AGENTS.md` warns that this Next.js version diverges from common knowledge and that `node_modules/next/dist/docs/` is authoritative. Frontend work should check the local docs before relying on remembered API shapes.

## Goals / Non-Goals

**Goals:**

- Attribute every party-data mutation to a named person, atomically with the mutation.
- Keep the audit write path a small, uniform addition to eleven handlers rather than a framework.
- Produce feed entries that read as sentences a player understands, not as row diffs.
- Leave a clean seam for the deferred character-claim idea without building it.

**Non-Goals:**

- Trustworthy identity. See proposal.md — Out of scope. Nothing here resists a player typing someone else's name.
- A generic change-data-capture layer. This records domain intent for a fixed set of operations, and new mutating endpoints will need their own audit line.
- Reconstructing past state. Events describe what happened; they are not enough to rebuild a party as of a given moment.

## Decisions

### Actor identity is a free-typed, per-party display name

Chosen because the product deliberately has no accounts (`Party.cs`: "Players join with the JoinCode; no accounts required") and the audit trail is informative, not forensic.

Per-party rather than global because one person plays a different character at each table; the name they want on the log differs by party. This also matches how `remembered-parties.ts` already stores state — a list keyed by party id — so the name is a new field on `RememberedParty` rather than a second storage key.

Alternatives considered:

- **Claim an existing `Character`.** Ties the log to a real entity and grows toward the `ClaimedByPlayerId` idea noted at `Character.cs:20`. Rejected as overkill for this change: the party creator arrives before any character exists, and a DM has no character to claim. Explicitly revisitable later.
- **Real accounts.** Rejected: kills the no-accounts design for a benefit nobody asked for.
- **One global name across parties.** Rejected: cheaper, but wrong for the actual usage pattern.

### The name travels as an `X-Actor-Name` header

A header keeps every existing request and response DTO untouched. Putting the actor in the body would mean editing eleven request contracts, the OpenAPI snapshot's request schemas, and every call site, to carry a value that is orthogonal to what each endpoint is about.

Consequence: the BFF must forward it. `route.ts` copies only `content-type` and `accept` today, so this is a deliberate one-line addition, not something that works by default.

On the browser side the header is attached once via client middleware in `createApiClient` rather than at each call site, so a new mutation cannot silently forget it.

### Missing or blank actor name is rejected with `400`

**Provisional — flagged by the user for revisiting after testing.**

The alternative was recording `"Unknown"` and letting the write through, on the grounds that the audit trail should never be able to break inventory management. The user chose rejection: a client that cannot say who it is should be updated rather than accommodated, and an audit trail with `"Unknown"` rows is worth less than one without gaps.

Trade-off accepted: a stale browser tab loses the ability to write until reloaded, and the failure mode is a `400` on a legitimate action rather than a slightly degraded log entry. Revisit if testing shows this is hit in practice.

Implemented as an endpoint filter applied to the audit-emitting route groups, not as a check repeated in eleven handlers. The filter validates the header, returns `Results.ValidationProblem` with `X-Actor-Name` as the key when it is missing or whitespace, and otherwise makes the trimmed name available to the handler. A filter is chosen over a custom parameter `BindAsync` because binding failures surface as `BadHttpRequestException`, which produces a bare `400` rather than the problem-details shape the rest of the API uses.

### `POST /api/parties` and `POST /api/parties/join` are exempt

**Provisional — same caveat as above.**

Ordering forces this. Party creation happens on the home page, before the player has ever seen the party, so no display name exists to send. Join-by-code is a lookup that mutates nothing. Neither records an audit event, so the rule stays coherent: *every write that produces an audit event must name an actor.*

Alternative considered: add an actor-name field to the create-party dialog so all writes carry the header uniformly. Rejected for now as extra UI on a dialog that currently asks exactly one thing. It remains the fallback if the exemption proves confusing in testing.

### Events record intent, not row diffs

A snapshot-diff approach — capture the entity before and after each write — would be generic and need one interceptor instead of eleven call sites. It was rejected on evidence from the code:

- `CoinUpdates.TrySpend` (`CoinUpdates.cs:54`) breaks higher denominations downward to cover a shortfall. Spending 3 gp from a 5 gp purse produces a diff like `gold 5 → 1, silver 0 → 10, copper 0 → 0`, which is unreadable precisely for the operation people most want to audit.
- A coin transfer is one intent spanning two purses. A diff renders it as two unrelated row changes and loses the link between them.

So each handler emits an explicit event naming what the player did. The human-readable summary is rendered at write time, in the handler that knows the intent, rather than at read time from stored numbers.

Cost accepted: a future mutating endpoint that forgets its audit line produces a silent gap. Mitigated by a test asserting each audit-emitting route leaves exactly one event.

### Move and edit are separate event kinds on one route

`PUT /api/parties/{partyId}/items/{itemId}` does double duty: it edits an item's fields and, via `item.CharacterId = request.CharacterId` (`ItemEndpoints.cs:139`), moves it between a character and the stash. The UI already treats these as two actions (`move-item-dialog.tsx`, `edit-item-dialog.tsx`) but both post the same request.

The handler compares `CharacterId` before and after and emits `ItemMoved`, `ItemEdited`, or both. No API shape changes; the distinction is derived server-side from what actually changed. Deriving it is preferable to trusting a client-supplied intent flag, which a direct API caller could set wrongly.

### Storage shape

One append-only table. Fields: id, party id, occurred-at, actor name, action, subject id (nullable), subject name, detail.

- `Action` is an enum persisted as a string, following the existing convention for `Item.Type` and `Item.Rarity` (`AppDbContext.cs:50-51`). Readable in the database and stable against reordering.
- `SubjectName` is denormalized text captured at write time. This is what makes the log survive deletion of its subject, and it is also what preserves the name a thing had at the time rather than its current name.
- `SubjectId` is a plain `Guid?` with no foreign key. A foreign key would either block deletes or cascade the history away; both defeat the point. The id is for future filtering, never required for display.
- Indexed on `(PartyId, OccurredAt DESC, Id DESC)` to serve the feed's only query.
- Cascade-deleted with its party, which is the one deletion that should take the history with it.

Audit rows are added to the same `AppDbContext` and committed by the handler's existing `SaveChangesAsync`, giving atomicity with no explicit transaction. This is why the audit helper adds to the context but never saves — saving is left to the handler, exactly where it already happens.

The helper is a scoped service registered alongside `IPartyNotifier`, matching the established injection style and keeping handlers fakeable in tests.

### Summary text is clear and concise

Each event's summary is one short line naming what happened, in the player's vocabulary rather than the schema's. It states the action and the amount or item, and nothing the row already carries — the actor and the timestamp are separate fields, so the text does not repeat them.

Conventions:

- Present the intent, not the mechanism: `Spent 3 gp`, never a list of denominations.
- Name both ends of a movement: `Moved Longsword to Thorin`, `Moved Longsword to the stash`, `Transferred 5 gp from the stash to Thorin`.
- Say what changed on an edit rather than restating the entity: `Edited Longsword`, naming the changed fields when there are only a few.
- No trailing punctuation, no actor prefix, no ids.

The subject name is stored in its own field as well, so a later feed view can style subjects distinctly without parsing the summary.

### Feed paging uses a keyset cursor

`GET /api/parties/{partyId}/audit?take=<n>&before=<cursor>`, newest first.

Page size is chosen by the caller, not fixed by the server. The web client requests `take=50` explicitly, so tuning the page size later is a frontend change and needs no API deploy, no snapshot refresh, and no type regeneration. The server applies `50` when `take` is omitted, and enforces an upper bound of `200` — the bound is an abuse guard, not the page size, and should stay well above any value the client is likely to ask for.

Keyset rather than offset because the feed is append-heavy at the head: with offset paging, events arriving while a player reads shift the window and cause duplicates or skips. The cursor is `(OccurredAt, Id)` rather than a timestamp alone, because two events in one request — an edit and a move of the same item — can share a timestamp and would otherwise be split across a page boundary unpredictably.

Retention is unbounded per the agreed pin; paging is what keeps that affordable rather than a pruning job.

### The feed reuses the existing realtime ping

`PartyNotifier` already broadcasts a contentless `partyChanged` to the party's group on all eleven mutation paths, and clients revalidate over REST. The feed subscribes to the same signal through `use-party-realtime.ts`. No hub method, no new message type, no payload design — and the feed cannot drift out of sync with the rest of the party view, because both refresh off one event.

## Risks / Trade-offs

- **A future mutating endpoint forgets its audit line** → Gaps are silent, and the "if and only if" requirement is unenforceable by the compiler. Mitigate with a test that walks the mutating routes and asserts each leaves exactly one event; treat adding the audit line as part of adding any mutation.
- **The `400` rule breaks 47 existing test calls** → Set the header once as a default on the client in `ApiFactory` so all existing tests inherit it, then add explicit tests that omit it to prove the rejection. Editing 47 call sites would be churn that hides the two cases that matter.
- **A stale browser tab writes without the header and gets `400`** → Accepted consequence of the rejection decision. The party page gate means a reload fixes it. Watch for this during testing; the fallback is the `"Unknown"` behaviour originally proposed.
- **Players type inconsistent names** ("Scott", "scott", "Scotty") → Fragmented history that filtering would later struggle with. Not solved here: names are trimmed but not normalized or deduplicated. This is the known cost of free-typed identity and part of what character-claiming would fix later.
- **Detail text is frozen at write time** → A wording improvement will not apply retroactively, and a bug in the rendering leaves permanently wrong text. Accepted: the alternative — rendering at read time — cannot recover intent that was never stored.
- **Feed grows without bound** → Party inventory volume is small and paging bounds each response, so the practical risk is table size over years, not query latency. Revisit only if a real party makes it a problem.
- **The BFF forwards a client-controlled header** → It is untrusted by construction and only ever stored as text, never used for authorization. Guard the storage boundary instead: cap the name's length and store it as data, so a long or hostile string cannot become a rendering or storage problem.

## Migration Plan

1. Add the entity and its EF migration. Only `20260618183400_InitialCreate` exists today, so this is the second migration on a young schema. The table is new and nothing else changes, so the migration is additive and its `Down` is a clean drop.
2. Deployment already applies migrations when `ApplyMigrationsAtStartup` is set (`Program.cs:29`), so the compose stack provisions the table on its own.
3. Ship API and web together. The `400` rule means an API deployed ahead of the web client rejects writes from the old client. There is no staged rollout that avoids this, which is the cost of the rejection decision.
4. Rollback: revert both, then drop the table. No existing data is transformed, so nothing is lost that existed before the change.
