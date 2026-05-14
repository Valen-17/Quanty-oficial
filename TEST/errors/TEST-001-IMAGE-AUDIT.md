# TEST-001-IMAGE-AUDIT

**Scope:** Image handling end-to-end — product upload flow, ProductImage component, ProductFormModal, products store/repository, Supabase storage configuration, lint, build.
**Date:** 2026-05-14
**Auditor:** QA Automation (claude-sonnet-4.6)

---

## Summary

| Metric | Count |
|---|---|
| Total test areas examined | 9 |
| Passed | 5 |
| Failed | 4 |
| Untestable (runtime) | 1 |
| Overall risk | 🟠 HIGH — unsafe for Cloudinary migration without addressing critical structural issues first |

---

## Current Image Upload Method — How It Works Today

Product images use a **client-side base64 pipeline with no Supabase Storage involvement**:

1. User selects a file via `<input type="file">` in `ProductFormModal.tsx`.
2. `handleFile()` validates MIME type against `ALLOWED_TYPES` and rejects files over 6 MB (raw).
3. `compressImage()` draws the file onto an offscreen Canvas, resizes to a max dimension of 800 px, and re-encodes to `image/jpeg` at quality 0.82.
4. The resulting **base64 data URI** (`data:image/jpeg;base64,…`) is stored directly in `form.imageUrl` state.
5. On submit, the data URI is passed as `ProductInput.imageUrl` → `createProduct` / `updateProduct` in the repository.
6. The repository writes the raw base64 string into the `image_url` **TEXT column** of the Supabase `products` table via `supabase.from("products").insert/update(...)`.
7. Zustand persists the same base64 string to `localStorage` under key `quanty-inventory-v1` (scoped by `user_id`).
8. `ProductImage.tsx` renders the value directly as `<img src={...}>` — works for both data URIs and future HTTP URLs.

**Avatar upload (AvatarUploader.tsx) uses a completely different, correct approach**: uploads the binary `File` to `supabase.storage` bucket `"avatars"`, then stores only the public CDN URL in `profiles.avatar_url`. Products do not use this pattern at all.

---

## Passed Tests

### IMG-PASS-01

- **Description:** `ProductImage` component rendering and fallback
- **Result:** PASS
- **Notes:** `src/components/quanty/inventory/ProductImage.tsx` correctly branches on `src` truthiness. Fallback renders a `lucide-react` `ImageIcon`. `loading="lazy"` is present. Size variants (`sm`, `md`, `lg`) are correctly mapped. `object-cover` prevents distortion. No broken patterns; this component is clean and Cloudinary-ready — it accepts any string URL.

### IMG-PASS-02

- **Description:** File input wiring and upload UX in `ProductFormModal`
- **Result:** PASS
- **Notes:** `<input type="file">` at `ProductFormModal.tsx:209` is hidden and triggered via `fileInputRef`. Upload/processing state is tracked with `uploading` boolean; the submit button is disabled while `uploading` is true (`line 315`). The "Cambiar imagen" / "Subir imagen" label toggle and the "Quitar" button are correctly conditional on `form.imageUrl`. UX flow is complete and coherent.

### IMG-PASS-03

