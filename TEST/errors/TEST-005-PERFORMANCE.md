# TEST-005-PERFORMANCE

## Summary

- Total tests executed: 14
- Passed: 8
- Failed: 6
- Untestable: 2
- Overall risk: MEDIUM

---

## ✅ Passed Tests

### PERF-001
- Description: Dashboard KPI calculations are memoized with `useMemo`
- Result: PASS
- Notes: `recentQuotes`, `pendingCount`, `approvedTotal`, `quoteByStatus`, `financeEmpty` in `src/routes/index.tsx` are all wrapped in `useMemo`. Recomputation is dep-tracked.

### PERF-002
- Description: `RevenueChart` data series computation is memoized
- Result: PASS
- Notes: `useMemo(() => selectFinanceSeries(quotes, expenses), [quotes, expenses])` at `RevenueChart.tsx:18`. Heavy chart data aggregation runs only when underlying data changes.

### PERF-003
- Description: `QuoteFormModal` product filter and totals are memoized
- Result: PASS
- Notes: `filteredProducts` and `totals` both use `useMemo` at `QuoteFormModal.tsx:77-94`. Search and re-totaling do not run on unrelated state changes.

### PERF-004
- Description: Remote bootstrap runs all 5 module syncs in parallel
- Result: PASS
- Notes: `Promise.all(tasks.map(...))` in `remote-bootstrap.ts:97`. Startup sync is O(max(module_time)) not O(sum(module_time)).

### PERF-005
- Description: Product list in `QuoteFormModal` is capped at 8 results
- Result: PASS
- Notes: `.slice(0, 8)` at `QuoteFormModal.tsx:82` — product picker never renders more than 8 items regardless of inventory size.

### PERF-006
- Description: Quote PDF uses `html2canvas` + `jsPDF` which are lazy-split into separate chunks
- Result: PASS
- Notes: Build output shows `html2canvas-Diif3xj5.js` (199.56 kB) and `index.es-BcQFc5n-.js` (151.41 kB — likely jsPDF) as separate chunks, not inlined into main route bundles.

### PERF-007
- Description: Zustand store selectors in routes use per-field selectors to avoid unnecessary re-renders
- Result: PASS
- Notes: E.g. `useSettingsStore((s) => s.profile.currency)` and `useSettingsStore((s) => s.exchangeRate)` are separate subscriptions. Components only re-render when their specific slice changes.

### PERF-008
- Description: `selectors.ts` computes finance series and summaries via pure functions — reusable and cacheable
- Result: PASS
- Notes: `selectFinanceSeries`, `selectFinancialSummary`, `selectApprovedIncome`, `selectPendingQuotesCount`, `selectQuoteCountByStatus` are pure functions called from `useMemo` in consuming components.

---

## ❌ Failed Tests

### PERF-009
- Severity: 🟠 HIGH
- Description: `QuoteDetailModal` bundle is 459 kB (147 kB gzipped) — largest chunk in the build
- Steps to reproduce: Run `bun run build`; inspect `QuoteDetailModal-DRHu8xGj.js`
- Expected behavior: Modal bundle under 100 kB gzipped; PDF and email logic lazy-loaded on demand
- Actual behavior: `QuoteDetailModal-DRHu8xGj.js` is 459.38 kB / 147.15 kB gzipped. This chunk includes `html2canvas`, `jsPDF`, and related dependencies eagerly at modal load time.
- Evidence: Build output — `dist/client/assets/QuoteDetailModal-DRHu8xGj.js 459.38 kB │ gzip: 147.15 kB`
- Suspected root cause: `downloadQuotePdf` and its deps (`html2canvas`, `jsPDF`) are statically imported in `QuoteDetailModal.tsx` via `src/lib/quotePdf.ts`
- Recommended fix: Dynamically import `quotePdf.ts` inside the handler: `const { downloadQuotePdf } = await import("@/lib/quotePdf")` — this defers the 350+ kB PDF library until the user clicks Download

### PERF-010
- Severity: 🟠 HIGH
- Description: `useAuth` bundle is 344 kB (89 kB gzipped) — the Supabase client and auth logic are loaded eagerly on every page
- Steps to reproduce: Run `bun run build`; inspect `useAuth-DnPE3_fY.js`
- Expected behavior: Auth module should be lean; heavy Supabase SDK portions lazy-loaded
- Actual behavior: `useAuth-DnPE3_fY.js` is 344.45 kB / 89.61 kB gzipped. The Supabase JS client pulls in the entire SDK including Realtime
- Evidence: Build output — `useAuth-DnPE3_fY.js 344.45 kB │ gzip: 89.61 kB`
- Suspected root cause: `@supabase/supabase-js` includes the Realtime module by default; Realtime is not used in this application (no `supabase.channel()` calls found)
- Recommended fix: Import from `@supabase/supabase-js/dist/module/index-no-realtime` or configure `createClient` with `realtime: { transport: 'websocket' }` disabled; or use `@supabase/auth-js` + `@supabase/postgrest-js` separately

