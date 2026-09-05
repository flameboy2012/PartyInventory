## Context

See `proposal.md` — Why. Constraints that shape the approach:

- **The design handoff is a reference, not code.** `Party inventory mobile redesign.zip` contains static HTML prototypes with literal `oklch()` values, because the prototypes have no access to the app's tokens. Every one of those literals maps to an existing variable in `web/src/app/globals.css`; the handoff's token table was checked against that file and is accurate (`--radius-xl` = `0.625rem × 1.4` = 14px, `--radius-4xl` = `× 2.6` = 26px). Build against the tokens, not the literals.
- **The handoff's prototypes contain fictional data.** `4a` shows a history entry reading "Sir Kael equipped Shield of Faith". No such audit action exists; the real record is `Edited Shield of Faith (equipped)` (`api/PartyInventory.Api/Endpoints/ItemEndpoints.cs:263-275`). Copy in the prototypes is illustrative and must not be treated as a string to reproduce.
- **`@base-ui/react` already ships the primitives this needs.** `web/node_modules/@base-ui/react/` exposes `drawer` (with `swipe-area` and `virtual-keyboard-provider`) and `popover` as subpath exports. `web/src/components/ui/` wraps only what has been needed so far, so the wrappers are missing, not the primitives. No new dependency.
- **`web/e2e/audit-trail.spec.ts` drives this exact page.** It asserts on audit `detail` strings verbatim and on the actor's name appearing in the same feed entry. That constrains how a history entry is composed, not just how it looks.
- **`web/AGENTS.md` applies.** This Next.js version differs from training data; read `web/node_modules/next/dist/docs/` before writing routing or search-param code. Relevant files are `app/getting-started/04-linking-and-navigating.md` and `app/guides/preserving-ui-state.md`.

## Goals / Non-Goals

**Goals:**

- One rendering path per element across breakpoints. Where a phone and a desktop differ, they differ by CSS or by one swapped primitive, never by two parallel trees rendering the same content.
- Every dialog in the party view reaches 44px touch targets from one change to the shared primitives, not five local overrides.
- The item list and history feed are shaped so that the fields still waiting on an API change — item provenance, server-side filtering, a rarity tag on audit entries — drop in without re-laying anything out.

**Non-Goals:**

- **Anything outside `web/`.** No endpoint, contract, audit message, migration or domain type changes. The audit `detail` strings the feed renders are the server's wording and stay exactly as they are; the feed is redesigned around them rather than asking them to change.
- **Item charges.** Not a deferred piece of this design — a separate feature with unanswered product questions. Nothing here reserves space for it or anticipates its shape.
- Dark mode. Nothing in the app toggles `.dark` today and no theme switcher exists. Rarity tokens get `.dark` values because they sit next to every other token pair in `globals.css` and omitting them would be the odd case, but the dark rendering is not verified by this change.
- Animation polish beyond what the drawer primitive provides.
- Changing any API call, request shape, or SWR key.

## Decisions

### Bottom sheets use `@base-ui/react/drawer`, not a hand-positioned dialog

The handoff describes sheets in terms of a fixed-bottom popup with a grab handle. Building that on `DialogPrimitive.Popup` means re-implementing drag-to-dismiss, scroll locking, and the keyboard-avoidance behaviour that matters most on the device this redesign targets — a phone opening the Add item sheet with six fields and a software keyboard.

`@base-ui/react/drawer` provides `Root`, `Portal`, `Backdrop`, `Popup`, `Viewport`, `SwipeArea`, `Title`, `Description`, `Close`, and `VirtualKeyboardProvider`. Wrap it as `web/src/components/ui/sheet.tsx` in the same style as the existing `dialog.tsx` wrapper — thin, `data-slot` attributes, `cn()` merging — so it matches the house pattern.

*Alternative considered:* extend `dialog.tsx` with a `variant="sheet"`. Rejected: the two have different primitives underneath and different part trees, so a shared wrapper would be a switch statement, not a variant.

### One responsive component per surface, phone-first

Three surfaces change shape between breakpoints: the holder picker (sheet ↔ popover), Add item (sheet ↔ dialog), and the FAB (floating button ↔ header button).

The FAB is CSS only — one button element, `fixed` below `md`, static in the header at `md` and up.

The other two swap primitives, which needs JavaScript. Rendering both trees and hiding one with CSS would put two focus traps and two copies of the form in the DOM, so a single tree picks its primitive from a `useMediaQuery("(min-width: 768px)")` hook in `web/src/lib/use-media-query.ts`, built on `matchMedia`.

