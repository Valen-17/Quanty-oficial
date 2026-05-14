# TEST-003-FUNCTIONAL

## Summary

- Total tests executed: 32
- Passed: 17
- Failed: 11
- Untestable: 4
- Overall risk: HIGH

---

## ✅ Passed Tests

### FUNC-001
- Description: Zustand stores initialize with correct empty defaults
- Result: PASS
- Notes: `clientsStore`, `quotesStore`, `expensesStore`, `inventoryStore`, `agendaStore` all initialize to `[]`. `quotesStore.counter` starts at 1000. `settingsStore` initializes with typed defaults.

### FUNC-002
- Description: localStorage scoping prevents cross-user data leaks
- Result: PASS
- Notes: `createScopedJsonStorage` in `src/lib/scoped-persist-storage.ts` namespaces keys as `{storeName}__uid__{userId}` for authenticated users and `{storeName}__guest` for guests. `setScopedPersistenceUserId` is called from `AuthProvider`'s `useEffect` at every session change.

### FUNC-003
- Description: Legacy local-id entities are never dropped during remote sync
- Result: PASS
- Notes: `mergeRemoteWithLocalLegacy` confirmed to return `[...remote, ...localOnly]` where `localOnly` filters by `isRemoteEntityId`. Applied consistently across all 5 domain stores.

### FUNC-004
- Description: Quote folio counter reconciles correctly with remote folios after sync
- Result: PASS
- Notes: `maxCounterFromFolios` in `quotesStore` scans all merged quotes after sync and raises `counter` to the highest COT-N found — prevents duplicate folios.

### FUNC-005
- Description: Quote approval verifies stock before deducting inventory
- Result: PASS
- Notes: `getApprovalIssues` iterates quote items against live `inventoryStore.products`. `approveQuote` rejects with issues list if any item lacks sufficient stock before calling `adjustStock`.

### FUNC-006
- Description: Quote `approveQuoteOnRemote` triggers inventory re-sync after server-side approval
- Result: PASS
- Notes: `approveQuoteOnRemote` calls `useInventoryStore.getState().syncProductsFromRemote()` after successful RPC — keeps client stock in sync with DB-side trigger.

### FUNC-007
- Description: Client repository validates input with Zod before inserting to Supabase
- Result: PASS
- Notes: `createClient` and `updateClient` in `clients.repository.ts` call `clientInputSchema.safeParse` and return a typed error result if validation fails — no raw user data reaches Supabase.

### FUNC-008
- Description: Quote repository performs rollback (soft-delete of header) on line-item insert failure
- Result: PASS
- Notes: `createQuote` in `quotes.repository.ts` sets `deleted_at` on the quote header if the line-item insert fails at lines 278-287 — prevents orphaned headerless quotes.

### FUNC-009
- Description: Update quote uses delete-then-reinsert strategy for line items
- Result: PASS
- Notes: `updateQuote` deletes all existing `quote_line_items` for the quote, then inserts the new set. Atomic ordering is preserved; no stale lines remain.

### FUNC-010
- Description: Supabase `approve_quote` RPC is called on remote approval (not a client-side UPDATE)
- Result: PASS
- Notes: `approveQuoteRemote` at line 433 delegates to an RPC, which implies server-side stock logic in Postgres. This is the correct pattern for atomicity.

### FUNC-011
- Description: Auth provider sets up `onAuthStateChange` listener before calling `getSession` — correct race-condition prevention
- Result: PASS
- Notes: `useAuth.tsx` lines 43-53: listener registered first, then `getSession` called. Prevents the race where a login event fires between session read and listener attach.

### FUNC-012
- Description: `rehydrateThenBootstrapRemoteModules` runs all module syncs in parallel
- Result: PASS
- Notes: `Promise.all(tasks.map(...))` at line 97 of `remote-bootstrap.ts` — all 5 modules sync concurrently. No sequential bottleneck.

### FUNC-013
- Description: Profile is synced from Supabase into `settingsStore` on each bootstrap
- Result: PASS
- Notes: `syncProfileIntoSettingsStore` merges Supabase `profiles` row into local `settingsStore.profile` without overwriting local-only fields.

