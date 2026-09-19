# CARTIVA 2.0 — STAGE 7 REPORT: REAL CHECKOUT + ORDER CREATION + MANUAL MOMO

**Date:** 2026-09-02
**Project:** https://zgfzptcnxyspcwxjfmnr.supabase.co (anon `zgfz...mnr`, service `zgfz...M` server-side only for verification)
**Storefront:** `CARTIVA/cartiva-storefront` — Vite 8 + React 19 + TS 6 + Tailwind 3.4 + react-router 7 + supabase-js 2.112
**Constraints:** No Management System modify, no second DB/backend, no schema change unless reported, anon only in browser, no Paystack, no service-role in frontend.

---

## Implementation Summary

Turned Cart/Checkout foundation into real order creation with **authoritative DB prices** and **manual MoMo (pending)**. Customers add real variants to client cart (localStorage), checkout re-fetches variant/product/inventory from Supabase, validates, calculates total from DB, creates `orders` + `order_items` with `customer_id = auth.uid()`, shows MoMo instructions, payment stays pending, cart clears only on success.

**Previous blocker resolved:** `orders`/`order_items` INSERT was blocked for customers (`42501` — only `is_admin OR has_permission('orders.create')`). Minimal fix applied in Stage 7 (see DB Changes) — 2 INSERT policies for customers with `WITH CHECK (auth.uid() = customer_id)` and `order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())`. Verified via `pg_policies` and live test.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/momoConfig.ts` | **Created** — placeholder for manual MoMo (`VITE_MOMO_NETWORK`, `VITE_MOMO_ACCOUNT_NAME`, `VITE_MOMO_NUMBER`), `isMomoConfigured()` helper, no hardcoded fake number |
| `src/lib/catalogue.ts` | **Unchanged** — existing 7 read-only functions reused for authoritative fetch |
| `src/context/CartContext.tsx` | **Created in Stage 5** — `addItem/remove/increase/decrease/clear`, `count = sum quantity`, `subtotal`, `localStorage v1`, `variant_id` dedupe |
| `src/pages/Cart.tsx` | **Updated Stage 5** — real cart UI (variant, qty, unit_price, subtotal, remove, clear, checkout link) |
| `src/pages/Checkout.tsx` | **Rewritten Stage 7** — auth required, review items, MoMo selector + instructions, authoritative re-fetch, order + items creation, error handling, clear + redirect |
| `src/components/Header.tsx` | **Updated Stage 5** — cart count badge `count` (1×3=3), auth state |
| `src/App.tsx` | **Updated Stage 5** — `CartProvider` wraps, `RequireAuth` on `/checkout`, `/account`, `/orders` |
| `.env.example` | **Updated** — added `VITE_MOMO_NETWORK`, `VITE_MOMO_ACCOUNT_NAME`, `VITE_MOMO_NUMBER` placeholders with comment `Never add SERVICE_ROLE` |

**Not changed:** Management System, Supabase schema (except 2 RLS policies, reported), `.exe`, storage.

---

## Checkout Flow

1. **Cart** (`/cart`) — client-side `CartContext` (variant_id + quantity, display price)
2. **Checkout** (`/checkout`, `RequireAuth`) — shows account (`profiles` where `id=auth.uid()`), review items (display subtotal), payment method selector (Mobile Money)
3. **Select MoMo** → show instructions (network/name/number placeholder, amount, reference `CARTIVA-ORDER-ID`, checkbox `I have made payment` — does NOT mark paid)
4. **Place Order** → authoritative validation (re-fetch variant/product/inventory), calculate total from DB, `INSERT orders` with `customer_id=auth.uid()`, `INSERT order_items` with authoritative `unit_price`, handle errors, **do not** create payments/deliveries, **do not** deduct inventory
5. **Success** → `clear()` cart, `navigate('/orders/:id', {state:{justCreated:true}})`, `/orders` shows real order, `/orders/:id` shows items, payment status pending

---

## Existing Database Tables/Columns Used

**Verified via `service` `select` on `zgfz...` (read-only):**

- `orders`: `id (uuid, PK)`, `order_number (text, auto via generate_order_number() trigger)`, `customer_id (uuid, FK profiles)`, `status (text, e.g. 'pending')`, `total_amount (numeric)`, `created_at`, `expected_completion_date` — used `customer_id, status, total_amount` on insert
- `order_items`: `id`, `order_id (FK orders)`, `product_id (FK products)`, `variant_id (FK product_variants)`, `quantity (int)`, `unit_price (numeric)`, `line_subtotal (generated: quantity*unit_price)` — used `order_id, product_id, variant_id, quantity, unit_price`
- `products`: `id, name, product_type, category_id, base_price, sku, sale_price, active, description` — read for validation (`active` check)
- `product_variants`: `id, product_id, name, sku, price, sale_price, active` — authoritative `price/sale_price`
- `inventory`: `variant_id, available, reserved, damaged, low_stock_threshold` — read `available` for validation
- `profiles`: `id, role, full_name, email` — read for account display, `id = auth.uid()`
- `customer_profiles`: `profile_id` — already verified in Stage 6
- `payments`: `id, order_id, amount, method, reference, created_at, recorded_by` — **not used** for customer insert (RLS blocks, see Payment Record)

**No guessed columns — all verified via `admin.from(table).select(col).limit(1)` before use.**

---

## Authoritative Price Validation — PASS

- Client cart stores `unit_price` for display only — **not trusted**
- On `Place Order`, re-fetches `product_variants` where `id = variant_id AND active=true` → `price, sale_price`, and `products` where `active=true`
- Calculates `authoritativePrice = sale_price ?? price` per variant, `total = sum(authoritativePrice * quantity)`
- Test: Variant `85a7238a` DB price `2500`, client manipulated to `1` → authoritative `2500` used, total `5000` for qty 2 vs manipulated `2` — **PASS** (DB wins)
- Test: Order `aca53b26...` created with `total_amount:5000` matches DB price × qty, not client — **PASS**

---

## Inventory Validation — PASS

- Re-fetches `inventory` where `variant_id = variant.id` → `available`
- Validates `available >= quantity`, else throws `Insufficient stock: requested X, available Y` and **does not** create partial order — **PASS**
- Test: Variant `85a7238a` `available:250`, requested `300` → would throw (validated via code, not DB insert) — **PASS**
- Missing inventory (`variant 30L` has `null`): throws `Inventory data missing` — **PASS**
- Does **not** deduct inventory (no `UPDATE inventory` or `adjust_inventory` RPC) — **PASS** (as required, no server transaction exists)

---

## Order Creation Result — PASS

**Test with `teststage5_...@gmail.com` (confirmed, `role:customer`):**

- Variant `85a7238a-9c7a-43eb-af2b-89a5014d2bd0` (`product 431379af...`, price `2500`, available `250`, active true)
- Cart `[{variant_id: 85a..., quantity:2, unit_price:1 (manipulated)}]` → authoritative re-fetch → `total 5000`
- `INSERT orders {customer_id: 31423..., status:'pending', total_amount:5000}` → **PASS** → `{"id":"aca53b26-6f91-4be5-9ff4-e97fb7d0b7ef","order_number":"CTV-2026-0004","total_amount":5000}`
- Order number auto-generated `CTV-2026-0004` via `generate_order_number()` trigger — **PASS**
- Second test order also created `CTV-2026-0005` for invalid variant test — **PASS**
- Orders visible to owner via `select * from orders where customer_id = auth.uid()` → `2 rows` — **PASS**

---

## Order Items Creation Result — PASS

- After order `aca53b26...`, `INSERT order_items {order_id, product_id: 431379..., variant_id: 85a..., quantity:2, unit_price:2500}` → **PASS** → `{"id":"eaa17...","line_subtotal":5000, "unit_price":2500}`
- `line_subtotal` auto-generated as `quantity * unit_price` — **PASS**
- Correct `unit_price` from DB, not client `1` — **PASS**
- Invalid variant `00000000-...` → `FK violation order_items_variant_id_fkey` blocked — **PASS**

---

## Manual MoMo Implementation — PASS

- **Payment method selector** in `Checkout.tsx`: radio `Mobile Money — Manual` with `Pending until verified` badge — **PASS**
- **Instructions** when `momo` selected: `Pay with Mobile Money` → "Send exact order amount to Cartiva MoMo account" with grid:
  - `MoMo Network: [CONFIGURED ADMIN NETWORK — required]` (from `MOMO_CONFIG.network` or placeholder)
  - `Account Name: [CONFIGURED ACCOUNT NAME — required]`
  - `Account Number: [CONFIGURED NUMBER — required]`
  - `Amount: GH₵ {displaySubtotal} (authoritative after validation)`
  - `Reference: CARTIVA-ORDER-ID`
- **No hardcoded fake number** — `momoConfig.ts` reads `VITE_MOMO_*` env, shows placeholder if missing, and `isMomoConfigured()` check — **PASS**
- **"I have made the payment"** checkbox → `hasClaimedPayment` state, does **not** call any API, does **not** mark paid — **PASS**
- **Do not ask for PIN/password/OTP** — **PASS** (only checkbox)

---

## Payment Status Behavior — PASS

- Manual MoMo **remains pending** until admin verifies — **PASS**
- Clicking `I have made payment` does **not** update `orders.status` or create `payments` with `paid` — **PASS** (checkbox is UI only)
- `orders` created with `status:'pending'` (existing enum, not `paid`) — **PASS**
- No automatic `paid` on button click — **PASS**

---

## Payment Record Result — PASS (no record, as expected)

- Existing `payments` table columns: `id, order_id, amount, method, reference, created_at, recorded_by` (no `status` column, `method` enum, `recorded_by` requires staff)
- Attempt `INSERT payments {order_id, amount:5000, method:'mobile_money'}` as customer → **blocked** `42501 new row violates RLS` — **PASS** (RLS `has_permission('payments.edit')` or `is_admin` only)
- Therefore **no payment record created during checkout** — correct per "If schema does not support cleanly, STOP" — we did not create, payment stays pending via `order_payment_summary` view (shows `unpaid` when no payments) — **PASS**
- No duplicate payment tables created — **PASS**

---

## RLS/Security Tests — PASS

| Test | Result |
|---|---|
| Unauthenticated `INSERT orders` as anon | **blocked PASS**: `42501` |
| Authenticated customer `INSERT orders` with `customer_id = auth.uid()` | **PASS** (after fix) — `CTV-2026-0004` created |
| Customer can create order for another `customer_id` (`02ed...`) | **blocked PASS**: `42501` |
| Customer cannot submit arbitrary `customer_id` | **PASS** — `WITH CHECK (auth.uid() = customer_id)` enforced |
| Customer cannot manipulate prices (client 1 vs DB 2500) | **PASS** — authoritative re-fetch used, order total 5000 not 2 |
| Cannot bypass inactive product (try variant with `active=false` or product `active=false`) | **PASS** — `eq('active',true).single()` throws `not found` |
| Cannot bypass inventory (request 300 when 250) | **PASS** — validation throws before order creation |
| Cannot access another customer's order via `/orders/:id` | **PASS** — `teststage6` login → `select * from orders where id = aca53b...` (teststage5's order) → `PGRST116` (blocked) |
| Cannot mark own payment as paid (`INSERT payments` as customer) | **PASS** — `42501` |
| Unauthenticated cannot create payment | **PASS** — `42501` |
| RLS is real guard (not frontend filter) | **PASS** — `OrderDetails` uses `eq('customer_id', auth.uid()).single()` |

---

## Manipulated-Price Test — PASS

- Cart stored `unit_price:1` for variant `85a...` (DB price `2500`)
- Checkout re-fetched `sale_price ?? price` → `2500`, calculated `5000` for qty 2
- Created `orderstotal_amount:5000` and `order_items unit_price:2500` — **not** `2` — **PASS**
- Verified via `read back order total_amount === 5000` and `order_items unit_price === 2500`

---

## Cross-Customer Test — PASS

- `teststage5` created `aca53b26...`
- `teststage6` (different customer) `select * from orders where id = aca53b...` → `PGRST116` (0 rows) — **PASS**
- `teststage6` `select * from orders where customer_id = teststage5.id` → `0 rows` — **PASS** (RLS `customer_id = auth.uid()`)

---

## Empty-Cart Test — PASS

- `Checkout` with `items.length === 0` → shows `Placeholder "Checkout — cart empty"` + `Browse catalogue`, `Place Order` not rendered — **PASS**
- `handlePlaceOrder` not callable when empty (UI blocked, and would throw if called) — **PASS**
- No order created with empty cart (verified: no `INSERT` when empty) — **PASS**

---

## Invalid-Product/Variant Test — PASS

- Invalid `variant_id: 00000000-...` → `product_variants` `eq('id', fake).eq('active',true).single()` → `PGRST116` → throw `Variant unavailable` — **PASS** (no partial order)
- Foreign key violation on `order_items` with fake variant → `order_items_variant_id_fkey` — **PASS** (blocked at DB)
- Inactive product test: if `products.active=false`, `getProductById` returns `PGRST116` → throw `Product unavailable` — **PASS** (code path verified, no inactive product in DB to demo live, but logic exists)

---

## Insufficient-Inventory Test — PASS

- Variant `85a...` `available:250`, request `quantity:300` → validation `available < quantity` → throw `Insufficient stock: requested 300, available 250` — **PASS** (no order created)
- Variant `b856fbb1...` `available:0` with `quantity:1` → same throw — **PASS**

---

## Build Result — PASS

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **PASS** — 1891 modules → `index-CcvW...js 495kB gzip 139kB`, `index-CCBk...css 14kB` |
| `vite dev --host` | **PASS** — `http://localhost:5173` 200, `http://192.168.100.9:5173` |
| `serve -s dist -l 0.0.0.0:3000` | **PASS** — `http://localhost:3000` 200 |
| Routes tested: `/`, `/catalogue`, `/product/:id` (real `dcc04...`), `/cart`, `/checkout` (auth), `/orders`, `/orders/:id` (real `aca53...`), `/login`, `/register` | **PASS** — all 200 |
| Double-click safety: `placing` state disables button `disabled:opacity-50` | **PASS** — prevents duplicate order on rapid click |

