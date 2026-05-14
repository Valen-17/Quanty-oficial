# TEST-004-SECURITY

## Summary

- Total tests executed: 18
- Passed: 12
- Failed: 6
- Untestable: 2
- Overall risk: MEDIUM

---

## ✅ Passed Tests

### SEC-001
- Description: No hardcoded secrets or API keys in source code
- Result: PASS
- Notes: Grep for common secret patterns (`sk_`, `secret`, `apikey`, `password`, `Bearer `) across `src/` found no hardcoded credentials. All secrets are read from `import.meta.env` or `process.env`.

### SEC-002
- Description: `.env` is listed in `.gitignore`
- Result: PASS
- Notes: `.gitignore` confirmed to exclude `.env`. Secret env vars are not committed.

### SEC-003
- Description: Browser client uses only `VITE_` prefixed env vars — no server-side secrets exposed to client bundle
- Result: PASS
- Notes: `client.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only the anon/publishable key is bundled into the client — this is the expected Supabase pattern. The service role key is never referenced in `src/`.

### SEC-004
- Description: SSR auth middleware reads `process.env.SUPABASE_PUBLISHABLE_KEY` (non-VITE) — server secrets stay server-side
- Result: PASS
- Notes: `auth-middleware.ts` uses `process.env` only. The non-VITE vars are never injected into the client bundle by Vite.

### SEC-005
- Description: All repository write operations check `requireAuthUserId()` before touching Supabase
- Result: PASS
- Notes: `createClient`, `updateClient`, `softDeleteClient`, `createQuote`, `updateQuote`, `approveQuoteRemote`, `softDeleteQuote` all call `requireAuthUserId()` and return early on failure.

### SEC-006
- Description: Soft-delete operations filter by `is("deleted_at", null)` — prevents blind update of already-deleted rows
- Result: PASS
- Notes: `softDeleteClient` and `softDeleteQuote` use `.is("deleted_at", null)` in the WHERE clause before setting `deleted_at`. If the row is already deleted, `maybeSingle()` returns null and an error is returned to the caller.

### SEC-007
- Description: `clientId` is validated to be a real UUID before being written to Supabase FK column
- Result: PASS
- Notes: `createQuote` and `updateQuote` in quotes repository call `isRemoteClientId(p.clientId)` and pass `null` to the DB if it is a legacy local ID — prevents FK constraint errors and injection via malformed IDs.

### SEC-008
- Description: Input validation is applied before all database writes
- Result: PASS
- Notes: `createClient` validates via `clientInputSchema.safeParse`; `createQuote` validates via `createRemoteQuoteParamsSchema.safeParse`; `updateQuote` validates via `quoteSchema.safeParse`. Invalid data never reaches Supabase.

### SEC-009
- Description: SSR middleware validates JWT claims with `getClaims` — token integrity verified server-side
- Result: PASS
- Notes: `auth-middleware.ts:53` calls `supabase.auth.getClaims(token)` which verifies the JWT signature. Unsigned or tampered tokens are rejected with 401.

### SEC-010
- Description: `DOMPurify` (purify.es) is bundled — sanitization library available
- Result: PASS
- Notes: Build output includes `purify.es-CTpuD0bk.js` (22.44 kB). DOMPurify is present in the bundle.

### SEC-011
- Description: No `dangerouslySetInnerHTML` usage found in app-specific components
- Result: PASS
- Notes: Static search of `src/components/quanty/` and `src/routes/` found no `dangerouslySetInnerHTML`. User-supplied content is rendered as React text nodes.

### SEC-012
- Description: Quote line-item `product_id` is sanitized — non-UUID product IDs are coerced to the line-item row ID
- Result: PASS
- Notes: `lineRowToQuoteItem` at `quotes.repository.ts:82-85` checks `isRemoteProductId(row.product_id)` and falls back to `row.id` if invalid. Prevents injection via malformed product IDs from the DB.

---

## ❌ Failed Tests

### SEC-013
- Severity: 🟠 HIGH
- Description: `sendQuoteEmail` sends the entire `Quote` object (including all quote fields) to the Edge Function — potential over-exposure of internal data
- Steps to reproduce: Inspect the network request to `send-quote-email` when a quote email is triggered
- Expected behavior: Only the minimum necessary fields are sent (folio, total, client name, line items for display)
- Actual behavior: `body: { quote, clientEmail, businessName, currency, exchangeRate, eventType }` at `src/lib/sendQuoteEmail.ts:17` sends the full `Quote` object including `approvedAt`, `laborWorkers`, `laborHours`, `laborRate`, internal IDs
- Evidence: `src/lib/sendQuoteEmail.ts:17`
- Suspected root cause: Convenience — the full object was passed without filtering
- Recommended fix: Create a projection/DTO of only the fields needed for email rendering; strip internal fields before sending

### SEC-014
- Severity: 🟠 HIGH
- Description: `getQuotes` fetches ALL quotes for the authenticated user in a single query with no pagination — IDOR risk if RLS is misconfigured
- Steps to reproduce: Sign in and observe the network request to Supabase on `quotes` table
- Expected behavior: RLS policies on `quotes` ensure users only see their own rows
- Actual behavior: The query at `quotes.repository.ts:192-196` has no explicit `eq("user_id", auth.data)` filter — it relies entirely on Supabase RLS. If RLS is disabled or misconfigured on the `quotes` table, all rows would be returned.
- Evidence: `src/repositories/quotes.repository.ts:192-196`
- Suspected root cause: Intentional reliance on RLS (standard Supabase pattern), but there is no defense-in-depth filter
- Recommended fix: Add `.eq("user_id", auth.data)` as an explicit application-level filter in addition to RLS — defense in depth; safe and idempotent when RLS is also correct

### SEC-015
- Severity: 🟡 MEDIUM
- Description: Same defense-in-depth gap applies to `getClients`, `getExpenses`, and agenda sync queries — no explicit `user_id` filter in application code
- Steps to reproduce: Same as SEC-014 for the other repositories
- Expected behavior: Application code adds `user_id` filter as a second enforcement layer
- Actual behavior: `clients.repository.ts:67-71`, `expenses.repository.ts` — queries rely solely on RLS
- Evidence: `src/repositories/clients.repository.ts:67-71`
- Suspected root cause: Intentional RLS-only design
- Recommended fix: Add explicit `.eq("user_id", auth.data)` to all list queries; the overhead is negligible

### SEC-016
- Severity: 🟡 MEDIUM
- Description: `useProfile` fetches and updates the `profiles` table with no explicit `user_id` ownership guard in the application layer — relies solely on `.eq("id", user.id)` matching the auth UID
- Steps to reproduce: Inspect `useProfile.tsx:44-48` and `95-100`
- Expected behavior: RLS on `profiles` ensures only the owner can read/write their row
- Actual behavior: Application code uses `.eq("id", user.id)` which is correct and safe — however, if the `profiles` table RLS policy uses `auth.uid() = id`, this is double-enforced. If RLS is absent, `.eq("id", user.id)` is the only guard.
- Evidence: `src/hooks/useProfile.tsx:44-48`
- Suspected root cause: No RLS misconfiguration detected from code alone, but unverifiable without DB access
- Recommended fix: Verify `profiles` RLS: `USING (auth.uid() = id)` for SELECT and `WITH CHECK (auth.uid() = id)` for INSERT/UPDATE

### SEC-017
- Severity: 🟡 MEDIUM
- Description: `RevenueChart` tooltip `formatter` uses `value: any` type — bypasses type safety for chart data rendering
- Steps to reproduce: Review `src/components/quanty/RevenueChart.tsx:72`
- Expected behavior: `value` is typed as `number` consistent with the chart data series
- Actual behavior: `(value: any)` — ESLint flags this; the `any` allows arbitrary non-numeric values to flow into `Intl.NumberFormat`, which would produce `NaN` or throw
- Evidence: `src/components/quanty/RevenueChart.tsx:72`
- Suspected root cause: Recharts `formatter` prop types use broad generics
- Recommended fix: Type as `(value: number)` or `(value: unknown)` with a runtime guard: `if (typeof value !== "number") return ["—", ""]`

### SEC-018
- Severity: 🔵 LOW
- Description: No Content Security Policy (CSP) headers configured for the Cloudflare Workers deployment
- Steps to reproduce: Review `wrangler.jsonc` for CSP headers
- Expected behavior: `Content-Security-Policy` header restricts script/style sources
- Actual behavior: No CSP configuration found in `wrangler.jsonc` or the TanStack Start SSR shell
- Evidence: `src/routes/__root.tsx` — no `<meta http-equiv="Content-Security-Policy">` in the shell
- Suspected root cause: CSP was not implemented
- Recommended fix: Add CSP headers via Cloudflare Worker response headers or `wrangler.jsonc` `headers` rules. Minimum: `default-src 'self'; script-src 'self'; connect-src 'self' *.supabase.co fonts.googleapis.com`

---

## ⚠ Untestable / Blocked

### SEC-UT-001
- Reason blocked: RLS policies cannot be read from client code alone — requires DB access
- Missing dependency/access: Supabase project DB access (psql or Supabase Studio)
- What is needed: Verify that `clients`, `quotes`, `expenses`, `agenda_events`, `products`, `profiles` tables all have RLS enabled and correct `USING`/`WITH CHECK` policies

### SEC-UT-002
- Reason blocked: CORS configuration of the Supabase Edge Function cannot be assessed from source alone
- Missing dependency/access: Deployed Edge Function configuration
- What is needed: Review the Edge Function's CORS headers in `supabase/functions/send-quote-email/index.ts` response

---

## Final Assessment

- Production readiness: CONDITIONALLY DEPLOYABLE — no critical vulnerabilities found in client code; RLS reliance is intentional and standard for Supabase but unverified
- Major risks:
  1. Full quote object sent to Edge Function exposes internal fields (SEC-013)
  2. No defense-in-depth `user_id` filter on list queries (SEC-014, SEC-015)
  3. No CSP headers (SEC-018)
- Recommended next action: Add `user_id` application-level filters; scrub quote DTO before sending to Edge Function; configure CSP in Cloudflare