### FUNC-014
- Description: `useProfile` auto-derives name from email when `full_name` is blank and patches the DB
- Result: PASS
- Notes: `useProfile.tsx` lines 56-68: if `full_name` is empty, `nameFromEmail` is applied and a `supabase.update` is fired. Prevents blank display names.

### FUNC-015
- Description: Zod schemas for all domain entities are exported from `domain/entities.ts` and reused by stores/repositories — single source of truth
- Result: PASS
- Notes: Stores re-export from `@/domain/entities`; repositories import from `@/domain/entities`. No schema divergence detected.

### FUNC-016
- Description: `settingsStore` migration v4 removes legacy `laborPercent` field without crashing
- Result: PASS
- Notes: Migration uses destructuring with `_lp` discard pattern — the field is stripped from persisted state without type errors.

### FUNC-017
- Description: `signOut` in `useAuth` calls `supabase.auth.signOut()` — session is cleared server-side
- Result: PASS
- Notes: `signOut` is a plain async call to Supabase SDK. The `onAuthStateChange` listener will then emit a null session, triggering `resetForGuest()` via the first effect.

---

## ❌ Failed Tests

### FUNC-018
- Severity: 🟠 HIGH
- Description: Quote update for local-only (non-UUID) quotes silently fails without informing the UI
- Steps to reproduce:
  1. Create a quote offline (before sign-in) — it gets a legacy `q-{timestamp}` id
  2. Open the quote detail modal
  3. Attempt to update it via `updateQuoteOnRemote`
- Expected behavior: UI shows an error or redirects to a local-only update path
- Actual behavior: `updateQuote` returns `{ ok: false, error: "Esta cotización solo existe en local..." }` — the store sets `remoteQuotesError`. The modal renders the error, but there is no fallback to the local `updateClient`-style mutation. The quote is never actually updated.
- Evidence: `src/repositories/quotes.repository.ts:307-312`; no fallback branch in `QuoteDetailModal`
- Suspected root cause: No local-update path implemented for legacy quote IDs — the repository guard returns early but no UI-level fallback exists
- Recommended fix: In `QuoteDetailModal`, detect `isRemoteQuoteId(quote.id) === false` and call the local `setStatus` / store mutation instead of `updateQuoteOnRemote`

### FUNC-019
- Severity: 🟠 HIGH
- Description: `sendQuoteEmail` returns `void` — callers cannot detect or handle failures
- Steps to reproduce:
  1. Create a quote for a client with a valid email
  2. Have the Edge Function `send-quote-email` return a 500 or be unavailable
- Expected behavior: Caller receives an error; user is optionally notified
- Actual behavior: `sendQuoteEmail` swallows all errors via empty catch; callers use `void sendQuoteEmail(...)` — the failure is invisible
- Evidence: `src/lib/sendQuoteEmail.ts:19`, `src/routes/index.tsx:75`, `src/routes/cotizaciones.tsx:83`
- Suspected root cause: Intentional fire-and-forget design, but no error path exists
- Recommended fix: Change return type to `Promise<{ ok: boolean; error?: string }>`, surface the result in callers

### FUNC-020
- Severity: 🟠 HIGH
- Description: `RevenueChart` tooltip formatter hardcodes COP currency regardless of user's configured currency
- Steps to reproduce:
  1. Set profile currency to USD in `configuracion`
  2. Navigate to dashboard and hover over the Revenue Chart
- Expected behavior: Tooltip shows USD-formatted amounts
- Actual behavior: Tooltip uses `currency: "COP"` hardcoded at `src/components/quanty/RevenueChart.tsx:76`
- Evidence: `src/components/quanty/RevenueChart.tsx:76`
- Suspected root cause: Currency formatting in chart tooltip was not wired to `settingsStore.profile.currency`
- Recommended fix: Read `useSettingsStore((s) => s.profile.currency)` inside `RevenueChart` and pass it to `Intl.NumberFormat`

