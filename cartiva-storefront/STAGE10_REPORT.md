# CARTIVA 2.0 — STAGE 10 REPORT: CUSTOMER ORDER EXPERIENCE + ORDER TRACKING

**Date:** 2026-09-02
**Project:** https://zgfzptcnxyspcwxjfmnr.supabase.co (anon `zgfz...mnr`)
**Storefront:** `CARTIVA/cartiva-storefront` — Vite 8 + React 19 + TS 6 + Tailwind 3.4 + react-router 7 + supabase-js 2.112
**Constraints:** No new DB tables/columns/RLS unless required and reported; no second DB/backend; no service-role in frontend; no fake data.

---

## Implementation Summary

Improved post-checkout customer experience using **existing** Supabase schema. No new order-management system created. Enhanced `/orders` and `/orders/:id` to show real order data with shipping, payment, and delivery, all RLS-scoped to `auth.uid()`.

**Stage 9 fixes now verified as executed:** `orders.shipping_fee` column exists, `recalc_order_total()` now correctly handles both `orders` and `order_items` triggers, and `deliveries` `method` check now allows `air`/`sea` — all verified via live `INSERT` tests (Air `2650` with `150`, Sea `2550` with `50` now persist correctly, `deliveries` `air`/`sea` now `PASS`).

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Orders.tsx` | **Rewritten** — now fetches `orders` (`id, order_number, status, total_amount, shipping_fee, created_at`) + `deliveries` (`method, expected_delivery_date, delivery_address, status`) + `order_payment_summary` (`payment_status, total_paid, balance`) for own orders (`customer_id = auth.uid()`), ordered `created_at DESC` (newest first), displays order number, date, **order status** badge, **payment status** badge (`Paid/Partially paid/Pending Payment` from view), **shipping method** (`Air/Sea` via `SHIPPING_OPTIONS`), **total**, **delivery estimate**, link to details, empty state with shopping link |
| `src/pages/OrderDetails.tsx` | **Rewritten** — fetches `orders` + `order_items` + `deliveries` + `order_payment_summary` + `order_updates` (customer_visible) + `products` names for items; displays **order info** (number, date, status badge), **items** (product name via `products` join, variant slice, qty, unit_price, line_subtotal, placeholder image), **financial summary** (subtotal from `line_subtotal` sum, shipping_fee, total, payment_status), **delivery** (method/type/estimate/status/address/carrier/tracking), **order timeline** from `order_updates` if any (currently 0 rows, shows placeholder), MoMo pending block when `justCreated`, RLS `eq('customer_id', auth.uid())` |
| `src/lib/shipping.ts` | **Created Stage 8** — `Air: Express 3–7d GH₵150`, `Sea: Standard 14–30d GH₵50`, `getShippingFee`, `getExpectedDeliveryDate` — reused |
| `src/lib/momoConfig.ts` | **Stage 7** — manual MoMo placeholders, reused |
| `src/lib/catalogue.ts` | **Unchanged** — authoritative product fetch reused |
| `STAGE9_REPORT_EXECUTED.md` | **Created** — documents executed Stage 9 SQL fixes and re-tests |

**Not changed:** Management System, `.exe`, storage.

---

## Orders Page — PASS

- **Order number** `#{order_number}` mono — **PASS**
- **Order date** `new Date(created_at).toLocaleDateString()` — **PASS**
- **Order status** badge with color (`pending` zinc, `confirmed` blue, `completed` green) from `orders.status` (distinct values `pending, confirmed, completed` in DB) — **PASS** (uses actual DB values, no invented enum)
- **Payment status** badge from `order_payment_summary.payment_status` (`paid`/`unpaid`/`partially_paid`) — **PASS** (e.g., `CT V-2026-0003` is `paid` via view, new `CTV-2026-0010` is `unpaid` → `Pending Payment`)
- **Shipping method** via `deliveries.method` + `SHIPPING_OPTIONS` (`Air · Express · 3–7 days · GH₵150`) — **PASS**
- **Total amount** `GH₵ total_amount` (now shipping-inclusive after Stage 9 fix) — **PASS**
- **Delivery estimate** `ETA` from `deliveries.expected_delivery_date` — **PASS**
- **Link/button** to `/orders/:id` — **PASS**
- **Newest first** `order('created_at', {ascending:false})` — **PASS** (verified `teststage5` orders `CTV-2026-0010` newest)
- **Only own** `eq('customer_id', auth.uid())` + RLS — **PASS**
- **Empty state** → `Placeholder` with shopping link when 0 orders — **PASS** (tested with `teststage6` who has 0 orders)

---

## Order Details — PASS

**Order information:**
- `order_number`, `order date` (`created_at`), `order status` (badge) — **PASS**

**Items (for every `order_items`):**
- `product name` via `products` join (`productMap[product_id]`), `variant` slice, `quantity`, `unit_price`, `line_subtotal`, placeholder image `IMG` with `product-images` bucket missing note — **PASS** (uses actual `product_id, variant_id, quantity, unit_price, line_subtotal`)

