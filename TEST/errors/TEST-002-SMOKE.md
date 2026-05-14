# TEST-002-SMOKE

## Summary

- Total tests executed: 12
- Passed: 5
- Failed: 7
- Untestable: 0
- Overall risk: HIGH

---

## ✅ Passed Tests

### SMOKE-001
- Description: Production build completes without errors
- Result: PASS
- Notes: `bun run build` exits 0. Client and SSR bundles generated successfully. 2778 modules transformed.

### SMOKE-002
- Description: All declared routes resolve to file-based components
- Result: PASS
- Notes: Routes confirmed: `/`, `/auth`, `/agenda`, `/balance`, `/clientes`, `/configuracion`, `/cotizaciones`, `/inventario`. `routeTree.gen.ts` is auto-generated and consistent with files under `src/routes/`.

### SMOKE-003
- Description: Supabase client initializes with env-var guard
- Result: PASS
- Notes: `src/integrations/supabase/client.ts` throws at construction time if env vars are missing — confirmed at lines 11-14.

### SMOKE-004
- Description: SSR auth middleware validates Bearer tokens before passing context
- Result: PASS
- Notes: `src/integrations/supabase/auth-middleware.ts` checks header presence, prefix, token content, and claims before calling `next()`. Correct 401 responses on all failure paths.

### SMOKE-005
- Description: Remote bootstrap aborts correctly when user changes mid-flight
- Result: PASS
- Notes: `rehydrateThenBootstrapRemoteModules` checks `assertStillSameUser` both before and after the parallel sync phase. `AbortController` signal is honored at every async boundary.

---

## ❌ Failed Tests

### SMOKE-006
- Severity: 🟠 HIGH
- Description: ESLint exits with code 1 — 55 errors block CI/CD pipeline
- Steps to reproduce: Run `bun run lint` in project root
- Expected behavior: Zero errors, lint passes
- Actual behavior: 55 errors across 20+ files; process exits non-zero
- Evidence: Full lint output captured. See TEST-003-FUNCTIONAL for per-file breakdown.
- Suspected root cause: Multiple formatting violations (prettier/prettier), react-hooks rule violations, and `no-explicit-any` in Shadcn UI primitives
- Recommended fix: Run `bun run format` to auto-fix prettier errors; address react-hooks violations manually; add `// eslint-disable-next-line` only for third-party UI primitives where `any` is unavoidable

### SMOKE-007
- Severity: 🟡 MEDIUM
- Description: `Date.now()` called as default state initializer in two form modals — impure function during render
- Steps to reproduce: Open `EventFormModal` or `ExpenseFormModal` with no `initial` prop
- Expected behavior: Date defaults to a stable value; no ESLint error
- Actual behavior: `useState(toDateInput(Date.now()))` at render time — classified as impure by react-hooks/purity rule. Produces an ESLint error and can theoretically produce different timestamps across concurrent renders (StrictMode double-invoke)
- Evidence: `src/components/quanty/agenda/EventFormModal.tsx:34`, `src/components/quanty/balance/ExpenseFormModal.tsx:34`
- Suspected root cause: `Date.now()` used directly as the initializer argument of `useState`
- Recommended fix: Use a lazy initializer: `useState(() => toDateInput(Date.now()))` — the arrow function is only called once per mount

### SMOKE-008
- Severity: 🟡 MEDIUM
- Description: `Math.random()` called inside `useMemo` in Shadcn sidebar skeleton — impure function
- Steps to reproduce: Render `<SidebarMenuSkeleton>` from `src/components/ui/sidebar.tsx`
- Expected behavior: No impurity warning; stable width
- Actual behavior: `Math.random()` inside `useMemo(() => ..., [])` flagged by react-hooks/purity at line 643. In React StrictMode, `useMemo` may run twice, but the empty dep array makes the result effectively stable after mount.
- Evidence: `src/components/ui/sidebar.tsx:643`
- Suspected root cause: Third-party Shadcn template code — `Math.random()` used to vary skeleton width
- Recommended fix: Pre-generate the width outside the component, or use a seeded/deterministic value; acceptable to suppress with `eslint-disable` since the impact is purely cosmetic

