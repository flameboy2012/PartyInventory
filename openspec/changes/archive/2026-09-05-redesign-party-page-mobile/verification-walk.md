# Task 10.3 — walk of the party view against `specs/party-inventory-view/spec.md`

> **Later note.** Everything below the *Settled later, in a browser* heading was added once Docker
> could start. The tables are the original source walk, and three of their rows have since been
> measured — one of them did not hold. Read the tables as reasoning, not as verification.

**How this was done.** The Docker stack (web + API + Postgres) cannot start on this machine, so no
browser walk at 390px and 900px was possible. Docker Desktop's engine returns
`500 Internal Server Error` on its named pipe because its `docker-desktop` WSL2 distro will not
boot:

```
WSL2 is unable to start since virtualisation is not enabled on this machine.
Error code: Wsl/Service/CreateInstance/CreateVm/HCS/HCS_E_HYPERV_NOT_INSTALLED
```

`Win32_Processor.VirtualizationFirmwareEnabled` is `False` and `HypervisorPresent` is `False`, so
VT-x is disabled in firmware and no Windows-feature change can work around it. There is no
non-Docker path either: `api/PartyInventory.Api/Program.cs:17` is `UseNpgsql` only, this machine
has no local Postgres (no service, no `psql`, nothing on 5432), and
`api/PartyInventory.Api.Tests/ApiFactory.cs:52` uses Testcontainers, which also needs Docker.
Adding a SQLite provider would have edited `api/`, which task 10.4 forbids. What
follows is a walk of every scenario against the implementation and the built CSS, marking each as
**holds**, **holds — needs a live check**, or **does not hold**. The three scenarios that need a
live check are measurement and gesture questions that only a browser can settle. Everything found
short during the walk was fixed and is recorded under *Fixed during this walk*.

## Choosing whose inventory to view

| Scenario | Result |
|---|---|
| A party with many characters | Holds. The picker is one fixed-size button (`holder-picker.tsx`); the list scrolls inside the sheet at `max-h-[50dvh]`, and every holder name truncates. Nothing about the trigger grows with the character count. |
| Choosing a holder | Holds. `onSelect` sets the holder and closes the container; the trigger names the selection. |
| Seeing what each holder carries before choosing | Holds. `carriedSummary()` gives name, item count and `formatCoins()` on every row. |
| Selected character is removed | Holds. `party-items-section.tsx` falls back to `STASH` whenever the selected id is absent from `characters`, which SWR revalidation refreshes on a realtime ping. |
| Adding a character from the holder control | Holds. `AddCharacterDialog` now reports the created `CharacterResponse`, and the picker selects it and closes. |

## Inventory and history are separate views

| Scenario | Result |
|---|---|
| Default view | Holds. Any value other than `history` reads as inventory, including no parameter at all. |
| Returning to a shared address | Holds. `?tab=history` is read on mount; tab switches write it with `window.history.replaceState`. |
| History ignores the selected holder | Holds. The feed takes only `partyId`, and the inventory panel — the picker with it — is not rendered while history is the active tab. |

## Items are listed as one flat list

| Scenario | Result |
|---|---|
| Reading an item at a glance | Holds. Name, rarity tag, type, value and quantity are all in the collapsed row. |
| A stack of items | Holds. `50 gp each` when `quantity > 1`, `50 gp` when it is 1. |
| Holder summary | Holds. `{n} items · {Σ weight × quantity} lb` above the list. |
| Holder with nothing | Holds. `No items here yet.` |
| An entry does not need horizontal scrolling | Holds — needs a live check. The name column is `minmax(0,1fr)` with `truncate`, and the meta line's cells are `min-w-0 truncate`, so the arithmetic says it fits at 390px. Worth confirming with a 60-character item name in a browser. |

## Item details and actions are reached by opening the item

