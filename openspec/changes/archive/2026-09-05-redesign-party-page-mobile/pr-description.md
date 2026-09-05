# Redesign the party page mobile-first

Reworks `/parties/[id]` around the phone: the overflowing holder `TabsList` becomes a single
picker button, the page splits into **Inventory** and **History** tabs, and the item table becomes
a flat list of expandable rows. No endpoint, contract, audit message or database column is touched.

See `openspec/changes/redesign-party-page-mobile/` for the proposal, specs, design and tasks.

## Routing: how this Next version wants search params read and replaced

Per `web/AGENTS.md`, this was checked against the bundled docs for the installed Next
(**16.2.9**) rather than from memory —
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
`.../02-guides/preserving-ui-state.md`, and
`.../03-api-reference/04-functions/use-search-params.md`.

**Reading.** `useSearchParams()` from `next/navigation` is a Client Component hook and is not
supported in Server Components. Reading it from a component that could be prerendered forces the
client tree up to the nearest `<Suspense>` boundary to be client-rendered, and a production build
of such a page fails with *Missing Suspense boundary with useSearchParams* if no boundary exists.
`app/parties/[id]/page.tsx` is a single `"use client"` file, so the `?tab=` read lives in a small
`PartyTabs` component that the page wraps in its own `<Suspense>`. The boundary is what matters,
not a file split, so `PartyTabs` stays in `page.tsx`.

**Replacing.** `04-linking-and-navigating.md` documents `window.history.replaceState` as
integrating with the Next router and staying in sync with `usePathname` / `useSearchParams`. It
replaces the current history entry, so the browser Back button leaves the party instead of
stepping back through tab changes, and it updates the URL client-side without a scroll or a
server round trip. That is what tab switching uses. The documented alternative,
`router.replace('?', { scroll: false })` from `preserving-ui-state.md`, re-renders the route on
the server on every toggle, which is more work than a tab switch needs.

**Not applicable here.** `preserving-ui-state.md` describes `<Activity>` route preservation, which
the guide states assumes `cacheComponents: true`. `web/next.config.ts` does not enable it, so
tab and dialog state is not preserved across navigations and needs no reset handling.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013A1fNNrMGJU9pbaPMvefvZ