### SMOKE-009
- Severity: 🟡 MEDIUM
- Description: `setState` called synchronously inside `useEffect` body in five form modals — cascading render warning
- Steps to reproduce: Open any of: `EventFormModal`, `ExpenseFormModal`, `ClientFormModal`, `ProductFormModal`, `QuoteFormModal`
- Expected behavior: No lint errors; single render pass when modal opens
- Actual behavior: `useEffect` bodies call multiple `setState` calls in sequence when `open` changes to `true`, causing cascading renders. Flagged by `react-hooks/set-state-in-effect`.
- Evidence: `EventFormModal.tsx:45`, `ExpenseFormModal.tsx:41`, `ClientFormModal.tsx:31`, `ProductFormModal.tsx:81`, `QuoteFormModal.tsx:57`
- Suspected root cause: Form reset pattern implemented as "set all fields in an effect" rather than using React 18's `startTransition` or controlled initialization via key prop
- Recommended fix: Pass a `key={modalOpenId}` to unmount/remount the form on open (eliminates the effect entirely), or batch all sets using a single state object

### SMOKE-010
- Severity: 🟡 MEDIUM
- Description: Empty catch block in `sendQuoteEmail` silently swallows all errors
- Steps to reproduce: Call `sendQuoteEmail` when the Edge Function is down or returns an error
- Expected behavior: Error is logged or surfaced to the caller
- Actual behavior: `catch {}` at `src/lib/sendQuoteEmail.ts:19` discards all exceptions silently. Failures are invisible to the user and developer.
- Evidence: `src/lib/sendQuoteEmail.ts:19` — ESLint `no-empty` error
- Suspected root cause: Intentional fire-and-forget, but the empty block was left without even a `console.error`
- Recommended fix: At minimum add `catch (e) { console.error("sendQuoteEmail failed", e); }` so failures surface in production logs

### SMOKE-011
- Severity: 🔵 LOW
- Description: 25 fast-refresh warnings across route files — non-component exports in component files
- Steps to reproduce: Run `bun run lint`
- Expected behavior: `react-refresh/only-export-components` passes
- Actual behavior: Route files export both the `Route` constant and component functions from the same file; HMR fast-refresh is degraded (full page reload instead of component-level refresh)
- Evidence: Warnings in `__root.tsx`, `agenda.tsx`, `auth.tsx`, `balance.tsx`, `clientes.tsx`, `configuracion.tsx`, `cotizaciones.tsx`, `index.tsx`, `inventario.tsx`, `router.tsx`, `useAuth.tsx`
- Suspected root cause: TanStack Router file-based routing requires `Route` and the component in the same file — this pattern is inherent to the framework
- Recommended fix: Add the affected route files to `eslint-disable` for `react-refresh/only-export-components`, or configure the rule to allow TanStack Router's export pattern

### SMOKE-012
- Severity: 🔵 LOW
- Description: Vite warns about redundant `vite-tsconfig-paths` plugin — appears 3 times during build
- Steps to reproduce: Run `bun run build`
- Expected behavior: No plugin conflict warnings
- Actual behavior: "The plugin 'vite-tsconfig-paths' is detected. Vite now supports tsconfig paths resolution natively…" printed three times
- Evidence: Build output lines 1-6
- Suspected root cause: `@lovable.dev/vite-tanstack-config` bundles the plugin and it is also registered separately (or the underlying config registers it multiple times)
- Recommended fix: Per AGENTS.md, do not add plugins manually to `vite.config.ts`. If the plugin is bundled by the Lovable preset, no further action is needed — but investigate if it is registered in `vite.config.ts` directly.

---

## ⚠ Untestable / Blocked

None.

---

## Final Assessment

- Production readiness: CONDITIONALLY DEPLOYABLE — build succeeds, but lint fails, which blocks any CI gate that runs `bun run lint`
- Major risks: Silent email failures; cascading render performance in modals; `Date.now()` impurity
- Recommended next action: Fix the 30 auto-fixable prettier errors first (`bun run format`), then address the react-hooks violations in form modals