| Scenario | Result |
|---|---|
| Opening an item | Holds. Weight, value, type, equipped and description, plus Give to… / Edit / delete. |
| Only one item open | Holds. `expandedId` is a single id, so opening one closes the other. |
| An item with no description | Holds. The paragraph is conditional, and it sits below the detail grid rather than inside it, so nothing leaves a gap. |
| Acting on an item | Holds. All three actions are buttons in the opened row; the `⋯` menu is gone. |

## Deleting an item is confirmed

| Scenario | Result |
|---|---|
| Deletion is confirmed | Holds. |
| Deletion is abandoned | Holds. Cancel closes the dialog and fires no request. |
| A single mistaken press | Holds. The trash button only sets `confirmDelete`; `DELETE` is behind the dialog's Delete button. |

## Item list order can be chosen

| Scenario | Result |
|---|---|
| Default order | Holds. `sort` starts at `rarity`, compared with `ITEM_RARITY_ORDER[b] - ITEM_RARITY_ORDER[a]`, so rarest first. |
| Changing the order | Holds. `[...items].sort(...)` reorders a copy and filters nothing, so the set is identical in every order. |

## Rarity is shown as a colour

| Scenario | Result |
|---|---|
| Distinguishing two rarities | Holds. Rare and Legendary resolve to different tokens; the built CSS emits `.bg-rarity-rare\/12{background-color:color-mix(in oklab, var(--rarity-rare) 12%, transparent)}` and the matching Legendary rule. |
| Ordinary equipment | Holds. Common takes the border treatment and no colour. |
| The two-word rarity | Holds. `ITEM_RARITY_LABELS.VeryRare` is `Very rare`, used by the tag and by the Add and Edit rarity selects. |
| Contrast | Holds — needs a live check. The `-fg` tokens sit at lightness 0.45–0.5 on a white ground, which clears 4.5:1 by calculation, but this was not measured with a contrast tool. Dark mode is out of scope for this change and is not verified. |

## Coins are visible and actionable beside the items

| Scenario | Result |
|---|---|
| A mixed purse | Holds. `formatCoins` omits empty denominations and joins with ` · `. |
| The only purse | Holds. Send renders only when `transferDestinations.length > 0`. |

## History is a dated feed of the party's changes

| Scenario | Result |
|---|---|
| Reading the feed | Holds. Entries arrive newest first, so grouping consecutively by local day yields newest day first without re-sorting. |
| A recorded change is shown verbatim | Holds. `entry.detail` is rendered unaltered on the first line, with `entry.actorName` beneath it in the same `<li>`. |
| Times | Holds. Relative while the entry's local day is today, `toLocaleTimeString` otherwise. |
| Nothing has happened | Holds. |
| No older changes remain | Holds. `Load older` is behind `cursor`. |

## History can be narrowed to a kind of change

| Scenario | Result |
|---|---|
| Narrowing to coins | Holds. Five coin actions map to `coins`; the count line appears whenever a filter is active. |
| The narrowed view is not the whole history | Holds. `N of M loaded changes` names the window, and `Load older` stays available while narrowed. |
| Every change is reachable | Holds. `ACTION_CATEGORY` is `Record<AuditAction, Category>` over all twelve actions, each mapped once. Dropping a key fails the build. |

## The view is usable on a phone

| Scenario | Result |
|---|---|
| A long item list on a phone | Holds. The add button is `fixed right-4 bottom-5` below `md`, and the list carries `pb-24` so its last row clears it. |
| Touch targets | Holds, with one deliberate reading — needs a live check. Every control in the view and its dialogs is now `h-11` or larger below `md` (see the fixes below). The exception is the Equipped checkbox in the Edit dialog: its box is 20px and its `::after` extends the hit area to exactly 44px square. That is a 44px target but a 20px element, so a tool that measures the element rather than the target will read 20px. Flagged rather than resolved, because a 44px checkbox is not a thing the design draws. |
| No sideways scrolling | Holds — needs a live check. See the item-row note above; the coins card was the one real overflow found and is fixed. |
| Leaving the party | Holds. `← All parties` renders above the loading and error states as well as the loaded view, so it is reachable even when the party fails to load. |

## The share code can be copied

