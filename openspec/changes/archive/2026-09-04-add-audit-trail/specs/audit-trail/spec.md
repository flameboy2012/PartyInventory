## Purpose

Records who changed a party's shared data, when they changed it, and what changed, then makes that history readable as a party-wide feed. Identity here is self-declared and informative rather than authenticated: it answers "who moved the sword" for a group that already trusts each other.

## ADDED Requirements

### Requirement: Player identifies themselves per party

The system SHALL ask a player for a display name before they can interact with a party, and SHALL remember that name for that party on that device. The name SHALL be scoped per party, so the same person can use different names in different parties.

The name is self-declared. The system SHALL NOT treat it as proof of identity, and SHALL NOT prevent two players from choosing the same name.

#### Scenario: First entry to a party

- **WHEN** a player opens a party for which no display name is stored on their device
- **THEN** the system prompts for a display name before showing the party's data

#### Scenario: Returning to a known party

- **WHEN** a player opens a party for which a display name is already stored on their device
- **THEN** the system uses the stored name and does not prompt again

#### Scenario: Same person, two parties

- **WHEN** a player has stored the name "Scott" for party A and then opens party B for the first time
- **THEN** the system prompts for a display name for party B rather than reusing "Scott"

#### Scenario: Entry by a route other than the join code

- **WHEN** a player reaches a party by a shared link or on a new device, without going through the join-code flow
- **THEN** the system prompts for a display name before showing the party's data

### Requirement: Writes carry the acting player's name

Every request that changes a party's data SHALL carry the acting player's display name in an `X-Actor-Name` request header.

The system SHALL reject such a request with `400` when the header is absent, empty, or whitespace only, and SHALL NOT apply the requested change. The rejection SHALL identify `X-Actor-Name` as the offending field, in the same problem-details shape used by other validation failures.

Creating a party and joining a party by code are exempt: no display name exists at that point in the flow, and neither records an audit event.

#### Scenario: Write without an actor name

- **WHEN** a client sends a request that changes party data and omits the `X-Actor-Name` header
- **THEN** the system responds `400`, names `X-Actor-Name` as the offending field, and leaves the party's data unchanged

#### Scenario: Write with a blank actor name

- **WHEN** a client sends a request that changes party data with an `X-Actor-Name` header that is empty or whitespace only
- **THEN** the system responds `400` and leaves the party's data unchanged

#### Scenario: Reading does not require an actor name

- **WHEN** a client requests party, character, item, stash, or audit-feed data without an `X-Actor-Name` header
- **THEN** the system serves the request normally

#### Scenario: Creating a party without an actor name

- **WHEN** a client creates a party without an `X-Actor-Name` header
- **THEN** the system creates the party and records no audit event

#### Scenario: Joining a party without an actor name

- **WHEN** a client looks up a party by join code without an `X-Actor-Name` header
- **THEN** the system returns the party and records no audit event

### Requirement: Every change to party data is recorded

The system SHALL record an audit event for every change to a party's characters, items, or coins. Each event SHALL capture the acting player's name, the time it occurred, the party it belongs to, what kind of change it was, which thing was changed, and a human-readable summary of the change.

An event SHALL be recorded if and only if the change it describes was applied. A failed or rejected change SHALL leave no event, and an applied change SHALL leave no gap.

Recorded events SHALL be append-only: the system SHALL provide no way to edit or delete an event, and SHALL retain events for the life of the party.

#### Scenario: Successful change is recorded

- **WHEN** a player adds an item to a party
- **THEN** the system records an event naming that player, the time, the item, and the fact that it was added

#### Scenario: Rejected change records nothing

- **WHEN** a player submits a change that fails validation or targets something that does not exist
- **THEN** the system records no audit event

#### Scenario: Failure partway through leaves no orphan record

- **WHEN** a change is applied but storing it does not complete
- **THEN** neither the change nor its audit event is visible afterwards

#### Scenario: Events cannot be altered

- **WHEN** a client attempts to modify or delete a recorded event through the API
- **THEN** no such operation is available

### Requirement: Coin changes are recorded as the player's intent

An audit event for a coin change SHALL describe what the player did, not the resulting balances. Spending coins can break larger denominations into smaller ones, so a description in terms of before-and-after amounts would misrepresent a simple purchase.

A transfer between two purses SHALL be recorded as one event describing the movement, not as two separate changes.

#### Scenario: Spending that breaks a denomination

- **WHEN** a player spends 3 gold from a purse that holds 5 gold and no silver, and covering the amount requires breaking coins down
- **THEN** the event describes spending 3 gold, rather than describing the resulting balance of each denomination

#### Scenario: Transfer between purses

- **WHEN** a player transfers coins from the party stash to a character
- **THEN** the system records a single event naming the source, the destination, and the amount

### Requirement: Moving an item is distinguished from editing it

The system SHALL record moving an item between a character and the party stash as a different kind of event from editing an item's own details, even though both are requested the same way.

#### Scenario: Item handed to a character

- **WHEN** a player changes an item's holder from the stash to a character
- **THEN** the system records a move event naming the item, its previous holder, and its new holder

#### Scenario: Item details corrected

- **WHEN** a player changes an item's name, quantity, value, weight, type, rarity, or equipped state without changing its holder
- **THEN** the system records an edit event and not a move event

#### Scenario: Item edited and moved at once

- **WHEN** a player changes both an item's holder and its other details in one request
- **THEN** the recorded history shows both the move and the edit

### Requirement: History survives deletion of what it describes

An audit event SHALL remain readable and meaningful after the character, item, or party member it describes is deleted. Each event SHALL carry the name of its subject as recorded at the time of the change, so the feed never degrades into unresolvable identifiers.

#### Scenario: Deleted item still named in history

- **WHEN** an item named "Longsword" is deleted and a player then reads the feed
- **THEN** the feed shows the deletion, and earlier events about that item, still naming it "Longsword"

#### Scenario: Renamed subject keeps its historical name

- **WHEN** a character is renamed after an event was recorded about it
- **THEN** the earlier event still shows the name the character had when the change happened

### Requirement: Party-wide audit feed is readable

The system SHALL expose a party's audit events as a single feed at `GET /api/parties/{partyId}/audit`, ordered newest first.

The feed SHALL be pageable, returning at most a bounded number of events per request and allowing a client to request the next page of older events. The system SHALL respond `404` for a party that does not exist.

#### Scenario: Reading a party's history

- **WHEN** a client requests the feed for an existing party
- **THEN** the system returns that party's events, newest first, each carrying the actor name, the time, the kind of change, the subject, and the summary

#### Scenario: Feed is scoped to one party

- **WHEN** a client requests the feed for one party while other parties also have events
- **THEN** the response contains only events belonging to the requested party

#### Scenario: Paging through older events

- **WHEN** a party has more events than fit in one page and a client requests the next page
- **THEN** the system returns the next older events without repeating or skipping any

#### Scenario: Unknown party

- **WHEN** a client requests the feed for a party id that does not exist
- **THEN** the system responds `404`

#### Scenario: Empty history

- **WHEN** a client requests the feed for a party that has been created but never changed
- **THEN** the system returns an empty feed rather than an error

### Requirement: Feed reflects changes as they happen

An open feed SHALL update when another player changes the party, without the viewer reloading the page, using the same change notification that already refreshes the rest of the party view.

#### Scenario: Another player makes a change

- **WHEN** a player is viewing the feed and another player in the same party changes an item
- **THEN** the viewer's feed shows the new event without a manual reload
