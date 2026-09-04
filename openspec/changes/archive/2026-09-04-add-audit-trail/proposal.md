## Why

Party data is mutated by anyone holding the party id, and nothing records who did it. When coins go missing from the stash or an item moves to another character, there is no way to see who made the change or when. The API has no identity concept at all today (`Party` is documented as "no accounts required"), so "who changed what" is currently unanswerable.

## What Changes

- Players supply a free-typed display name per party. The name is captured at the party door and stored locally alongside the existing remembered-party record.
- The browser sends that name on every mutating request as an `X-Actor-Name` header. The Next.js BFF proxy forwards the header to the .NET API.
- Every mutation that changes party data writes an append-only audit event in the same transaction as the mutation itself. Eleven existing write paths are affected (party coins set/spend/transfer, character create/update/delete and coin set/spend, item create/update/delete).
- Item edits and item moves are recorded as distinct events, even though both arrive on the same `PUT /api/parties/{partyId}/items/{itemId}` route.
- A new read endpoint returns a party-wide feed of audit events, newest first, paged.
- The party page gains a feed view listing who changed what and when. It refreshes off the existing `partyChanged` SignalR ping.
- **BREAKING**: audit-emitting write endpoints reject a request without a valid `X-Actor-Name` header with `400`. Existing clients that do not send the header stop working against these routes. `POST /api/parties` and `POST /api/parties/join` are exempt because no actor name exists yet at that point in the flow and neither emits an audit event.

## Capabilities

### New Capabilities
- `audit-trail`: recording who changed party data, when, and what changed; and reading that history back as a party-wide feed. Covers actor identification, the actor-name requirement on writes, the event record itself, and the feed endpoint.

### Modified Capabilities

None. No spec exists under `openspec/specs/` yet, so there are no existing requirements to amend. The actor-name requirement on existing write routes is specified as part of the new `audit-trail` capability rather than as a delta against uncaptured behavior.

## Impact

**API (`api/PartyInventory.Api`)**
- New `AuditEntry` domain entity, `DbSet`, and entity configuration in `AppDbContext`.
- New EF migration. Only `20260618183400_InitialCreate` exists today.
- New audit endpoints module for the read feed.
- Actor-name resolution applied to the eleven audit-emitting handlers across `PartyEndpoints`, `CharacterEndpoints`, and `ItemEndpoints`.
- `ItemEndpoints.UpdateItem` must distinguish a `CharacterId` change (move) from a field-only change (edit).

**Contract**
- `openapi/v1.json` snapshot changes. `OpenApiSnapshotTests` fails until refreshed with `UPDATE_OPENAPI_SNAPSHOT=1`.
- `web/src/lib/api/schema.ts` must be regenerated from the refreshed snapshot.
- `web/src/lib/api/routes.ts` allowlist must admit the new audit route, or the BFF returns "Unknown API route."

**Web (`web/src`)**
- `app/api/[...path]/route.ts` forwards `X-Actor-Name`; it currently copies only `content-type` and `accept`.
- `lib/remembered-parties.ts` gains an actor name on the stored record.
- New actor-name prompt gating the party page, plus the feed view itself.

**Tests**
- 47 mutating calls across four API test files currently send no actor header and would fail with `400`. Mitigated by setting a default request header in `ApiFactory` rather than editing each call site.

**Out of scope**
- Linking an actor to an existing `Character` (the `ClaimedByPlayerId` idea noted in `Character.cs`).
- Trustworthy or authenticated identity. The name is self-declared and spoofable by design.
- Filtering or scoping the feed by actor, entity, or action type.
- Retention or pruning. Events are kept indefinitely.
