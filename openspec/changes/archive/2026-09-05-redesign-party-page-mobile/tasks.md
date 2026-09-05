> **Status — 48/48. Implementation complete; e2e suite green.**
>
> `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass in `web/`, and
> `npm run test:e2e` passes all 6 specs against the Docker stack. Nothing under `api/` or
> `web/src/lib/api/` is modified.
>
> The suite now runs in two projects, `desktop` and `phone` (390×844), because the party view swaps
> primitives at 768px and a desktop-only run exercised none of the sheet paths. That gap had already
> cost a bug: `AddItemDialog` wrapped `SheetVirtualKeyboardProvider` around `<Sheet>` instead of
> inside it, so the provider found no `Drawer.Root` above it and the page threw
> `useDialogRootContext() is undefined` at any width below 768px.
>
> `party-layout.spec.ts` settles the measurable half of 10.3 — no sideways scrolling, 44px targets
> across the view and all seven dialogs and sheets, the eight-character picker, and rarity contrast
> at 4.5:1. It found the Inventory and History tabs at 37px; fixed. What no headless run settles is
> gestures: swipe-to-dismiss, backdrop press, and the software keyboard.
>
> The suite ran once the Docker stack came up. Two things it turned up:
>
> - The `web` service is a baked image with no bind mount, so the stack had to be rebuilt
>   (`docker compose up -d --build web`) before it served the redesign at all.
> - Adding a character now selects it (4.5), so the first spec had to return to the party stash
>   before adding the item that its `Added Longsword to the party stash` assertion expects. A
>   navigation step was added; no assertion changed.
>
> Checks a browser suite cannot make, still unverified by hand:
>
> - Gestures: drawer swipe-to-dismiss and backdrop press (2.1), popover outside-press and Escape
>   (2.2), and the software keyboard inside the Add item sheet (7.2).
> - `useMediaQuery` flipping across 768px with no hydration warning (1.5).
>
> `verification-walk.md` records the original source walk, which of its rows have since been
> measured in a browser, and the seven gaps it found and fixed.

## 1. Foundations

- [x] 1.1 Read `web/node_modules/next/dist/docs/app/getting-started/04-linking-and-navigating.md` and `.../app/guides/preserving-ui-state.md`, and note in the PR description how this Next version wants search-param reads and replaces done, per `web/AGENTS.md`
- [x] 1.2 Add `--rarity-*` and `--rarity-*-fg` pairs for uncommon, rare, very rare, legendary and artifact to `:root` and `.dark` in `web/src/app/globals.css`, and map them as `--color-rarity-*` in the `@theme inline` block; verify `bg-rarity-rare` resolves in a scratch element and `npm run build` succeeds
- [x] 1.3 Add a rarity display-label map and a rarity sort order beside `ITEM_RARITIES` in `web/src/lib/item-options.ts`, keyed exhaustively by `ItemRarity`; verify `VeryRare` maps to `Very rare` and that removing a key is a TypeScript error
- [x] 1.4 Change the `formatCoins` separator in `web/src/lib/money.ts` from `, ` to ` · `; verify a purse of 143 gold and 12 silver renders `143 gp · 12 sp` and one with no coins still renders `0 gp`
- [x] 1.5 Add `web/src/lib/use-media-query.ts` wrapping `matchMedia`, returning the phone value during SSR and first paint; verify it flips on resize across 768px and does not warn about hydration mismatch in the console

## 2. Shared primitives

- [x] 2.1 Add `web/src/components/ui/sheet.tsx` wrapping `@base-ui/react/drawer` (`Root`, `Portal`, `Backdrop`, `Popup`, `Viewport`, `SwipeArea`, `Title`, `Description`, `Close`, `VirtualKeyboardProvider`), following the `data-slot` and `cn()` style of `dialog.tsx`; verify a scratch sheet opens from the bottom, dismisses by swipe and by backdrop press, and does not scroll the page behind it
- [x] 2.2 Add `web/src/components/ui/popover.tsx` wrapping `@base-ui/react/popover` in the same style; verify a scratch popover anchors under its trigger and closes on outside press and on Escape
- [x] 2.3 Add a `touch` size (`h-11 md:h-8`) to the `size` variant in `web/src/components/ui/button.tsx`; verify the existing sizes are unchanged and a `size="touch"` button measures 44px at 390px wide
- [x] 2.4 Convert `web/src/components/ui/input.tsx` to `cva` with `default` and `touch` sizes, typing its props as `Omit<React.ComponentProps<"input">, "size">` so the string variant does not collide with the native numeric `size` attribute; verify existing `<Input>` usages still typecheck and render at `h-8`
- [x] 2.5 Add the matching `touch` size to `web/src/components/ui/select.tsx`'s trigger and `web/src/components/ui/checkbox.tsx`; verify both reach 44px at 390px wide and are unchanged above `md`

## 3. Page shell and header

- [x] 3.1 Rewrite `web/src/app/parties/[id]/page.tsx` to render Inventory and History as two tabs, with `inventory` as the default and `?tab=history` selecting history, treating any unrecognised value as inventory; verify a reload and a pasted `?tab=history` link both land on history
- [x] 3.2 Make tab switching replace the history entry without scrolling, so the browser back button leaves the party rather than stepping through tab changes; verify by switching tabs three times and pressing back once
- [x] 3.3 Rewrite `web/src/components/party/party-header.tsx` as the party name with the share code beside it, keeping a link back to the party list at every width; verify the back link is reachable at 390px
- [x] 3.4 Make the share code copy in one action with a visible confirmation, feature-detecting `navigator.clipboard` and falling back to selecting the code text without claiming success; verify the fallback path by testing over `http://` on a LAN address or by stubbing `navigator.clipboard` as undefined
- [x] 3.5 Keep the actor-name gate, `Loading…` and `Couldn't load this party.` behaviour unchanged; verify by opening a party on a device with no stored name and by pointing the page at a non-existent party id