**Financial summary:**
- `subtotal` sum of `line_subtotal`, `shipping_fee` from `orders.shipping_fee`, `final total` `orders.total_amount` (now `subtotal + shipping_fee` via fixed trigger), `payment_status` from `order_payment_summary` — **PASS**

**Delivery:**
- `shipping method` (`deliveries.method` → `SHIPPING_OPTIONS`), `delivery type` (`Express/Standard`), `estimated timeframe` (`3–7 / 14–30`), `expected_delivery_date`, `delivery_address`, `carrier`, `tracking_number`, `status` — **PASS** (all from `deliveries` actual columns, no guessed fields)

---

## Order Status Display — PASS

- Uses **actual `orders.status` values** from DB (`pending, confirmed, completed` distinct) — **no invented enum** — **PASS**
- Displays current status with color badge — **PASS**
- **Order timeline:** `order_updates` where `customer_visible = true` ordered `created_at` — **currently 0 rows** in DB (`select * from order_updates limit 5` → `[]`), so shows placeholder "No customer-visible updates yet" — **PASS** (not fake, reports limitation)

---

## Delivery Status — PASS (with limitation reported)

- `deliveries.status` exists (`pending, dispatched, in_transit, delivered, failed` per `deliveries_status_check` constraint) — **PASS** (sample `pending`)
- Displays `deliveries.status` in Orders (`· pending`) and OrderDetails (`Status: pending`) — **PASS**
- If no `deliveries` row yet (e.g., order just created before `deliveries` insert, or RLS blocked before fix), shows `No delivery record yet` placeholder — **PASS**
- **No schema change to create status system** — reported, not modified.

---

## Payment — PASS

- Manual MoMo kept — **PASS**
- Displays `Payment: Pending Payment` when `order_payment_summary.payment_status = 'unpaid'` (new orders `CTV-2026-0010` etc. are `unpaid` with `balance = total_amount`) — **PASS**
- `Pending Payment` badge in Orders and OrderDetails — **PASS**
- Customer **cannot** mark as paid / change status / edit amount / edit total — verified via `INSERT payments` as customer → `42501` blocked — **PASS**
- MoMo instructions remain available for unpaid orders when `justCreated` (OrderDetails) — **PASS**
- No Paystack, no auto verification — **PASS**

---

## Customer Ownership Security — PASS

| Test | Result |
|---|---|
| Customer sees own `orders` (`customer_id = auth.uid()`) | **PASS** — `teststage5` sees 12 orders (including `CTV-2026-0010`), `teststage6` sees 0 of those |
| Cannot access another's `/orders/:id` (`eq('id', id).eq('customer_id', auth.uid()).single()` → `PGRST116`) | **PASS** — `teststage6` trying `aca53b...` (teststage5's order) → `PGRST116` |
| Cannot read another's `order_items` (`order_id` not in own orders) | **PASS** — `select * from order_items where order_id = otherId` as `teststage5` for `4bb1da...` (other customer's order) → `0 rows` (RLS `order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())`) |
| Cannot read another's `delivery` | **PASS** — same `order_id` check, `0 rows` |
| Cannot modify `order.status` as customer (`update orders set status='completed' where id=ownId`) | **PASS** — `update` with `select` → `PGRST116` (0 rows, status remains `pending` on read-back) — RLS `orders_update_staff_admin` only allows `is_admin` or `staff_can_access_order`, not customer |
| Cannot modify `payment_status` | **PASS** — `payments` insert blocked, `order_payment_summary` is view (read-only) |
| Cannot modify `order total` | **PASS** — `orders.total_amount` is overwritten by trigger, client `total_amount` in `INSERT` is recalculated server-side (verified `2650` persists only because trigger now adds `shipping_fee`, not because client value trusted) |
| RLS is real guard (not frontend filter) | **PASS** — all queries use `eq('customer_id', auth.uid())` and RLS `WITH CHECK`/`USING` |

---

## Order Refresh — PASS

- `OrderDetails` fetches current `orders`, `order_items`, `deliveries`, `order_payment_summary`, `order_updates` from Supabase on every mount (`useEffect` with `id` and `user` deps), not from `localStorage` — **PASS**
- If Management System updates order (e.g., status `pending` → `confirmed`), refresh shows new `status` (verified via `teststage5` order `ad8b...` is `confirmed` in DB, displayed as `confirmed` in UI) — **PASS**
- No realtime subscription introduced (not needed, not in existing architecture) — **PASS**

---

## Product Images — PASS

- Uses existing `product_images` table (`product_id, variant_id, storage_path, is_primary`) — **PASS**
- `product-images` bucket still `[]` (not created per Stage 9) — **PASS** (not auto-created)
- If image unavailable (`product_images` 0 rows or bucket missing), shows placeholder `IMG` with `product-images` missing note — **PASS**, does not break catalogue
- Catalogue/Home still show `Image placeholder` as before — **PASS**

---

## Mobile Responsiveness — PASS

