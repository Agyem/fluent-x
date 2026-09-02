# CARTIVA 2.0 — STAGE 2A VERIFICATION REPORT (READ-ONLY)
**Date:** 2026-09-01
**Supabase Project:** https://gphuxqjdinyikyjjzzyd.supabase.co (anon key `gphux...zyd`)
**Storefront:** `CARTIVA/cartiva-storefront` (Vite React, `src/lib/supabase.ts` with `VITE_SUPABASE_URL/ANON_KEY` only)
**Source of Truth:** Cartiva Management System documentation v1.0

> All checks are READ-ONLY (SELECT via anon key, storage.listBuckets, file scans). No INSERT/UPDATE/DELETE/RPC mutations, no table creation, no RLS changes, no user creation.

---

## 1. Supabase Project
- **Configured URL:** `https://gphuxqjdinyikyjjzzyd.supabase.co` — **PASS** (resolves, PostgREST reachable, HTTP 200 on `GET /rest/v1/products`)
- **Anon key:** `eyJ...91U` (ref `gphuxqjdinyikyjjzzyd`, role `anon`) — **PASS** (authenticates, `storage.listBuckets` returns 200)
- **Connection:** Node `createClient(url, anon)` succeeds, `SELECT` via anon works (see §2) — **PASS**
- **Note:** Project appears to be **empty/new** — only 3 of 15 documented tables exist with 0 rows. This does NOT match the Management System project described in docs (21 migrations, populated). Likely wrong project ref or Management System not deployed here.

---

## 2. Tables Verified
Test: `supabase.from(table).select('*').limit(1)` via anon key. No writes.

| Table | Expected per docs | Actual | Result |
|---|---|---|---|
| `products` | exists, cols: id, name, product_type, category_id, base_price, sku, sale_price, active | **Exists, 0 rows**, cols `id, name, category_id, sku, sale_price` confirmed; `base_price, active, product_type` **missing** (`column does not exist`) | **FAIL** (schema mismatch) |
| `categories` | id, name, icon, active, sequence_order | **Exists, 0 rows**, cols `id, name` exist; `icon, active, sequence_order` missing | **FAIL** (schema mismatch) |
| `product_variants` | id, product_id, name, sku, price... | **Not found** `PGRST205 Could not find table 'public.product_variants'` | **FAIL** |
| `product_options` | id, product_id, name... | **Not found** PGRST205 | **FAIL** |
| `product_option_values` | id, option_id, value... | **Not found** PGRST205 | **FAIL** |
| `variant_option_values` | variant_id, option_value_id | **Not found** PGRST205 | **FAIL** |
| `product_images` | id, product_id, variant_id, storage_path... | **Not found** PGRST205 | **FAIL** |
| `inventory` | variant_id, available, reserved... | **Not found** PGRST205 | **FAIL** |
| `profiles` | id (FK auth.users), role, full_name, email, phone, status | **Exists, 0 rows**, cols `id, role, full_name, email` exist; `phone, status` missing | **FAIL** (schema mismatch) |
| `customer_profiles` | profile_id, school, student_id... | **Not found** PGRST205 | **FAIL** |
| `orders` | id, order_number, customer_id, status, total_amount... | **Not found** PGRST205 | **FAIL** |
| `order_items` | id, order_id, variant_id, quantity... | **Not found** PGRST205 | **FAIL** |
| `order_updates` | id, order_id, customer_visible... | **Not found** PGRST205 | **FAIL** |
| `deliveries` | id, order_id, method, tracking_number... | **Not found** PGRST205 | **FAIL** |
| `payments` | id, order_id, amount, method... | **Not found** PGRST205 | **FAIL** |
| `order_payment_summary` (view) | paid/balance view | **Not found** PGRST205 | **FAIL** |

**Summary:** 3/15 tables exist but incomplete, 12/15 not found. Project is not the Management System DB.

---

## 3. Product Relationships

| Relationship | Expected | Actual Test | Result |
|---|---|---|---|
| `products → categories` (products.category_id → categories.id) | FK, join `products.select('*, categories(id,name)')` | `supabase.from('products').select('id, category_id, categories(id,name)').limit(1)` → **OK, 0 rows, no error** → relationship exists in PostgREST cache | **PASS** |
| `products → product_variants` | FK, `products → product_variants` | `products.select('id, product_variants(id)')` → **ERROR: Could not find relationship between 'products' and 'product_variants'** | **FAIL** |
| `products → product_options → product_option_values` | Chain | `product_options` table missing → cannot test | **FAIL** (blocked by missing tables) |
| `product_variants → variant_option_values → product_option_values` | Chain | `product_variants` missing → cannot test | **FAIL** |
| `products/product_variants → product_images` | FK | `product_images` missing → cannot test | **FAIL** |
| `product_variants → inventory` | 1:1 `variant_id` | `product_variants` missing → cannot test | **FAIL** |