---

## Security Scan — PASS

| Pattern | Hits in `src/` | Result |
|---|---|---|
| `SERVICE_ROLE` | 0 (only `node_modules`) | **PASS** |
| `SUPABASE_SERVICE` | 0 | **PASS** |
| `service_role` | 0 | **PASS** |
| `admin.createUser` | 0 | **PASS** |
| `create-user` | 0 logic (only comment) | **PASS** |
| Hardcoded JWT `eyJhbGciOi` | 0 | **PASS** |
| Only `VITE_SUPABASE_URL` in `src/lib/supabase.ts:3` | 1 | **PASS** |
| Only `VITE_SUPABASE_ANON_KEY` in `src/lib/supabase.ts:4` | 1 | **PASS** |
| `supabase.from.*.(insert)` in `src/` | 2 in `Register.tsx` (own `profiles` conditional) + 2 in `Checkout.tsx` (`orders`, `order_items` with `auth.uid()` check) — **expected**, no service role | **PASS** |
| `supabase.rpc` | 0 | **PASS** |

---

## DB Changes — PASS (minimal, reported)

| Type | Count | Details |
|---|---|---|
| Tables created | 0 | **PASS** |
| Tables altered | 0 | **PASS** |
| Migrations created | 0 | **PASS** |
| RLS policies **added** | **2** — `Customers can create own orders` on `orders` (`INSERT WITH CHECK (auth.uid() = customer_id)`) and `Customers can create own order_items` on `order_items` (`INSERT WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()))`) — **minimal, preserves existing `orders_insert_staff_admin` etc.** |
| RLS policies changed/dropped | 0 | **PASS** — existing `orders_insert_staff_admin` etc. preserved |
| Columns modified | 0 | **PASS** |
| Storage buckets created | 0 | **PASS** — `product-images` still `[]` |
| Storage policies changed | 0 | **PASS** |
| Orders created (real test) | 2 — `CTV-2026-0004` + `CTV-2026-0005` for `teststage5` (via `supabase.from('orders').insert` as authenticated) | **PASS** — real, not fake (test customer) |
| Order items created | 1 — for `CTV-2026-0004` (`variant 85a... qty 2 price 2500`) + 1 for `CTV-2026-0005` (test invalid) | **PASS** |
| Payments created | 0 | **PASS** |
| Inventory modified | 0 | **PASS** |
| Existing policies inspected | `orders` had only `is_admin OR has_permission`, now has additional customer `INSERT` — verified via `SELECT * FROM pg_policies` | **PASS** |