- **Description:** MIME-type and size validation in `handleFile`
- **Result:** PASS
- **Notes:** `ProductFormModal.tsx:102-108` validates `file.type` against `ALLOWED_TYPES` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`). The size guard at `line 106` rejects files over `MAX_IMAGE_BYTES * 4` (6 MB raw). Error messages surface to the `imageUrl` field error slot. The `accept` attribute on the `<input>` mirrors allowed MIME types. Note: `image/gif` is in `ALLOWED_TYPES` but the canvas re-encode path at `line 68` outputs `image/jpeg`, silently destroying animation — flagged separately as `IMG-FAIL-03`.

### IMG-PASS-04

- **Description:** Zod schema `imageUrl` field propagation end-to-end
- **Result:** PASS
- **Notes:** `src/domain/entities.ts:11-15` defines `imageUrl: z.string().max(2_000_000)` on both `productSchema` and `productInputSchema`. The repository at `products.repository.ts:131` maps it to `image_url` on insert, and `productRowToDomain` at `line 65` maps `row.image_url` back to `imageUrl`. The field is never dropped along the chain: `ProductFormModal` → `onSubmit` → `inventoryStore` → `products.repository` → Supabase → back.

### IMG-PASS-05

- **Description:** Production build
- **Result:** PASS
- **Notes:** `bun run build` completes successfully (client + SSR). `ProductImage` bundles cleanly into `ProductImage-Czn8-h7v.js` (0.88 kB client / 0.93 kB server). No TypeScript compilation errors related to image handling. Build output is deployable.

---

## Failed Tests

### IMG-FAIL-01 — 🔴 CRITICAL

- **Severity:** 🔴 CRITICAL
- **Description:** Base64 images are stored directly in the Supabase `products` table TEXT column and in `localStorage`, causing catastrophic data volume issues at scale.
- **Steps to reproduce:**
  1. Open the Inventario page.
  2. Add a product and upload a ~1 MB JPEG.
  3. After `compressImage()`, the resulting base64 string is ~800–1100 KB of text.
  4. This string is written into `products.image_url` (TEXT, no storage backend) and into `localStorage` via Zustand persist.
- **Expected behavior:** Images should be uploaded to an object-storage service (Supabase Storage or Cloudinary) and only a short URL (~100–200 chars) persisted to the database and localStorage.
- **Actual behavior:** A full base64-encoded JPEG data URI (potentially 1–2 MB of ASCII text per product) is stored as a TEXT value in Postgres and replicated to localStorage.
- **Evidence:**
  - `src/components/quanty/inventory/ProductFormModal.tsx:112-113` — `compressed` (a base64 data URI) is written directly to `form.imageUrl`.
  - `src/repositories/products.repository.ts:131` — `image_url: v.imageUrl ?? ""` inserts the raw data URI into Postgres.
  - `src/domain/entities.ts:11` — `imageUrl: z.string().max(2_000_000)` — the 2 MB cap is on the **string length**, confirming the design stores base64 in Postgres.
  - `supabase/migrations/20260511120000_core_domain_clients_products_quotes_inventory.sql:122,127` — `image_url text not null default ''` with `constraint products_image_url_len check (char_length(image_url) <= 2000000)` — the DB constraint explicitly allows up to 2 million characters of base64 in a row.
  - `inventoryStore.ts:129` — `partialize: (state) => ({ products: state.products })` — every product including its full base64 image is persisted to localStorage. With 10 products each carrying a 1 MB image, localStorage would hold ~10 MB of product data alone; most browsers hard-cap localStorage at 5–10 MB total, causing silent data loss or quota errors.
- **Suspected root cause:** Intentional interim design decision to defer storage integration; the 2 MB column constraint and `compressImage` utility confirm the team is aware this is temporary. However, the risks are severe in a live environment.
- **Recommended fix:**
  - Complete the Cloudinary integration. Upload `File` to Cloudinary from `handleFile()`, store only the returned CDN URL in `form.imageUrl`.
  - Change `imageUrl` Zod max from `2_000_000` to `2_000` (a typical URL length) once base64 is gone.
  - Apply a Supabase migration to reduce `products_image_url_len` to `<= 2000`.
  - Update `partialize` or strip `imageUrl` from localStorage persist (images can re-fetch from CDN).

---

### IMG-FAIL-02 — 🟠 HIGH

- **Severity:** 🟠 HIGH
- **Description:** Lint error in `ProductFormModal.tsx` — `react-hooks/set-state-in-effect` violation at the form-reset `useEffect`.
- **Steps to reproduce:**
  1. Run `bun run lint`.
  2. Observe error at `src/components/quanty/inventory/ProductFormModal.tsx:81`.
- **Expected behavior:** No lint errors. The ESLint configuration enforces `react-hooks/set-state-in-effect` as an error (exit code 1).
- **Actual behavior:**
  ```
  ProductFormModal.tsx:81:7  error  Avoid calling setState() directly within an effect  react-hooks/set-state-in-effect
  ```
  The `useEffect` at lines 79–85 calls `setForm`, `setErrors`, and `setSubmitting` synchronously in its body when `open` changes.
- **Evidence:** `ProductFormModal.tsx:79-85`:
  ```ts
  useEffect(() => {
    if (open) {
      setForm(initial ? toForm(initial) : empty);   // line 81 — flagged
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initial]);
  ```
- **Suspected root cause:** React 19's stricter rules plugin (`eslint-plugin-react-hooks` v5+) flags synchronous `setState` inside `useEffect` body as a cascading-render risk. The pattern itself works at runtime but violates the declared lint contract.
- **Recommended fix:** Replace with `useLayoutEffect` for synchronous DOM-safe resets, or restructure: initialize state from props using a `key` prop on the modal (`<ProductFormModal key={editing?.id ?? "new"}>`) to force remount, eliminating the effect entirely. This is also the recommended fix for the same pattern in `ClientFormModal`, `EventFormModal`, `ExpenseFormModal`, and `QuoteFormModal`.

---

### IMG-FAIL-03 — 🟡 MEDIUM

- **Severity:** 🟡 MEDIUM
- **Description:** `image/gif` is accepted by validation but silently converted to a static JPEG by the canvas pipeline, destroying animation without informing the user.
- **Steps to reproduce:**
  1. Attempt to upload an animated GIF.
  2. `handleFile()` passes the MIME check at `ProductFormModal.tsx:102` (gif is in `ALLOWED_TYPES`).
  3. `compressImage()` draws frame 0 of the GIF onto a canvas and returns `canvas.toDataURL("image/jpeg", 0.82)`.
  4. The stored value is a static JPEG; animation is lost.
- **Expected behavior:** Either (a) GIF is excluded from `ALLOWED_TYPES` and the error message updated to "JPG, PNG o WebP", or (b) GIF is accepted and the canvas output uses `image/gif` / passes through unchanged.
- **Actual behavior:** GIF accepted, animation silently destroyed, no user feedback.
- **Evidence:**
  - `ProductFormModal.tsx:44` — `ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]`
  - `ProductFormModal.tsx:68` — `return canvas.toDataURL("image/jpeg", quality)` — hardcoded JPEG output regardless of input type.
  - `ProductFormModal.tsx:203` — hint text reads "JPG, PNG o WebP" — inconsistent with `ALLOWED_TYPES` which includes gif.
- **Suspected root cause:** `image/gif` was likely added to `ALLOWED_TYPES` without updating the canvas encode path.
- **Recommended fix:** Remove `"image/gif"` from `ALLOWED_TYPES` at `ProductFormModal.tsx:44`. Update the `<input accept>` attribute at `line 212` to remove `image/gif`. The hint at `line 203` and the error message at `line 103` already say "JPG, PNG o WebP" so no copy changes needed.

---

### IMG-FAIL-04 — 🟡 MEDIUM

- **Severity:** 🟡 MEDIUM
- **Description:** No Supabase Storage bucket is defined or configured for product images. When Cloudinary integration is added, the team may incorrectly assume a storage bucket exists for rollback.
- **Steps to reproduce:**
  1. Inspect `supabase/config.toml` — contains only `project_id`.
  2. Search all migration SQL files for `storage.buckets` or `storage_object` — none found.
  3. Inspect `AvatarUploader.tsx` — references `supabase.storage.from("avatars")`, implying the `avatars` bucket is created out-of-band (via Supabase dashboard), not tracked in migrations.
- **Expected behavior:** If product images ever used Supabase Storage, a bucket definition and RLS policy would exist in the migrations or a `storage.sql` file. The absence is expected given the current base64 approach, but it means there is no infrastructure to fall back to if Cloudinary integration is delayed.
- **Actual behavior:** Zero storage bucket configuration for products exists in the repository. The `avatars` bucket for profiles is also untracked in migrations.
- **Evidence:**
  - `supabase/config.toml` — single line, no storage configuration.
  - All migration files — no `INSERT INTO storage.buckets` or equivalent.
  - `AvatarUploader.tsx:48-50` — `supabase.storage.from("avatars").upload(...)` references a bucket that must exist in production but has no migration source.
- **Suspected root cause:** Supabase Storage buckets were created manually through the dashboard. This is a reproducibility and disaster-recovery gap.
- **Recommended fix:** Before or alongside the Cloudinary integration, add a `supabase/migrations/YYYYMMDD_storage_buckets.sql` (or `supabase/storage.sql`) that creates and configures the `avatars` bucket with appropriate RLS. For Cloudinary integration, no product bucket is needed, but the avatars bucket should be tracked.

---

## Untestable / Blocked

### IMG-BLOCK-01

- **Reason blocked:** Runtime / network — cannot verify actual Supabase write behavior (localStorage quota exhaustion, Postgres row size behavior with large base64 strings) without a live environment and populated data.
- **Missing dependency/access:** Live Supabase project credentials and a browser session with multiple products having large images.
- **What is needed:** Access to the live Supabase project dashboard or a local Supabase instance, plus test data with 5–10 products each carrying ~1 MB images, to confirm localStorage quota errors and Postgres TEXT column performance under the current base64 model.

---

## Cloudinary Integration Readiness Assessment

### What is in a clean state

| Area | Status | Notes |
|---|---|---|
| `ProductImage` component | Ready | Accepts any `src` string — will work identically with a Cloudinary URL |
| Repository `image_url` field | Ready after schema change | The column exists; just needs the value to be a URL instead of base64 |
| Zod validation shape | Requires update | Change `max(2_000_000)` to `max(2_000)` once base64 is eliminated |
| Form state / `handleFile` boundary | Clean insertion point | Replace `compressImage()` call with a Cloudinary upload call; return URL |
| RLS / auth | Ready | Products table RLS is correct; no changes needed for Cloudinary |
| Build pipeline | Ready | Build passes; no image-specific bundling concerns |

### What must be done before Cloudinary integration is merged

1. **Remove `compressImage`** from `ProductFormModal.tsx` and replace with a Cloudinary upload function that returns a URL string. The rest of the form flow is unchanged.
2. **Update Zod schemas** — `productSchema.imageUrl` and `productInputSchema.imageUrl` from `max(2_000_000)` to `max(2_000)` in `src/domain/entities.ts`.
3. **Apply a Supabase migration** to tighten the `products_image_url_len` constraint from `<= 2000000` to `<= 2000`.
4. **Remove `"image/gif"` from `ALLOWED_TYPES`** to close the silent conversion bug.
5. **Fix the `react-hooks/set-state-in-effect` lint error** in `ProductFormModal.tsx` — the build passes but lint is broken (exit 1), which blocks CI pipelines.
6. **Consider excluding `imageUrl` from Zustand persist** or storing only the URL (already small) rather than the base64. If only URLs are stored after Cloudinary migration, the localStorage concern resolves automatically.

---

## Final Assessment

- **Production readiness:** Conditionally deployable in current state (build passes, RLS is correct, data flows end-to-end). The base64 storage model is a known temporary design that functions but carries severe scalability risk.
- **Readiness for Cloudinary integration:** The insertion point is clean and well-isolated (`handleFile` in `ProductFormModal.tsx` + the `imageUrl` field type). However, 4 issues (IMG-FAIL-01 through IMG-FAIL-04) must be resolved in the same PR or as pre-work to avoid compounding technical debt.
- **Major risks (ranked):**
  1. 🔴 IMG-FAIL-01 — Base64 in Postgres + localStorage will cause localStorage quota exhaustion and Postgres row bloat in any real user session.
  2. 🟠 IMG-FAIL-02 — Lint exits with code 1; this will break any CI gate that runs `bun run lint`.
  3. 🟡 IMG-FAIL-03 — Silent GIF→JPEG conversion misleads users.
  4. 🟡 IMG-FAIL-04 — Storage bucket configuration untracked; disaster recovery gap.
- **Recommended next action:** Proceed with Cloudinary integration. The `handleFile` function is the sole integration point. Address IMG-FAIL-02 (lint), IMG-FAIL-03 (GIF), and the Zod/migration schema updates within the same PR. IMG-FAIL-01 is resolved as a consequence of the Cloudinary migration itself.
