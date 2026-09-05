## Purpose

Describes how a player reads and manages one party's items and coins on a single screen: choosing whose inventory to look at, seeing and acting on items, and reading the party's history. The screen is used on a phone at the table as much as on a desktop, so it must stay usable as a party grows.

## ADDED Requirements

### Requirement: Choosing whose inventory to view

The view SHALL let a player switch between the party stash and any character's inventory using a control whose size does not grow with the number of characters. Adding characters SHALL NOT cause the switching control to overflow, wrap, or scroll horizontally.

The control SHALL show which holder is currently selected, and SHALL identify each holder by name together with what that holder is carrying, so a player can choose without switching first.

The party stash SHALL be the selection when the view is first opened. If the selected character stops existing, the view SHALL fall back to the party stash rather than showing an empty or broken inventory.

A player SHALL be able to add a character from within the holder-switching control. On success the new character SHALL become the selected holder.

#### Scenario: A party with many characters

- **WHEN** a party has eight characters and a player opens the view on a phone
- **THEN** the holder control occupies the same space it does for a party with one character, and every holder remains reachable

#### Scenario: Choosing a holder

- **WHEN** a player opens the holder control and chooses a character
- **THEN** the control closes, the view shows that character's items and coins, and the control names that character as selected

#### Scenario: Seeing what each holder carries before choosing

- **WHEN** a player opens the holder control
- **THEN** each holder is listed with its name, how many items it holds, and how many coins it holds

#### Scenario: Selected character is removed

- **WHEN** the character whose inventory is being viewed is deleted, by this player or another
- **THEN** the view falls back to the party stash

#### Scenario: Adding a character from the holder control

- **WHEN** a player adds a character from within the holder control
- **THEN** the character is created and becomes the selected holder

### Requirement: Inventory and history are separate views

The view SHALL present the inventory and the party history as two alternatives rather than stacking both on one scrolling page. Inventory SHALL be shown by default.

The chosen alternative SHALL be reflected in the page address, so that a player who shares or reloads the address returns to the same one.

History is party-wide and SHALL NOT be affected by which holder is selected. The holder control SHALL NOT be shown while history is being read.

#### Scenario: Default view

- **WHEN** a player opens a party without asking for a particular view
- **THEN** the inventory is shown

#### Scenario: Returning to a shared address

- **WHEN** a player opens an address that names the history view
- **THEN** the history is shown without the player switching to it

#### Scenario: History ignores the selected holder

- **WHEN** a player selects a character, then switches to history
- **THEN** the history shows changes made to the whole party, and no holder control is offered

### Requirement: Items are listed as one flat list

The selected holder's items SHALL be shown as a single list, one entry per item, with no grouping level a player must expand to reach an item.

Each entry SHALL show, without any further interaction, the item's name, its rarity, its type, its value, and its quantity. Where an item's quantity is greater than one, its value SHALL be labelled as being per item, so that a stack's per-item value is never mistaken for a total.

The list SHALL be preceded by a summary of how many items the holder carries and their total weight.

An entry SHALL NOT require horizontal scrolling to read on a phone.

#### Scenario: Reading an item at a glance

- **WHEN** a holder carries a Longsword worth 50 gp
- **THEN** the list entry shows its name, rarity, type, value and quantity without the player interacting with it

#### Scenario: A stack of items

- **WHEN** an item has a quantity of 6 and a value of 50 gp
- **THEN** the entry shows the quantity as 6 and states that 50 gp is the value of each one

#### Scenario: Holder summary

- **WHEN** a holder carries 6 items weighing 41 lb in total
- **THEN** the list is preceded by a summary reading 6 items and 41 lb

#### Scenario: Holder with nothing

- **WHEN** the selected holder carries no items
- **THEN** the view says `No items here yet.`

### Requirement: Item details and actions are reached by opening the item

A player SHALL be able to open a list entry to reveal that item's remaining details and its actions. Opening an entry SHALL close any entry that was already open, so that at most one is open at a time.

The revealed details SHALL include the item's weight, its value, its type, whether it is equipped, and its description when it has one. Whether an item is equipped SHALL be visible somewhere in the view, because it can be changed by editing the item.

The item's actions — giving it to another holder, editing it, and deleting it — SHALL be reachable directly from the opened entry, without a further menu.

#### Scenario: Opening an item

