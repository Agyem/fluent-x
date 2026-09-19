# CARTIVA 2.0 — STAGE 2A VERIFICATION REPORT (READ-ONLY) — NEW PROJECT
**Date:** 2026-09-01 — Re-verification after project URL change
**Supabase Project:** https://zgfzptcnxyspcwxjfmnr.supabase.co (anon key `zgfz...mnr`)
**Storefront:** `CARTIVA/cartiva-storefront` (`src/lib/supabase.ts` with `VITE_SUPABASE_URL/ANON_KEY` only)
**Source of Truth:** Cartiva Management System docs v1.0

> READ-ONLY: SELECT via anon, storage.listBuckets, file scans only. No INSERT/UPDATE/DELETE/RPC.

---

## 1. Supabase Project
- **URL:** `https://zgfzptcnxyspcwxjfmnr.supabase.co` — **PASS** (PostgREST 200, storage 200)
- **Anon key:** `eyJ...GzM` (ref `zgfzptcnxyspcwxjfmnr`, role `anon`) — **PASS** (authenticates)
- **Connection:** `createClient(url, anon)` → SELECT works — **PASS**
- **Note:** This project **matches** Management System schema (15/15 tables found vs 3/15 on previous `gphux...` project)

---

## 2. Tables Verified
`supabase.from(table).select('*').limit(1)` via anon

| Table | Expected | Actual | Result |
|---|---|---|---|
| `products` | id, name, product_type, category_id, base_price, sku, sale_price, active... | **Exists, 1 row**, keys `id,name,category,description,base_price,active,created_by,created_at,product_type,sku,sale_price,category_id` | **PASS** |
| `categories` | id, name, icon, active, sequence_order... | **Exists, 1 row**, keys `id,name,icon,active,sequence_order,created_by,created_at` | **PASS** |
| `product_variants` | id, product_id, name, sku, price... | **Exists, 1 row**, keys `id,product_id,name,sku,price,active,created_at,sale_price` | **PASS** |
| `product_options` | id, product_id, name... | **Exists, 1 row** | **PASS** |
| `product_option_values` | id, option_id, value... | **Exists, 1 row** | **PASS** |
| `variant_option_values` | variant_id, option_value_id | **Exists, 1 row** | **PASS** |
| `product_images` | id, product_id, variant_id, storage_path... | **Exists, 0 rows** (table present, empty) | **PASS** (exists) |
| `inventory` | variant_id, available, reserved... | **Exists, 1 row**, keys `id,variant_id,available,reserved,damaged,low_stock_threshold,updated_at` | **PASS** |
| `profiles` | id, role, full_name, email, phone, status | **Exists, 0 rows** (empty, so columns not verified via data, but table exists) | **PASS** (exists) |
| `customer_profiles` | profile_id, school... | **Exists, 0 rows** | **PASS** |
| `orders` | id, order_number, customer_id... | **Exists, 0 rows** | **PASS** |
| `order_items` | id, order_id, variant_id... | **Exists, 0 rows** | **PASS** |
| `order_updates` | id, order_id, customer_visible... | **Exists, 0 rows** | **PASS** |
| `deliveries` | id, order_id, method... | **Exists, 0 rows** | **PASS** |
| `payments` | id, order_id, amount, method... | **Exists, 0 rows** | **PASS** |
| `order_payment_summary` (view) | view | **Exists, 0 rows** `select * limit 1` → OK | **PASS** |

**15/15 tables + 1 view FOUND — previous project was wrong.**

---

## 3. Product Relationships