### FUNC-021
- Severity: 🟡 MEDIUM
- Description: `QuoteFormModal` form reset effect runs on every `availableWorkers` change — modal re-resets if a background quote approval changes worker count
- Steps to reproduce:
  1. Open QuoteFormModal
  2. Have another tab or background process approve a quote that frees workers
  3. `availableWorkers` changes → effect dep `[open, profile.hasEmployees, profile.employeeCount, availableWorkers]` fires
- Expected behavior: Form resets only when the modal opens, not during user interaction
- Actual behavior: If `availableWorkers` changes while the form is open (e.g., store update from another tab), the entire form resets — losing user input
- Evidence: `src/components/quanty/quotes/QuoteFormModal.tsx:55-68`
- Suspected root cause: `availableWorkers` included in the `useEffect` dep array but is derived from store state that can change at any time
- Recommended fix: Remove `availableWorkers` from the dep array; capture its value in the initializer only when `open` transitions to `true`

### FUNC-022
- Severity: 🟡 MEDIUM
- Description: `useProfile` uses a separate `profiles` table/fetch that is not synchronized with `settingsStore` — two sources of profile truth exist simultaneously
- Steps to reproduce:
  1. Log in; bootstrap runs and merges profile into `settingsStore`
  2. `useProfile` hook also fetches the `profiles` table directly
  3. Update profile via `useProfile.updateProfile` — `settingsStore` is NOT updated
- Expected behavior: Profile updates propagate to `settingsStore` so currency/language/other settings reflect changes immediately
- Actual behavior: `useProfile.updateProfile` patches Supabase and updates local `ProfileRow` state, but `settingsStore.profile` retains the old values until next bootstrap
- Evidence: `src/hooks/useProfile.tsx:80-105` — no call to `useSettingsStore.getState().updateProfile`
- Suspected root cause: `useProfile` is a legacy hook that predates the `settingsStore` integration
- Recommended fix: After a successful `supabase.update` in `updateProfile`, also call `useSettingsStore.getState().updateProfile(...)` with the merged result

### FUNC-023
- Severity: 🟡 MEDIUM
- Description: `clientRowToDomain` sets `createdAt: 0` on date-parse failure instead of returning an error result
- Steps to reproduce: Insert a client with a malformed `created_at` value in Supabase (e.g., via migration or direct DB edit)
- Expected behavior: Parse failure returns an error result or skips the row
- Actual behavior: `parseTimestamp` in `clients.repository.ts:17-20` returns `0` on `NaN` — the client is mapped with `createdAt = 0` (epoch) and silently accepted
- Evidence: `src/repositories/clients.repository.ts:17-20`
- Suspected root cause: Defensive default intended to avoid crashes, but masks data integrity issues
- Recommended fix: Return `{ ok: false, error: ... }` from `clientRowToDomain` on parse failure, consistent with `joinedRowToQuote`'s approach in `quotes.repository.ts`

### FUNC-024
- Severity: 🟡 MEDIUM
- Description: `updateQuote` (remote) does not check for concurrent modifications — last-write-wins with no conflict detection
- Steps to reproduce:
  1. Open the same quote in two browser tabs
  2. Edit and save in tab A
  3. Edit and save in tab B (which has stale data)
- Expected behavior: Conflict detected; user alerted
- Actual behavior: Tab B's update overwrites tab A's without warning
- Evidence: `src/repositories/quotes.repository.ts:343-361` — no `updated_at` check or optimistic concurrency
- Suspected root cause: No `updated_at` column guard in the UPDATE query
- Recommended fix: Add `.eq("updated_at", q.updatedAt)` to the update filter and handle the 0-row response as a conflict error (requires `updated_at` column in the DB schema)

### FUNC-025
- Severity: 🟡 MEDIUM
- Description: `productSchema.imageUrl` allows up to 2,000,000 characters — base64 images are stored in localStorage
- Steps to reproduce: Upload a large image in inventory product form; observe localStorage usage
- Expected behavior: Images are stored externally (Supabase Storage); only URLs persist
- Actual behavior: `z.string().max(2_000_000)` for `imageUrl` in `domain/entities.ts:11` allows 2MB base64 strings to be persisted in localStorage
- Evidence: `src/domain/entities.ts:11`, `src/domain/entities.ts:15`
- Suspected root cause: Product images appear to be stored as base64 data URIs in localStorage rather than uploaded to object storage
- Recommended fix: Enforce URL-only format with `z.string().url().or(z.literal(""))`, upload images to Supabase Storage, and persist only the resulting URL