| Scenario | Result |
|---|---|
| Copying the code | Holds. One press, with a `Copied` confirmation in an `aria-live` region. |
| No clipboard available | Holds. `navigator.clipboard?.writeText` is feature-detected and the `await` is wrapped, so both an absent API and a rejected promise fall through to selecting the code and saying `Selected — copy it by hand`. Nothing claims a copy that did not happen. |

## Existing party-view behaviour is preserved

| Scenario | Result |
|---|---|
| A player who has not named themselves | Holds. The gate is unchanged. |
| Another player's change | Holds. `usePartyRealtime` and its four mutations are untouched. |
| Another player's change while reading history | Holds. The feed's SWR key is revalidated by the same ping, and the feed is mounted while history is the active tab. |
| Adding an item | Holds. Same fields, same request body, same `onAdded`. |

## Fixed during this walk

- **The coins card overflowed at 390px.** A five-denomination purse plus Add, Spend and Send is
  wider than 358px of content. The card now wraps below `md` and stays one row from `md` up.
- **`← All parties` was an 18px target.** Now `h-11` below `md`.
- **The dialog close button was 28px, and the sheet's was 32px.** Both are now 44px below `md`.
  The dialog change is in `ui/dialog.tsx`, so it also enlarges the close button on the party-list
  dialogs — see *Scope note*.
- **`ActorNamePrompt` was still on default sizes.** Its input and button now take `touch`.
- **`MoveItemDialog`'s destination buttons were 32px.** Now `touch`.
- **The Edit dialog's rarity select still read `VeryRare`.** It now uses `ITEM_RARITY_LABELS`,
  because the spec asks for the label consistently everywhere a rarity appears in the view.
- **Truncating cells lacked `min-w-0`**, which lets a flex child overflow instead of ellipsing.

## Scope note

Two files outside the change's stated Impact were touched, both to satisfy the 44px requirement
from one shared primitive rather than from local overrides, which is what the design asks for:

- `web/src/components/ui/dialog.tsx` — close button 44px below `md`. This is shared, so the
  create-party and join-party dialogs get the larger target too.
- `web/src/components/party/actor-name-prompt.tsx` — `touch` sizes. It is part of the party view
  and its controls are covered by the touch-target requirement.

## Settled later, in a browser

Docker came up, and the three *needs a live check* rows above were measured rather than argued.
`web/e2e/party-layout.spec.ts` now holds each one as an assertion, run in both the `desktop` and
`phone` projects:

- **No sideways scrolling** — holds. `scrollWidth <= clientWidth` with a 56-character item name,
  on the inventory tab, with a row expanded, and on the history tab.
- **The eight-character picker** — holds. The trigger's box is unchanged between a party of one
  holder and a party of nine, nothing scrolls sideways, and every holder stays reachable.
- **Rarity contrast** — holds. All five coloured rarities clear 4.5:1 against the background they
  are composited onto. The walk's calculation was right, but it was a calculation; this measures
  the painted colours, which is what the `oklch()` tokens and the `color-mix()` tag backgrounds
  actually resolve to.
- **Touch targets** — **did not hold, now fixed.** The Inventory and History tabs measured 37px at
  390px. `TabsList` carried `h-11`, but the tap target is the trigger, and the list's 3px padding
  and the trigger's 1px inset came off that. The triggers now carry the height below `md` and the
  list grows to fit. Everything else in the view and in all seven dialogs and sheets measures 44px
  or more. The Equipped checkbox is measured by its `::after` hit area, for the reason in the
  table above.

## Still not verified

Gestures on real hardware, which no headless run settles: the drawer's swipe-to-dismiss and
backdrop press, the popover's outside-press and Escape, and the software keyboard inside the Add
item sheet.

One bug was found in that last area after this walk: `AddItemDialog` wrapped
`SheetVirtualKeyboardProvider` around `<Sheet>` rather than inside it, so the provider had no
`Drawer.Root` above it and the whole page threw at any width below 768px. That is exactly the
class of defect a source walk cannot catch, and it is why the suite now runs at both widths.