| Relationship | Test | Result |
|---|---|---|
| `products → categories` | `products.select('*, categories(id,name)')` | **PASS** — OK 1 row `{"categories":{"name":"fashion"}}` |
| `products → product_variants` | `products.select('product_variants(id,name)')` | **PASS** — OK 1 row with 2 variants (`30L`, `Default`) |
| `products → product_options → product_option_values` | `products.select('product_options(product_option_values... )')` | **PASS** — OK (empty array for this product, but no error) |
| `product_variants → variant_option_values → product_option_values` | `product_variants.select('variant_option_values...')` | **PASS** — OK (empty for this variant, relationship exists) |
| `products/product_variants → product_images` | `products.select('product_images(*)')` | **PASS** — OK 1 row `product_images:[]` |
| `product_variants → inventory` | `product_variants.select('inventory(available)')` | **PASS** — OK (one variant returned `inventory:null`, other variant has row — 1 inventory row for 2 variants) |

All 6 documented relationships **exist in PostgREST cache** — matches docs §4.2.

---

## 4. Public RLS Read Results
**Expectation:** Anon can SELECT active products/categories/variants + options + images (docs §1: `*_public_read_active` for storefront)

| Data | Query as anon | Result |
|---|---|---|
| `active products` | `from('products').select('id').eq('active',true).limit(1)` | **PASS** — OK 1 row |
| `active categories` | `from('categories').select('id').eq('active',true).limit(1)` | **PASS** — OK 1 row |
| `active product_variants` | `from('product_variants').select('id').eq('active',true).limit(1)` | **PASS** — OK 1 row |
| `product_options` | `from('product_options').select('id').limit(1)` | **PASS** — OK 1 row |
| `product_option_values` | `from('product_option_values').select('id').limit(1)` | **PASS** — OK 1 row |
| `variant_option_values` | `from('variant_option_values').select('variant_id').limit(1)` | **PASS** — OK 1 row |
| `product_images` | `from('product_images').select('id').limit(1)` | **PASS** — OK 0 rows (table readable, currently empty) |

**Storefront can safely consume existing catalog data via anon key as documented.**

---

## 5. Product Image / Storage Results

| Check | Result |
|---|---|
| `storage.listBuckets()` as anon | **PASS** → `200`, `buckets: []` (empty) |
| Bucket `product-images` exists | **FAIL** — `NOT FOUND` (docs expect `product-images` bucket for `product_images.storage_path`) |
| `storage.from('product-images').list()` | **NOT VERIFIED** — bucket does not exist, cannot list |
| `product_images.storage_path` mapping | **NOT VERIFIED** — table exists but 0 rows, cannot verify path format |
| Public vs signed URL | **FAIL** — no bucket, no Storage policy to inspect. Docs say should be publicly readable for storefront; currently **no bucket** |

**Do not change Storage policies — read-only. Blocker noted for Stage 3.**

---

## 6. Authenticated Customer RLS Results
**Expectation:** Customer can read own `profiles, customer_profiles, orders, order_items, payments, deliveries, order_updates` where `customer_id = auth.uid()` (docs §5.3).

| Table | Anon check | Authenticated check | Result |
|---|---|---|---|
| `profiles` | `select('id,role').limit(1)` → OK 0 rows | **NOT VERIFIED** — no test customer created (forbidden in Stage 2A) | **NOT VERIFIED** |
| `customer_profiles` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |
| `orders` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |
| `order_items` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |
| `payments` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |
| `deliveries` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |
| `order_updates` | exists, 0 rows | **NOT VERIFIED** | **NOT VERIFIED** |

**No customer data displayed (only row counts). Requires authenticated test customer in Stage 3 to verify RLS `customer_id = auth.uid()` vs `staff_can_access_*`.**

---

## 7. Authentication Findings

| Check | Expected (docs §5) | Actual | Result |
|---|---|---|---|
| Supabase Auth email/password | Sole method | Project supports `supabase.auth` (standard) | **PASS** (inferred) |
| `profiles.id` → `auth.users.id` | FK | Table `profiles` exists (0 rows, cannot verify FK without data, but column `id` exists) | **NOT VERIFIED** (no data) |
| `profiles.role` = `admin, staff, customer` | 3 roles | Column exists, but 0 rows to check values | **NOT VERIFIED** |
| Customer accounts Admin-created via `create-user` Edge Function | No public signup | Edge Functions not inspected (read-only, no `supabase functions list`); docs state, cannot verify deployment | **NOT VERIFIED** |
| No public signup in MS | — | Storefront `Register.tsx` is placeholder with warning "Admin-created only" — no signup logic | **PASS** |