- **WHEN** a player opens a list entry
- **THEN** that item's weight, value, type, equipped state and description are shown, along with its give, edit and delete actions

#### Scenario: Only one item open

- **WHEN** a player opens a second list entry while a first is open
- **THEN** the first entry closes

#### Scenario: An item with no description

- **WHEN** an opened item has no description
- **THEN** no empty description is shown, and the remaining details keep their layout

#### Scenario: Acting on an item

- **WHEN** a player chooses give, edit or delete on an opened entry
- **THEN** the corresponding action starts without the player opening a menu first

### Requirement: Deleting an item is confirmed

The view SHALL ask a player to confirm before an item is deleted, and SHALL delete the item only after that confirmation. Deletion SHALL NOT be triggered by a single press.

The confirmation SHALL name the item being deleted, and SHALL offer a way to abandon the deletion. Abandoning it SHALL leave the item unchanged.

#### Scenario: Deletion is confirmed

- **WHEN** a player presses delete on an item and then confirms
- **THEN** the item is deleted and disappears from the list

#### Scenario: Deletion is abandoned

- **WHEN** a player presses delete on an item and then abandons the confirmation
- **THEN** the item is not deleted and remains in the list

#### Scenario: A single mistaken press

- **WHEN** a player presses delete on an item and does nothing further
- **THEN** the item is not deleted

### Requirement: Item list order can be chosen

A player SHALL be able to order the item list by rarity, name, value or quantity. The list SHALL be ordered by rarity, rarest first, until the player chooses otherwise.

Ordering SHALL apply to the items already shown and SHALL NOT change which items are shown.

#### Scenario: Default order

- **WHEN** a player opens a holder's inventory
- **THEN** the items are ordered by rarity with the rarest first

#### Scenario: Changing the order

- **WHEN** a player chooses to order by value
- **THEN** the same items are shown, ordered by value

### Requirement: Rarity is shown as a colour

Each rarity SHALL be shown with a colour that distinguishes it from every other rarity, consistently everywhere a rarity appears in the view. Common SHALL be treated as the quiet default rather than given a colour of its own, so that ordinary equipment does not compete for attention.

Rarity colours SHALL meet the contrast the rest of the view meets, and SHALL NOT be the only way a rarity is conveyed: the rarity's name SHALL always be present as text.

The rarity recorded as `VeryRare` SHALL be shown to players as `Very rare`.

#### Scenario: Distinguishing two rarities

- **WHEN** a list holds one rare item and one legendary item
- **THEN** the two are shown in different colours, and each is also named in text

#### Scenario: Ordinary equipment

- **WHEN** an item is of common rarity
- **THEN** it is shown without a rarity colour

#### Scenario: The two-word rarity

- **WHEN** an item's rarity is recorded as `VeryRare`
- **THEN** the view shows `Very rare`

### Requirement: Coins are visible and actionable beside the items

The selected holder's coins SHALL be shown alongside their items, broken down by denomination, omitting denominations the holder has none of. A holder with no coins at all SHALL be shown as holding `0 gp`.

Adding coins, spending coins and sending coins to another purse SHALL be offered from the same place. Sending SHALL be offered only when another purse exists to send to.

#### Scenario: A mixed purse

- **WHEN** a holder has 143 gold and 12 silver and no other coins
- **THEN** the view shows 143 gp and 12 sp, and shows no other denomination

#### Scenario: The only purse

- **WHEN** a party has no characters, so the stash is the only purse
- **THEN** adding and spending are offered and sending is not

### Requirement: History is a dated feed of the party's changes

The history SHALL present the party's recorded changes newest first, grouped under the day they happened.

Each entry SHALL show what changed, who changed it, and when. The recorded description of a change SHALL be shown as it was recorded, without the view rewording it, so that the history a player reads matches the history that was stored.

Times SHALL be shown relative to now for changes made today, and as a time of day for older ones.

The history SHALL offer to load older changes whenever more exist, and SHALL NOT offer to when none do.

#### Scenario: Reading the feed

- **WHEN** a party has changes from today and from yesterday
- **THEN** the changes are grouped under a heading for each day, newest day first

#### Scenario: A recorded change is shown verbatim

- **WHEN** a change was recorded as `Moved Longsword from the party stash to Thorin`
- **THEN** the entry shows that description unchanged, together with the name of the player who made it

#### Scenario: Times

