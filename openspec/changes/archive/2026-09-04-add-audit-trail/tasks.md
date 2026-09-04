## 1. Domain and persistence

- [x] 1.1 Add the `AuditEntry` domain entity (id, party id, occurred-at, actor name, action, subject id, subject name, detail) and an `AuditAction` enum covering the eleven mutations; verify the solution builds with `dotnet build`
- [x] 1.2 Add `DbSet<AuditEntry>` and its configuration to `AppDbContext` — action and subject-id/name column types, max lengths on actor and subject names, the `(PartyId, OccurredAt, Id)` index, and cascade delete from `Party`; verify `dotnet ef migrations add AddAuditTrail` generates the expected table, index, and cascade
- [x] 1.3 Apply the migration against the dev database and verify the table and index exist (connect on `127.0.0.1`, not `localhost`)

## 2. Actor name on writes

- [x] 2.1 Add an endpoint filter that reads `X-Actor-Name`, trims it, and returns `Results.ValidationProblem` keyed on `X-Actor-Name` when it is missing, empty, or whitespace; verify a unit or endpoint test sees the problem-details shape and a `400`
- [x] 2.2 Apply the filter to the party-coins, character, and item route groups, leaving `POST /api/parties` and `POST /api/parties/join` exempt; verify tests confirm the eleven audit-emitting routes reject a header-less write and the two exempt routes still succeed without it
- [x] 2.3 Make the validated name available to handlers and confirm reads are unaffected; verify a test that `GET` requests on party, character, item, and stash routes succeed with no header
- [x] 2.4 Set a default `X-Actor-Name` header on the client created in `ApiFactory` so the 47 existing mutating test calls keep passing; verify `dotnet test` is green apart from the new deliberate rejection cases

## 3. Recording events

- [x] 3.1 Add the scoped audit-log service registered alongside `IPartyNotifier` that adds an entry to the current `AppDbContext` without saving; verify a test that calling it then `SaveChangesAsync` writes exactly one row
- [x] 3.2 Record events in the three party coin handlers — set, spend, transfer — with spend described as the amount spent and transfer as a single source-to-destination event; verify a test that spending 3 gp from a 5 gp purse records "spent 3 gp" rather than resulting balances
- [x] 3.3 Record events in the five character handlers — create, update, delete, coins set, coins spend; verify tests assert one event per successful call naming the character as it was at the time
- [x] 3.4 Record events in item create and delete; verify tests assert the event carries the item name as text so it survives the delete
- [x] 3.5 In `ItemEndpoints.UpdateItem`, compare `CharacterId` before and after and emit `ItemMoved`, `ItemEdited`, or both; verify tests cover move-only, edit-only, and combined requests
- [x] 3.6 Verify a test that a rejected write — validation failure and unknown id — records no event, and that all eleven handlers commit their event in the same `SaveChangesAsync` as the mutation
- [x] 3.7 Add a guard test that walks the audit-emitting routes and asserts each successful call leaves exactly one event, so a future endpoint cannot silently skip its audit line

## 4. Feed endpoint

- [x] 4.1 Add `GET /api/parties/{partyId}/audit` with `take` and `before` query parameters, newest first, defaulting `take` to 50 when omitted, clamping it to an upper bound of 200, and returning `404` for an unknown party; verify tests cover ordering, the default, the clamp, and the `404`
- [x] 4.2 Implement the `(OccurredAt, Id)` keyset cursor; verify a test that paging through events written in one batch with identical timestamps returns each event exactly once with no skips
- [x] 4.3 Verify tests that the feed is scoped to the requested party and returns an empty list, not an error, for a party with no history

## 5. Contract refresh

- [x] 5.1 Refresh the OpenAPI snapshot with `UPDATE_OPENAPI_SNAPSHOT=1 dotnet test` and commit `openapi/v1.json`; verify `OpenApiSnapshotTests` passes without the variable afterwards
- [x] 5.2 Regenerate frontend types and the route allowlist with `npm run gen:api` in `web/`; verify `src/lib/api/schema.ts` contains the audit path and that `isAllowedRoute` admits it — without this the BFF answers "Unknown API route."

## 6. Web plumbing

- [x] 6.1 Add the actor name to the stored `RememberedParty` record in `lib/remembered-parties.ts` with a per-party getter and setter; verify a party with no stored name reports none while another party's name is unaffected
- [x] 6.2 Attach `X-Actor-Name` to mutating requests via client middleware in `lib/api/client.ts` rather than at call sites; verify the header appears on a mutation and that the party page's reads still work before a name is set
- [x] 6.3 Forward `X-Actor-Name` in the BFF proxy at `app/api/[...path]/route.ts`, which currently copies only `content-type` and `accept`; verify a mutation from the browser reaches the API with the header intact
- [x] 6.4 Gate the party page on a stored actor name, prompting for one before party data renders and remembering it for that party; verify the prompt appears for a pasted URL on a fresh browser profile and does not reappear on return
- [x] 6.5 Ask for the actor name inline in the join-by-code flow so joining stays one step; verify joining by code lands on the party page without a second prompt

## 7. Feed UI

- [x] 7.1 Add the party-wide feed view to the party page showing actor, summary, and relative time, newest first; verify it lists events after a change and shows an empty state for a new party
- [x] 7.2 Page older events from the feed on demand using the cursor, with the client requesting `take=50` explicitly so the page size can later be changed in the frontend alone; verify paging past the first page loads older events without duplicates and that the request carries `take=50`
- [x] 7.3 Refresh the feed off the existing `partyChanged` signal via `use-party-realtime.ts`; verify a change made in a second browser appears in the first without a reload

## 8. Verification

- [x] 8.1 Run the full API suite with `dotnet test` and confirm it is green
- [x] 8.2 Run `npm run lint` and `npm run build` in `web/` and confirm both pass
- [x] 8.3 Exercise the stack end to end with `npm run dev` at the repo root — create a party, name yourself, move an item, spend coins, transfer coins, delete an item — and confirm the feed shows each action with the right actor, that the deleted item is still named, and that a second browser sees events live