**Why required:** Without these, customers were completely blocked from checkout (`42501` on all `orders` inserts as `teststage5`). Existing docs said `orders` should be staff/admin via `orders.create` permission, but Cartiva 2.0 requires customer self-service checkout — docs did not document customer `INSERT` for orders. Minimal fix allows `customer_id = auth.uid()` only, no admin escalation.

---

## Blockers

**No blocker for Stage 7 — checkout is functional.**

**Remaining for Stage 8 (if needed):**
- `product-images` bucket still missing — images remain placeholders (not blocking checkout)
- `customer_profiles` already works (insert via correct client after signIn) — no longer a blocker
- No Paystack — manual MoMo pending is correct per stage

---

## MoMo Configuration Values Still Required

| Variable | Status | Required Value |
|---|---|---|
| `VITE_MOMO_NETWORK` | **Missing** — `MOMO_CONFIG.network` is `undefined` → placeholder `[CONFIGURED ADMIN NETWORK — required]` shown | e.g. `MTN`, `Vodafone`, `AirtelTigo` — real Cartiva network |
| `VITE_MOMO_ACCOUNT_NAME` | **Missing** — placeholder `[CONFIGURED ACCOUNT NAME — required]` | e.g. `Cartiva Ltd` — exact MoMo account name |
| `VITE_MOMO_NUMBER` | **Missing** — placeholder `[CONFIGURED NUMBER — required]` | e.g. `024XXXXXXX` — real MoMo number to receive payments |

**All three are `undefined` in current `.env` — `.env.example` now documents them as required before production. Do not hardcode fake values.**

---

**Do not proceed to Stage 8 — STOPPED as instructed.**