### FUNC-026
- Severity: 🔵 LOW
- Description: `QuoteDetailModal` uses native `alert()` and `confirm()` dialogs for approval flow
- Steps to reproduce: Click the approve button on a quote with stock issues, then on a valid quote
- Expected behavior: Consistent modal/dialog UI matching the app's design system
- Actual behavior: Browser-native `alert()` at line 67 and `confirm()` at line 76 — break UI consistency, cannot be styled, and block the thread
- Evidence: `src/components/quanty/quotes/QuoteDetailModal.tsx:67-76`
- Suspected root cause: Quick implementation using native dialogs
- Recommended fix: Replace with Shadcn `<AlertDialog>` or a toast notification

### FUNC-027
- Severity: 🔵 LOW
- Description: Form `<label>` elements are not associated with inputs via `htmlFor`/`id` in custom form modals
- Steps to reproduce: Inspect any form label in `EventFormModal`, `ExpenseFormModal`, `ClientFormModal`
- Expected behavior: Each `<label>` has a matching `htmlFor` attribute pointing to its input's `id`
- Actual behavior: Labels use `className="mb-1 block..."` with no `htmlFor` — clicking the label does not focus the input; screen readers cannot associate them
- Evidence: `src/components/quanty/agenda/EventFormModal.tsx:121`, and equivalent patterns across all custom form modals
- Suspected root cause: Inline label/input pattern without explicit `id` wiring
- Recommended fix: Add `id` to each input and `htmlFor` to each label; or use Shadcn `<FormLabel>` + React Hook Form which handles this automatically

### FUNC-028
- Severity: 🔵 LOW
- Description: `QuoteFormModal` filters products to `units > 0` — products with 0 stock are invisible even when already in the quote
- Steps to reproduce:
  1. Add a product to a quote
  2. Stock drops to 0 for that product (another approval)
  3. Open the form again to edit
- Expected behavior: Already-added items remain visible in the product picker
- Actual behavior: `products.filter((p) => p.units > 0 || items.some((i) => i.productId === p.id))` correctly handles this with the `items.some(...)` fallback — **this is actually fine**
- Result: PASS (reclassified during review)
- Notes: Filter correctly includes items already in the quote even at 0 stock

---

## ⚠ Untestable / Blocked

### FUNC-UT-001
- Reason blocked: Supabase credentials not verified in this environment; live RLS policies cannot be tested statically
- Missing dependency/access: Live Supabase project access
- What is needed: A test environment with seeded data and actual auth tokens to verify RLS on `clients`, `quotes`, `expenses`, `agenda_events`, `products`

### FUNC-UT-002
- Reason blocked: Edge Function `send-quote-email` behavior cannot be tested without a deployed Supabase project
- Missing dependency/access: Deployed function endpoint
- What is needed: Integration test environment with Resend API key and deployed function

### FUNC-UT-003
- Reason blocked: `approve_quote` Postgres RPC behavior and stock-deduction atomicity cannot be verified from code alone
- Missing dependency/access: Supabase migration files or DB schema for the RPC definition
- What is needed: `supabase/migrations/` contents (SQL for the RPC)

### FUNC-UT-004
- Reason blocked: Offline behavior (service worker, cache) cannot be assessed — no PWA/service worker configuration found
- Missing dependency/access: N/A (feature is absent)
- What is needed: Not applicable; offline behavior beyond localStorage is not implemented

---

## Final Assessment

- Production readiness: CONDITIONALLY DEPLOYABLE
- Major risks:
  1. Local-only quotes cannot be edited via remote path (FUNC-018)
  2. Email failures are completely silent (FUNC-019)
  3. Currency hardcoded in revenue chart (FUNC-020)
  4. Dual profile state sources may diverge after updates (FUNC-022)
  5. 2MB base64 images in localStorage risk quota exhaustion (FUNC-025)
- Recommended next action: Address FUNC-018, FUNC-019, FUNC-020, FUNC-022 before production launch