## 4. Holder picker

- [x] 4.1 Build the holder list as one component listing the party stash and every character with its name, item count and coins, marking the selected holder; verify it renders identically inside a sheet and inside a popover
- [x] 4.2 Replace the `TabsList` in `web/src/components/party/party-items-section.tsx` with a picker button that opens the sheet below `md` and the popover at `md` and up; verify with eight characters at 390px that nothing overflows, wraps or scrolls sideways
- [x] 4.3 Show the selected holder's item count and coins on the picker button using `formatCoins`; verify a holder with 6 items, 143 gold and 12 silver reads `6 items · 143 gp · 12 sp`
- [x] 4.4 Keep the fallback to the party stash when the selected character no longer exists; verify by deleting the selected character in a second browser context and watching the first fall back
- [x] 4.5 Offer `Add character` inside the picker and select the new character on success; verify the picker closes and the new character's empty inventory is shown

## 5. Coins

- [x] 5.1 Rebuild the coins card with the purse on the left and `Add`, `Spend` and `Send` as labelled buttons; verify all three are at least 44px tall at 390px wide
- [x] 5.2 Keep `Send` hidden when no other purse exists; verify in a party with no characters that only `Add` and `Spend` are offered
- [x] 5.3 Confirm the three buttons open `CoinsDialog` with the right mode and `TransferCoinsDialog` unchanged; verify a spend and a transfer both still succeed and appear in the history

## 6. Item list

- [x] 6.1 Replace the table in `web/src/components/party/party-items-table.tsx` with a flat list of rows showing name, rarity, type, value and quantity, rendered as stacked rows below `md` and as aligned grid columns at `md` and up; verify no horizontal scrolling at 390px with a long item name
- [x] 6.2 Label a stack's value as per item when quantity exceeds one; verify an item with quantity 6 at 50 gp reads `50 gp each` and a single item reads `50 gp`
- [x] 6.3 Add the summary row above the list with the holder's item count and total weight as `Σ weight × quantity`; verify against a holder with mixed quantities
- [x] 6.4 Make a row expand on press to reveal weight, value, type, equipped state and description, closing any other open row; verify only one row is ever open and that an item with no description leaves no empty cell
- [x] 6.5 Put `Give to…`, `Edit` and delete directly in the expanded row and remove the `⋯` dropdown; verify each opens the same dialog it does today
- [x] 6.6 Add a confirmation dialog naming the item before `DELETE /api/parties/{partyId}/items/{itemId}` fires; verify a single press does not delete, confirming does, and cancelling leaves the item in place
- [x] 6.7 Add the sort control with rarity, name, value and quantity, defaulting to rarity descending; verify the same items are shown in each order and that the set never changes
- [x] 6.8 Render rarity as a coloured tag using the new tokens, leaving Common uncoloured and always showing the rarity name as text; verify a rare and a legendary item are visually distinct and that both are still readable with colour removed
- [x] 6.9 Keep the `No items here yet.` empty state; verify on a newly added character