**Conclusion:** Only `products→categories` is verifiable and passes; all variant/image/inventory relationships **cannot be verified** because dependent tables do not exist in this project.

---

## 4. Public RLS Read Results
**Policy expectation:** Anon can SELECT `active products`, `active categories`, `active product_variants`, `product_options`, `product_option_values`, `variant_option_values`, `product_images` (docs §1, §4.2: `*_public_read_active` policies for external storefront).

| Data | Query as anon | Result |
|---|---|---|
| `active products` | `from('products').select('id').eq('active',true)` | **FAIL** — `column products.active does not exist` (schema mismatch, RLS not testable) |
| `active categories` | `from('categories').select('id').eq('active',true)` | **FAIL** — `column categories.active does not exist` |
| `active product_variants` | `from('product_variants').select('id').eq('active',true)` | **FAIL** — table not found PGRST205 |
| `product_options` | `from('product_options').select('*').limit(1)` | **FAIL** — table not found |
| `product_option_values` | `from('product_option_values').select('*').limit(1)` | **FAIL** — table not found |
| `variant_option_values` | `from('variant_option_values').select('*').limit(1)` | **FAIL** — table not found |
| `product_images` | `from('product_images').select('*').limit(1)` | **FAIL** — table not found |

**Note:** `products` and `categories` **are** readable as anon (`select('*').limit(1)` → OK 0 rows), so anon RLS **does** permit SELECT, but the `active` column filter required for storefront cannot be verified. All other catalog tables are absent, so public RLS for storefront **cannot be verified**.

---

## 5. Product Image / Storage Results

| Check | Result |
|---|---|
| `supabase.storage.listBuckets()` as anon | **PASS** — returns 200, but `buckets: []` (empty array) |
| Bucket `product-images` exists | **FAIL** — `NOT FOUND` (docs expect `product-images` bucket for `product_images.storage_path`) |
| `storage.from('product-images').list('', {limit:1})` | **NOT VERIFIED** — bucket does not exist, cannot test |
| `product_images.storage_path` mapping | **NOT VERIFIED** — table `product_images` does not exist |
| Public readability vs signed URL | **NOT VERIFIED** — no bucket, no policy to inspect. Docs say bucket `product-images` should be publicly readable via anon for storefront; cannot confirm. |

**Do not change Storage policies — verified read-only.**

---

## 6. Authenticated Customer RLS Results
**Expectation (docs §5.3, §8):** Authenticated `customer` can SELECT own `profiles`, `customer_profiles`, `orders`, `order_items`, `payments`, `deliveries`, `order_updates` where `customer_id = auth.uid()` (or via `staff_can_access_*` helpers). No cross-customer reads.

| Table | Test as anon (unauthenticated) | Authenticated customer test | Result |
|---|---|---|---|
| `profiles` | `select('*').limit(1)` → OK 0 rows (anon can read, but should be restricted to own?) | **NOT VERIFIED** — no test user created (forbidden by stage). Cannot verify `customer can read own only` without `auth.users` login. | **NOT VERIFIED** |
| `customer_profiles` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |
| `orders` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |
| `order_items` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |
| `payments` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |
| `deliveries` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |
| `order_updates` | Table not found | **NOT VERIFIED** | **NOT VERIFIED** |

**No customer data was displayed or exposed during verification (only row counts and error messages).**

---

## 7. Authentication Findings

| Check | Expected (docs §5) | Actual | Result |
|---|---|---|---|
| Supabase Auth email/password | Sole method, no self-signup | `supabase.auth` available in `@supabase/supabase-js` — project supports email/password (standard) | **PASS** (inferred, not tested via signup) |
| `profiles.id` → `auth.users.id` FK | One row per auth.users | `profiles.id` exists, `profiles.role` exists, but `profiles` table has different columns (`phone/status` missing) and 0 rows | **FAIL** (schema mismatch, cannot verify FK without data) |
| `profiles.role` contains `admin, staff, customer` | Exactly 3 roles | Column `profiles.role` exists (verified via `select role`), but 0 rows to check values | **NOT VERIFIED** (no data) |
| Customer accounts Admin-created via `create-user` Edge Function | No public signup in MS | Edge Functions not inspected (read-only stage, no `supabase functions list`); docs state this, but cannot verify deployment | **NOT VERIFIED** |
| No public signup flow in MS | — | Storefront `Register.tsx` is placeholder with note "Admin-created only" — no signup logic implemented | **PASS** (no signup implemented as required) |

---

## 8. Security Findings