`@base-ui/react/unstable-use-media-query` exists and does this, but its export name declares it unstable; a six-line local hook is cheaper than adopting that. The hook SHALL return the phone value during SSR and first paint, so the primary target renders correctly without a flash and the desktop pays the reconciliation instead.

*Alternative considered:* two separate components per surface, chosen by the page. Rejected: duplicates the holder list and the Add item form, which is exactly the drift the handoff is trying to remove.

### Desktop keeps the anchored popover

`@base-ui/react/popover` is available, so the desktop holder picker is anchored under its trigger as drawn, rather than being a centred dialog. This costs one more `ui/` wrapper (`popover.tsx`) and keeps the desktop behaviour the handoff specifies. The holder list itself is one component rendered inside whichever container is active.

### Touch sizing is a variant on the shared primitives

`Button` already uses `cva` with a `size` variant, so it gains `touch: "h-11 md:h-8 …"` alongside the existing sizes.

`Input` is a plain wrapper with no variants (`web/src/components/ui/input.tsx`). It gains a `cva` with the same two sizes. **Its variant prop cannot be named `size`**: `size` is a native `<input>` attribute typed as `number` in `React.ComponentProps<"input">`, so the props type must be `Omit<React.ComponentProps<"input">, "size">` before a string-valued `size` variant is declared. Doing this once in the primitive is why all five dialogs can adopt it by adding one prop.

`SelectTrigger` and `Checkbox` need the same treatment for the Add item and Edit item dialogs to reach 44px throughout.

`transfer-coins-dialog.tsx:100` uses a raw `<select>` rather than the `Select` primitive. It stays a native `<select>` — `web/e2e/audit-trail.spec.ts:95` drives it with Playwright's `selectOption`, which only works on native selects. It gets its height from a class, not from the variant.

*Alternative considered:* override to `h-11` inside `add-item-dialog.tsx` only, as the handoff literally says. Rejected in review: it leaves one phone-sized dialog and four desktop-sized ones in the same app.

### A history entry leads with the change, not the actor

The prototype renders `**Zorina** added Wand of Web to the party stash`. The server writes `detail` as a complete capitalised sentence — `Added {item} to {holder}` (`ItemEndpoints.cs:112`), `Moved {item} from {a} to {b}` (`:159`), `Removed {item} ×2` (`:193`) — so prefixing it with the actor renders "Zorina Added Wand of Web to the party stash".

Two ways out: lowercase the first letter client-side, or reorder. Lowercasing means the UI rewrites the audit record it is displaying, and `web/e2e/audit-trail.spec.ts:105-117` asserts those strings verbatim. So reorder:

```
+------------------------------------------+
| (Z)  Added Wand of Web to the party stash|
|      Zorina - 12 minutes ago             |
+------------------------------------------+
```

The avatar carries the actor's initials as drawn, the detail stays verbatim, and both the detail assertion and the `toContainText("Scott")` assertion keep passing on the same list item.

### Audit categories are derived client-side from `action`

`AuditAction` has twelve values and they partition cleanly, so no server change is needed to categorise:

| Filter | `AuditAction` values |
|---|---|
| Items | `ItemAdded`, `ItemEdited`, `ItemMoved`, `ItemDeleted` |
| Coins | `PartyCoinsSet`, `PartyCoinsSpent`, `CoinsTransferred`, `CharacterCoinsSet`, `CharacterCoinsSpent` |
| Characters | `CharacterCreated`, `CharacterEdited`, `CharacterDeleted` |

The map lives beside the feed as an exhaustive `Record<AuditAction, Category>`, so adding a thirteenth action to the API becomes a TypeScript error here rather than an entry that silently disappears from every filter.

What the client cannot do is filter the party's whole history — it holds one page of 50 plus whatever "Load older" has fetched. Rather than imply otherwise, the feed states the window: `8 of 50 loaded changes`. If a server query parameter is added later, that line becomes `8 changes` and nothing else moves.

Filtering by holder, which the `4a` artboard's caption mentions, is not possible at all: an audit entry carries `actorName` as free text and no actor identifier. The README's own prose specifies category filters; that is what gets built.

### Tab state lives in the URL as `?tab=`

`inventory` is the default and is represented by the absence of the parameter, so the common URL stays clean and a party link is unchanged from today. `?tab=history` selects history; any other value falls back to inventory rather than erroring.

Switching tabs replaces the history entry rather than pushing, so the browser back button leaves the party instead of stepping through tab changes, and does not scroll. Read `web/node_modules/next/dist/docs/app/getting-started/04-linking-and-navigating.md` before writing this — `useSearchParams` has a Suspense requirement in this version that differs across releases.

Holder selection stays in component state and out of the URL. It is a per-player reading position, not something worth sharing, and putting it in the URL would make the shared link depend on characters the recipient may not have loaded.