- **WHEN** one change happened twelve minutes ago and another happened yesterday evening
- **THEN** the first is shown as a relative time and the second as a time of day

#### Scenario: Nothing has happened

- **WHEN** a party has no recorded changes
- **THEN** the history says `Nothing has changed yet. Actions you take show up here.`

#### Scenario: No older changes remain

- **WHEN** every recorded change has been loaded
- **THEN** no offer to load older changes is shown

### Requirement: History can be narrowed to a kind of change

A player SHALL be able to narrow the history to changes about items, about coins, or about characters, and to return to seeing all changes. Seeing all changes SHALL be the state until the player narrows it.

Narrowing SHALL apply to the changes currently loaded, not to the party's whole history. Because the history is loaded a page at a time, the view SHALL state how many of the loaded changes match, so that a narrowed view is never mistaken for the complete record. The offer to load older changes SHALL remain available while narrowed.

Every kind of recorded change SHALL fall into exactly one of the three categories, so that narrowing never hides a change from all of them.

#### Scenario: Narrowing to coins

- **WHEN** a player narrows the history to coins
- **THEN** only coin changes are listed, and the view states how many of the loaded changes that is

#### Scenario: The narrowed view is not the whole history

- **WHEN** a player narrows the history while older changes have not been loaded
- **THEN** the view makes clear that it is showing matches among the loaded changes, and still offers to load older ones

#### Scenario: Every change is reachable

- **WHEN** a player narrows the history to each category in turn
- **THEN** every loaded change appears under exactly one of them

### Requirement: The view is usable on a phone

The view SHALL be usable at a viewport width of 390px. No part of it SHALL require horizontal scrolling, and no interactive control SHALL be smaller than 44px in its smaller dimension at that width. Controls that share this constraint SHALL be sized consistently with one another, so that one part of the view is not noticeably harder to hit than another.

Starting to add an item SHALL be possible from anywhere in the item list without the player scrolling to find the control.

The view SHALL offer a way back to the list of parties at every width.

#### Scenario: A long item list on a phone

- **WHEN** a player scrolls to the end of a long item list at 390px wide
- **THEN** the control for adding an item is still reachable without scrolling back

#### Scenario: Touch targets

- **WHEN** a player uses any control in the view or in any of its dialogs at 390px wide
- **THEN** that control is at least 44px in its smaller dimension

#### Scenario: No sideways scrolling

- **WHEN** a player views a holder with long item names at 390px wide
- **THEN** the page does not scroll horizontally

#### Scenario: Leaving the party

- **WHEN** a player is on the party view at 390px wide
- **THEN** a way back to the list of parties is available

### Requirement: The share code can be copied

The view SHALL show the party's share code and SHALL let a player copy it in one action, confirming visibly that it was copied.

Copying SHALL work where the browser offers no clipboard access — as happens when the app is served over plain HTTP on a local network, which is how players commonly reach it. Where copying is not possible, the code SHALL remain selectable so that a player can copy it by hand, and the view SHALL NOT claim to have copied it.

#### Scenario: Copying the code

- **WHEN** a player triggers the copy action
- **THEN** the share code is placed on the clipboard and the view confirms it visibly

#### Scenario: No clipboard available

- **WHEN** the browser gives the page no clipboard access
- **THEN** the view does not report a successful copy, and the code can still be selected by hand

### Requirement: Existing party-view behaviour is preserved

The view SHALL continue to require a player to have named themselves before anything that can change the party is shown, and SHALL continue to show `Loading…` while a party loads and `Couldn't load this party.` when it cannot be loaded.

A change made by another player SHALL continue to reach an open view — its items, coins, characters and history — without the viewer reloading.

The fields and the outcome of adding an item, editing an item, giving an item, adding a character, and adding, spending or sending coins SHALL be unchanged.

#### Scenario: A player who has not named themselves

- **WHEN** a player opens a party for which no name is stored on their device
- **THEN** they are asked for a name before anything that changes the party is shown

#### Scenario: Another player's change

- **WHEN** another player adds an item while this view is open on the inventory
- **THEN** the item appears without the viewer reloading

#### Scenario: Another player's change while reading history

- **WHEN** another player changes the party while this view is open on the history
- **THEN** the change appears in the feed without the viewer reloading

#### Scenario: Adding an item

- **WHEN** a player adds an item
- **THEN** the same fields are asked for, and the item is added to the selected holder, as before this change