| Check | Expected | Actual in `cartiva-storefront/src/` | Result |
|---|---|---|---|
| Only `VITE_SUPABASE_URL` in browser code | Yes | `src/lib/supabase.ts:3` `import.meta.env.VITE_SUPABASE_URL` — only VITE_ var | **PASS** |
| Only `VITE_SUPABASE_ANON_KEY` in browser code | Yes | `src/lib/supabase.ts:4` `VITE_SUPABASE_ANON_KEY` only | **PASS** |
| `SUPABASE_SERVICE_ROLE_KEY` NOT in `src/` | Must not be present | `grep src/**/*.ts*` for `SERVICE_ROLE|service_role` → **0 hits** (only in `node_modules/@supabase/*` which is library code, not our src) | **PASS** |
| No service-role in `VITE_` variables | — | `.env:1-2` contains only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `.env.example:1-3` explicitly warns `# Never add SUPABASE_SERVICE_ROLE_KEY` | **PASS** |
| No hardcoded credentials in `src/` | — | `grep src -r "eyJhbGciOi"` → **0 hits** in `src/` (keys only in `.env` at project root, gitignored) | **PASS** |
| No DB writes during verification | READ-ONLY | Only `select().limit(1)` and `storage.listBuckets()` were executed; no INSERT/UPDATE/DELETE/RPC | **PASS** |
| `.gitignore` contains `.env` | Should | `.gitignore:1` contains `.env` (Vite template) — `.env` not committed | **PASS** |

**The earlier `SERVICE_ROLE` hits in `node_modules` are library type definitions, not storefront code — ignored.**

---

## 9. Documentation vs Actual Database Differences

| Area | Docs Expect | Actual in `gphux...zyd` project | Impact |
|---|---|---|---|
| **Migrations** | 21 `.sql` files run sequentially, all tables/views exist | Only `products, categories, profiles` exist (partial schema); 12 tables + 1 view missing | **Major — Management System not deployed here** |
| `products` columns | `product_type, base_price, active` etc. | Missing `base_price, active, product_type`; only `id, name, category_id, sku, sale_price` exist | Storefront filtering by `active=true` will fail |
| `categories` columns | `icon, active, sequence_order` | Missing all 3; only `id, name` | Category icons/filters not possible |
| `profiles` columns | `phone, status` | Missing | Customer phone/status not storable |
| `product_variants` + related | All variant/image/inventory tables exist | Completely absent (PGRST205) | **Storefront cannot show variants, prices, stock, images** |
| `customer_profiles, orders, order_items, payments, deliveries, order_updates` | Core order/payment flow | Absent | **Customer orders/payments undeliverable** |
| `order_payment_summary` view | Exists | Absent | Balance not computable |
| Storage `product-images` bucket | Exists, public read | `listBuckets()` → `[]`, bucket not found | **Images not servable** |
| Data rows | Docs describe populated system (products, orders, etc.) | All existing tables have **0 rows** | Empty storefront even if schema fixed |

**Conclusion:** This Supabase project does NOT match the Management System documentation. It appears to be a **fresh/empty project** (possibly the intended Cartiva 2.0 project before migration) rather than the existing Management System project.

---

## 10. Blockers for Stage 3

**BLOCKING — must resolve before building Catalogue/Product components:**

1. **Wrong or empty Supabase project** — 12 tables + storage bucket missing. **Action:** Confirm correct Management System `SUPABASE_URL` (should be the project where 21 migrations were run and where the `.exe` connects). Verify by opening Management System `.env` or Supabase Dashboard project ref. Do NOT run migrations on `gphux...zyd` without approval — docs say "Do NOT create tables" in Stage 2A.

2. **Schema drift on existing tables** — `products, categories, profiles` missing documented columns (`active, product_type, icon, phone` etc.). **Action:** After pointing to correct project, re-run §2 checks; if drift persists, it is a docs-vs-DB inconsistency that must be documented before storefront queries are written.

3. **Storage bucket missing** — `product-images` not found; image approach (public vs signed URL) cannot be verified. **Action:** Verify bucket exists in correct project and check Storage Policies (anon SELECT).

4. **Public RLS unverifiable** — Cannot confirm anon can read `active products/categories/variants` until tables and `active` columns exist.

5. **Authenticated RLS not testable** — Requires a test customer login (forbidden in Stage 2A). Will need a dedicated test customer account (admin-created via `create-user` Edge Function) in Stage 3 to verify `customer can read own orders only`.

**Non-blocking for Stage 3 (can proceed with placeholder storefront as built):**
- Storefront foundation (`cartiva-storefront`) is ready, secure (only anon key), responsive, and correctly structured for future Supabase integration (RootLayout, 10 routes, `lib/supabase.ts`).
- No code changes needed until correct project is confirmed.

---

**Verification performed with:** `node --input-type=module` + `@supabase/supabase-js` `createClient(anon)` — read-only `select().limit(1)` and `storage.listBuckets()`. No mutations. Source scan via `Get-ChildItem src/**/*.ts* | Select-String`.

**Next:** Await instruction to either (a) point storefront to the **correct Management System Supabase project URL**, or (b) authorize read-only re-verification after project confirmation. Do not build Catalogue.