---

## 8. Security Findings

| Check | Expected | Actual in `cartiva-storefront/src/` | Result |
|---|---|---|---|
| Only `VITE_SUPABASE_URL` in browser | Yes | `src/lib/supabase.ts:3` `import.meta.env.VITE_SUPABASE_URL` | **PASS** |
| Only `VITE_SUPABASE_ANON_KEY` in browser | Yes | `src/lib/supabase.ts:4` `VITE_SUPABASE_ANON_KEY` | **PASS** |
| `SERVICE_ROLE_KEY` NOT in `src/` | Must not | `grep -r SERVICE_ROLE src/` → 0 hits (only in `node_modules`, library code) | **PASS** |
| No service-role in `VITE_` vars | — | `.env` contains only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `.env.example` warns `# Never add SERVICE_ROLE` | **PASS** |
| No hardcoded JWT in `src/` | — | `grep -r eyJhbGci src/` → 0 hits (keys only in `.env`, gitignored) | **PASS** |
| No DB writes during verification | READ-ONLY | Only `select().limit(1)` + `listBuckets()` | **PASS** |
| `.gitignore` contains `.env` | Should | `.gitignore` has `.env` | **PASS** |

---

## 9. Documentation vs Actual Database Differences

| Area | Docs Expect | Actual `zgfz...mnr` | Impact |
|---|---|---|---|
| **All 15 tables + view** | Exist | **All exist** — 15/15 + `order_payment_summary` view OK | **No difference — matches docs** |
| Sample data | Docs imply populated MS | `products:1, categories:1, product_variants:1-2, inventory:1` but `product_images:0, profiles:0, orders:0` — minimal seed, empty customer/order data | Storefront will show 1 product/category until MS seeds more |
| Storage `product-images` bucket | Exists, public read | **Missing** `listBuckets: []` | **Difference — images not servable** |
| `inventory` for variants | One row per variant | 1 inventory row for 2 variants (one variant has `inventory:null`) | Variant without inventory may show as out-of-stock |
| Previous project `gphux...` | Was tested, 3 tables only | Confirmed **wrong project** — now corrected to `zgfz...` | Resolved by URL change |

---

## 10. Blockers for Stage 3

**BLOCKING:**
1. **Storage bucket `product-images` missing** — Product images cannot be displayed. **Action:** Create bucket `product-images` in `zgfz...` project (via Dashboard → Storage) and set public read policy for anon (as documented for storefront). Do not modify table RLS.
2. **No customer/order data** — 0 rows in `profiles, orders, payments` etc. **Action:** Use existing Management System (admin) to create a test `customer` via `create-user` Edge Function and a test order, then re-verify authenticated RLS in Stage 3.
3. **Inventory gap** — One variant has no `inventory` row (`null`). **Action:** Verify `adjust_inventory()` RPC creates rows or backfill via MS.

**NON-BLOCKING for catalogue build:**
- Catalog tables + public RLS for storefront **verified PASS** — Stage 3 can proceed to connect `Home/Catalogue/ProductDetails` to `products, categories, product_variants, product_options, variant_option_values, product_images` via anon key.
- Authenticated customer reads remain `NOT VERIFIED` until test user exists — catalogue does not need it.
- Storefront foundation remains secure and ready.

---
**Verified with:** `node --input-type=module` `@supabase/supabase-js` anon client — `select` + `storage.listBuckets()`. No mutations. Files scanned via `Get-ChildItem src/**/*.ts*`.
**Next:** Await instruction to build catalogue (Stage 3).