### PERF-011
- Severity: 🟡 MEDIUM
- Description: `updateQuote` in repository performs 4 sequential Supabase round-trips for a single update operation
- Steps to reproduce: Save an edited quote via `updateQuoteOnRemote`
- Expected behavior: Ideally 1-2 round-trips (update header + replace lines)
- Actual behavior: 4 sequential calls: (1) delete all line items, (2) update header, (3) insert new line items, (4) re-read quote with join. Each is a separate network round-trip.
- Evidence: `src/repositories/quotes.repository.ts:334-394`
- Suspected root cause: Read-after-write pattern to return the canonical server state; line-item strategy requires delete+reinsert
- Recommended fix: Consider a Postgres stored procedure (RPC) that handles the full update atomically and returns the joined row in a single call

### PERF-012
- Severity: 🟡 MEDIUM
- Description: `getApprovalIssues` is called on every render of `QuoteDetailModal` without memoization
- Steps to reproduce: Open QuoteDetailModal; trigger any state change (e.g., toggle `actionBusy`)
- Expected behavior: Stock check result is memoized until quote or inventory changes
- Actual behavior: `const stockProblems = getApprovalIssues(quote.id)` at line 62 is computed on every render. It iterates all quote items and the full product array each time.
- Evidence: `src/components/quanty/quotes/QuoteDetailModal.tsx:62`
- Suspected root cause: Missing `useMemo`
- Recommended fix: `const stockProblems = useMemo(() => getApprovalIssues(quote.id), [quote.id, getApprovalIssues])`

### PERF-013
- Severity: 🟡 MEDIUM
- Description: `usedWorkers` in `QuoteFormModal` iterates all non-rejected quotes on every render to sum labor workers
- Steps to reproduce: Open QuoteFormModal with a large number of quotes in store
- Expected behavior: Worker availability computed once per quotes array change
- Actual behavior: `quotes.filter(...).reduce(...)` inside `useMemo` is dep on `[quotes]` — this is actually correct. However, `availableWorkers` is derived from `usedWorkers` outside of `useMemo`, which means it re-runs on every render.
- Evidence: `src/components/quanty/quotes/QuoteFormModal.tsx:34-41`
- Suspected root cause: `availableWorkers` computed outside `useMemo`
- Recommended fix: Fold `availableWorkers` into the same `useMemo` block: `const { usedWorkers, availableWorkers } = useMemo(() => { const used = ...; return { usedWorkers: used, availableWorkers: Math.max(0, profile.employeeCount - used) }; }, [quotes, profile.employeeCount])`

### PERF-014
- Severity: 🔵 LOW
- Description: Google Fonts loaded with render-blocking `<link rel="stylesheet">` — no `font-display: swap` configured via the URL
- Steps to reproduce: Inspect the `<head>` rendered by `__root.tsx`
- Expected behavior: Font load uses `&display=swap` in the Google Fonts URL to avoid FOIT
- Actual behavior: Font URL `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap` — actually includes `display=swap`. PASS on this sub-point. However, `rel="preconnect"` hints are present but the stylesheet link is not `rel="preload"` — font files are discovered only after the stylesheet is parsed.
- Evidence: `src/routes/__root.tsx:50-55`
- Suspected root cause: Standard Google Fonts integration; minor LCP impact
- Recommended fix: Add `<link rel="preload" as="style">` for the font stylesheet, or self-host fonts to eliminate the third-party DNS lookup

---

## ⚠ Untestable / Blocked

### PERF-UT-001
- Reason blocked: Cloudflare Worker CPU/memory limits cannot be measured without deployment
- Missing dependency/access: Deployed worker endpoint
- What is needed: Wrangler preview or production deployment to measure worker invocation time and memory

### PERF-UT-002
- Reason blocked: localStorage quota usage with base64 images cannot be quantified without runtime data
- Missing dependency/access: Actual user data with product images
- What is needed: A seeded environment with products containing large base64 images

---

## Final Assessment

- Production readiness: CONDITIONALLY DEPLOYABLE — no performance blockers for small datasets; PDF bundle size is a real concern for mobile users
- Major risks:
  1. 459 kB QuoteDetailModal chunk degrades initial load for mobile (PERF-009)
  2. 344 kB auth chunk is heavy for a core module (PERF-010)
  3. 4 sequential round-trips on quote update (PERF-011)
- Recommended next action: Dynamic import for `quotePdf.ts` is a quick win that cuts the largest chunk significantly; investigate removing Supabase Realtime from the bundle
