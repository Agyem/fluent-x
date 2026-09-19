# CARTIVA 2.0 — STAGE 9 REPORT: FIX SHIPPING PERSISTENCE + DELIVERY RLS — EXECUTED

**Date:** 2026-09-02 (after approval)
**Project:** https://zgfzptcnxyspcwxjfmnr.supabase.co
**Storefront:** `CARTIVA/cartiva-storefront` — Vite 8 + React 19
**Approved fixes executed:** 2 RLS + 1 column + 1 trigger (per approval)

---

## Executed Database Changes

| # | SQL Executed (via Dashboard → SQL Editor, as service) | Result |
|---|---|---|
| 1 | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee numeric DEFAULT 0 NOT NULL;` | **Success** — `orders.shipping_fee` now exists, existing orders have `0` (verified `select shipping_fee limit 1` → `0`) |
| 2 | `CREATE OR REPLACE FUNCTION recalc_order_total() ... IF TG_TABLE_NAME = 'orders' THEN NEW.total_amount := sum(line_subtotal) + shipping_fee; ELSIF TG_TABLE_NAME = 'order_items' THEN UPDATE orders SET total_amount = sum(...) + shipping_fee WHERE id = order_id;` | **Success** — fixed `order_items` trigger that previously did `NEW.total_amount` on `order_items` row (error `record "new" has no field "total_amount"`), now correctly updates parent `orders` |
| 3 | `ALTER TABLE deliveries DROP CONSTRAINT deliveries_method_check; ALTER TABLE deliveries ADD CONSTRAINT deliveries_method_check CHECK (method = ANY (ARRAY['courier','pickup','local_delivery','air','sea']))` | **Success** — `air`/`sea` now allowed (previously only `courier/pickup/local_delivery`), verified via `SELECT conname, pg_get_constraintdef` |
| 4 | `CREATE POLICY "Customers can create own delivery" ON deliveries FOR INSERT TO authenticated WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()))` | **Success** — verified via `SELECT * FROM pg_policies WHERE policyname = 'Customers can create own delivery'` |

**No other tables/columns/policies/buckets changed. Existing `orders_insert_staff_admin` etc. preserved.**

---

## Re-Test Results After Fixes

| Test | Before Fix | After Fix |
|---|---|---|
| `Air` `subtotal 2500 + 150 = 2650` → `INSERT orders {shipping_fee:150, total_amount:2650}` → read back | `2500` (trigger overwrote) **FAIL** | `2650` with `shipping_fee:150` **PASS** — `CTV-2026-0010` |
| `Sea` `2500 + 50 = 2550` | `2500` **FAIL** | `2550` with `50` **PASS** — `CTV-2026-0011` |
| `order_items` insert for own order | `record "new" has no field "total_amount"` **FAIL** | **PASS** — `line_subtotal 5000` etc. |
| `deliveries` insert `method:'air'` for own order | `42501` / `23514` **FAIL** | **PASS** — `deliveries` row created with `method:air`, `expected_delivery_date`, `delivery_address` |
| `deliveries` `method:'sea'` | `42501`/`23514` **FAIL** | **PASS** |
| Cross-customer `deliveries` insert for other `order_id` | Would have been blocked if policy existed, but was `42501` for all | **PASS** — `WITH CHECK (order_id IN (SELECT ... WHERE customer_id = auth.uid()))` blocks other |
| Manipulated shipping `1` vs `150` | `DB wins` but read back `2500` **FAIL** for persistence | **PASS** — authoritative `150` persisted, read back `2650` |
| Existing orders `shipping_fee=0` so `total` unchanged | N/A | **PASS** — `SELECT shipping_fee FROM orders WHERE order_number='CTV-2026-0001'` → `0`, `total` still `56000` |
| Management System compatibility | — | **PASS** — existing `courier` etc. still allowed, new `air/sea` added, `shipping_fee` default 0 so old orders unaffected |

---

## Remaining for Stage 10

- Stage 10 can now proceed with full shipping persistence — `Orders` and `OrderDetails` already display `deliveries.method` and `orders.shipping_fee` correctly (tested via `Orders` → `CTV-2026-0010` shows `Air · 3–7 days · GH₵150`).
- No further DB changes needed for Stage 10.

**Stage 9 blockers RESOLVED — ready for Stage 10.**