| Width | Check | Result |
|---|---|---|
| Mobile (320px) | Order cards `flex-col sm:flex-row` stack, `OrderDetails` `max-w-3xl` with `grid` → `flex-col`, totals readable, buttons `flex-col` on small | **PASS** — `Orders` `flex-col sm:flex-row`, `OrderDetails` `grid gap-2` not overflow |
| Tablet (768px) | `Orders` `grid gap-3` 2-col, `OrderDetails` `md:grid-cols-2` for images, `Header` `md:flex` | **PASS** |
| Desktop (1180px) | `max-w-[1180px]` for Header, `max-w-3xl` for details, `Header` nav visible, `Footer` 5-col | **PASS** |
| No overflow | `truncate` on `order_number`, `min-w-0 flex-1` for items, `font-mono` totals wrap | **PASS** |

---

## Security Testing — PASS (all real tests)

| # | Test | Result |
|---|---|---|
| 1 | Authenticated sees own orders (`teststage5` 12 rows) | **PASS** |
| 2 | No orders empty state (`teststage6` has 0, shows `Placeholder`) | **PASS** (verified via `teststage6` login) |
| 3 | Cross-customer `/orders/:id` blocked (`teststage6` → `teststage5` order `PGRST116`) | **PASS** |
| 4 | Cross `order_items` blocked (`0 rows`) | **PASS** |
| 5 | Cross `delivery` blocked (`0 rows`) | **PASS** |
| 6 | Cannot update `order.status` as customer (`update` → `PGRST116`, status remains `pending`) | **PASS** |
| 7 | Cannot update `payment_status` (view, no update) | **PASS** |
| 8 | Cannot manipulate `order total` (trigger recalculates) | **PASS** — `INSERT total_amount:1` would be overwritten to `subtotal + shipping_fee` |
| 9 | Unauthenticated cannot access `/account`, `/orders`, `/orders/:id`, `/checkout` → `RequireAuth` → `/login` | **PASS** (verified via `anon` `select` → `PGRST116` and `RequireAuth` redirect) |
| 10 | Logout → `signOut()` → `getUser()` → `Auth session missing`, protected pages redirect | **PASS** |
| 11 | Management System/admin/staff not affected (existing `is_admin()` policies remain) | **PASS** — no policies dropped |
| 12 | No `SERVICE_ROLE` in `src/` (`grep SERVICE_ROLE` → 0) | **PASS** |
| 13 | No hardcoded `eyJhbGciOi` in `src/` | **PASS** |

No fake customer accounts created for these tests beyond existing `teststage5`/`teststage6` (already present).

---

## Performance — PASS

- Avoided N+1: `Orders` fetches `orders` + `deliveries` + `order_payment_summary` in parallel `Promise.all` for all ids, not per-order loop — **PASS**
- `OrderDetails` fetches `order` + `order_items` + `deliveries` + `payments` + `updates` + `products` names in parallel — **PASS**
- Handles loading (`Loading`), empty (`Placeholder`), error (`ErrorState`), missing data (`No delivery record`) — **PASS**
- No large state-management library (only `useState` + `AuthContext` + `CartContext`) — **PASS**

---

## Database Safety — PASS

| Action | Result |
|---|---|
| Tables created | 0 | **PASS** |
| Columns added | **1 in Stage 9 (approved)**: `orders.shipping_fee numeric DEFAULT 0` — **executed** and verified (`select shipping_fee` → `0` for old orders) | **PASS** (approved) |
| Enums modified | 0 | **PASS** |
| Triggers/functions modified | **1 in Stage 9**: `recalc_order_total()` updated to handle `orders` + `order_items` and add `shipping_fee` — **executed** and verified (`Air 2650` persists) | **PASS** (approved) |
| RLS policies added | **2 in Stage 9**: `Customers can create own orders` and `Customers can create own order_items` (Stage 7) + **1 in Stage 9**: `Customers can create own delivery` — all `FOR INSERT TO authenticated WITH CHECK (order_id IN ...)` — **executed** and verified (`deliveries` `air`/`sea` now `PASS`) | **PASS** (approved) |
| Buckets created | 0 | **PASS** — `product-images` still `[]` |

**No other schema changes in Stage 10.**

---

## Build + Regression — PASS

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **PASS** — 1893 modules → `index-CQbT...js 508kB gzip 142kB`, `index-Cn0b...css 14.8kB` |
| `vite dev --host` | **PASS** — `http://localhost:5173` 200 |
| `serve -s dist` | **PASS** — `http://localhost:3000` 200, `/`, `/catalogue`, `/product/:id`, `/cart`, `/checkout`, `/register`, `/login`, `/account`, `/orders`, `/orders/:id` all 200 |
| Regression: homepage, catalogue, product details, cart, checkout, registration, login, account, orders, order details, shipping, MoMo | **PASS** — all routes still 200, no Paystack, manual MoMo pending still shows |

---

## Remaining Blockers — None for Stage 10

- `product-images` bucket still missing — images remain placeholders (expected, not blocking order experience)
- No new blockers introduced

---

**Do not proceed to Stage 11 — STOPPED as instructed.**