### Item value is treated as per-unit

`Item.ValueGp` is documented as "Cost in gold pieces (gp)" (`api/PartyInventory.Api/Domain/Item.cs:19`) without stating whether a stack's value is per item or in total. Today's table renders the bare number with no label, so the ambiguity is invisible.

This change reads it as per-unit and labels it `50 gp each` when quantity exceeds one, matching the handoff. The same reading gives the holder summary its total weight as `Σ weight × quantity`. If that reading is wrong the displayed meaning changes, so the assumption is recorded here. Nothing under `api/` is edited to confirm it — that includes the domain comment, which is worth tightening whenever someone next has reason to touch that file.

### The FAB is `fixed`, and the page keeps document scroll

The handoff specifies `position: absolute; bottom: 22px` inside a phone frame where "the item list scrolls". In a real page with document scroll, `absolute` means the FAB scrolls away.

Rather than introduce an inner scroll container — which breaks pull-to-refresh, momentum scrolling and the address-bar collapse on mobile browsers — the FAB is `position: fixed` and the item list carries bottom padding so its last row clears it. The header scrolls normally.

### Clipboard has a fallback

`navigator.clipboard` requires a secure context. Players commonly reach this app over plain HTTP on a LAN, where the API is `undefined` and a naive call throws on exactly the devices this redesign is for.

The copy control feature-detects. Where the clipboard is unavailable it does not claim success; it selects the code text so the player can copy it with a long-press. The share code is rendered as selectable text in both paths.

### Delete confirmation reuses the dialog primitive

An inline "press again to confirm" on the trash button would sit inside a row that can be closed by tapping elsewhere, so the confirmation could vanish mid-gesture. A dialog naming the item is unambiguous and matches how every other destructive-adjacent action in the app already asks. `@base-ui/react/alert-dialog` is available if the semantics are wanted.

### State stays local; SWR is untouched

Every new piece of state — `tab`, `activeHolder`, `expandedItemId`, `sort`, `historyFilter`, `confirmDeleteId`, `pickerOpen` — is component state at the lowest level that needs it. No store, no context. Server data keeps its existing SWR keys, and `usePartyRealtime` keeps revalidating the same four of them, so live sync needs no change.

## Risks / Trade-offs

- **Every party-page component changes at once** → No partial rollout is possible. Mitigation: the API, the generated types and every dialog's fields and submit path are untouched, so the blast radius stops at rendering. `web/e2e/audit-trail.spec.ts` exercises the full flow through the UI and is the regression gate; it is updated in this change, not after it.
- **The e2e spec must be rewritten and could be weakened while being repointed** → Its assertions are the only automated proof that the audit trail works end to end. Mitigation: change only the selectors, never the assertions. The `detail` strings, the actor-name check, the newest-first ordering check and the deleted-item check stay exactly as they are.
- **`useMediaQuery` returns the phone value during SSR** → Desktop users may see a frame of phone layout on first paint of the picker and Add item. Mitigation: accepted deliberately; the phone is the primary target and the affected surfaces are closed by default, so the mismatch is almost never visible.
- **Rarity colour is new information density** → Six colours at one chroma sitting near each other can read as noise on a long list. Mitigation: Common stays uncoloured, so an ordinary shelf of gear stays quiet, and rarity is always present as text, so colour is never the only channel.
- **`?tab=` behaviour differs across Next versions** → Getting this wrong produces a Suspense error or a scroll jump on every tab switch. Mitigation: read the bundled docs first, as `web/AGENTS.md` requires.
- **`8 of 50 loaded changes` is honest but not satisfying** → A player looking for last week's coin spend still has to press "Load older" repeatedly. Mitigation: accepted deliberately, since the alternative is a filter that quietly lies. A later server-side filter removes the limit, and the line is written so that it can simply disappear.
- **The `--rarity-*` tokens need `@theme inline` entries** → Declaring them only in `:root` gives Tailwind no `bg-rarity-rare` class and forces arbitrary values everywhere. Mitigation: add `--color-rarity-*` to the `@theme inline` block alongside the existing colour mappings.

## Migration Plan

No data migration, no API version, no feature flag. The change is deployed as one frontend release, and rollback is a redeploy of the previous frontend. Old and new frontends talk to the same unchanged API, so a rollback needs no coordination.

## Open Questions

- Whether `ValueGp` is per-unit or per-stack. The per-unit reading is implemented and labelled as such; confirming it later either changes nothing or changes one label and the weight total. It does not affect the specs, the approach, or the task breakdown.
- Whether the history's day headings should show a change count on phone as they do on desktop. Cosmetic, decidable while building.