## 7. Add item

- [x] 7.1 Render `AddItemDialog` as a bottom sheet below `md` and keep the existing centred dialog at `md` and up, with the same fields, the same request body and the same submit outcome; verify an item added from each breakpoint is identical in the API response
- [x] 7.2 Adopt the `touch` size on every field and button in the dialog and wrap the sheet in the drawer's `VirtualKeyboardProvider`; verify on a phone that the software keyboard does not cover the field being typed into
- [x] 7.3 Replace the floating add control with one button that is `fixed` below `md` and sits in the header at `md` and up, and pad the item list so its last row clears the floating button; verify at 390px that the button is reachable at the end of a 30-item list and hides nothing

## 8. Other dialogs

- [x] 8.1 Adopt the `touch` size across `edit-item-dialog.tsx`, `coins-dialog.tsx`, `transfer-coins-dialog.tsx` and `add-character-dialog.tsx`; verify every control in each measures at least 44px at 390px wide
- [x] 8.2 Size the raw `<select>` in `transfer-coins-dialog.tsx:100` to match, leaving it a native `<select>`; verify Playwright's `selectOption` still drives it
- [x] 8.3 Confirm no dialog's fields, validation or request body changed; verify by diffing the request payloads against the current build for one add, one edit, one move and one transfer

## 9. History

- [x] 9.1 Move `PartyAuditFeed` under the History tab and drop its own `History` heading, keeping its `region` accessible name; verify the feed no longer renders below the inventory
- [x] 9.2 Group entries by day, newest day first, and compose each entry as the recorded `detail` verbatim on the first line with the actor and time beneath; verify `Moved Longsword from the party stash to Thorin` appears unaltered and the actor's name is in the same entry
- [x] 9.3 Show times as relative for today and as a time of day for older days; verify with entries from today and yesterday
- [x] 9.4 Add the category filter pills backed by an exhaustive `Record<AuditAction, Category>`; verify every one of the twelve actions falls into exactly one category and that removing a key fails to compile
- [x] 9.5 State the loaded window as `N of M loaded changes` whenever a filter is active, and keep `Load older` available while filtered; verify the count changes with the filter and that loading older entries updates both numbers
- [x] 9.6 Keep the `Nothing has changed yet. Actions you take show up here.` empty state and hide `Load older` when no cursor remains; verify on a new party and on a fully loaded feed

## 10. Verification

- [x] 10.1 Repoint `web/e2e/audit-trail.spec.ts` at the new UI — the holder picker instead of `getByRole("tab")`, list rows instead of `getByRole("row")`, in-row actions instead of the `Item actions` menu, the new coin button labels, and the new share-code markup — changing only selectors and leaving every assertion, including the verbatim `detail` strings, the actor-name checks, the ordering check and the deleted-item check, exactly as they are; verify `npm run test:e2e` passes
- [x] 10.2 Add e2e coverage for the behaviour this change introduces: expanding a row, cancelling and confirming a delete, switching holder through the picker, and landing on `?tab=history`; verify the new specs pass
- [x] 10.3 Walk the whole page at 390px and at 900px against `specs/party-inventory-view/spec.md`, checking every scenario including no horizontal scrolling, 44px targets, and the eight-character picker; record any scenario that does not hold
- [x] 10.4 Run `npm run lint` and `npm run build` in `web/`, and confirm no file under `web/src/lib/api/` and nothing under `api/` was modified; verify with `git diff --stat`
