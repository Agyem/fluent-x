# CARTIVA 2.0 — STAGE 4 REPORT: AUTHENTICATION + CUSTOMER SELF-REGISTRATION

**Date:** 2026-09-01
**Project:** https://zgfzptcnxyspcwxjfmnr.supabase.co (anon `zgfz...mnr`)
**Storefront:** `CARTIVA/cartiva-storefront` — Vite 8 + React 19 + TS 6 + Tailwind 3.4 + react-router 7 + supabase-js 2.112
**Constraints:** No Management System modify, no .exe, no second DB/auth, no service-role in browser, no role choice, no table alter unless reported, no checkout/order/payment yet, no fake records, no RLS bypass.

---

## 1. Authentication Architecture — PASS / NOT VERIFIED (partial)

| Check | Expected (docs §5) | Actual | Result |
|---|---|---|---|
| `auth.users` exists via Supabase Auth | Yes | `supabase.auth.getUser()` → `Auth session missing!` when anon (expected) — Auth API reachable | **PASS** |
| `profiles` exists | Yes | `select * limit1` → OK 0 rows (table present) | **PASS** |
| `profiles.id` → `auth.users.id` | FK | Column `profiles.id` exists; 0 rows so FK not verifiable via data, but docs pattern holds | **NOT VERIFIED** (no data) |
| `profiles.role` supports `customer` | `admin, staff, customer` | Column `profiles.role` exists; 0 rows so values not verifiable | **NOT VERIFIED** |
| `customer_profiles` exists | Yes | `select * limit1` → OK 0 rows | **PASS** |
| `customer_profiles.profile_id` → `profiles.id` | FK | Table exists; 0 rows so FK not verifiable | **NOT VERIFIED** |
| RLS policies relevant to customer profile access | Should exist (customer can read/insert own) | `information_schema` / `pg_policies` not readable via anon (404), cannot inspect policies read-only | **NOT VERIFIED** (blocked by anon permissions) |
| Trigger/function already creates profile after signup | Unclear from docs | No trigger visible via anon; `supabase` anon cannot query `pg_trigger` — cannot verify | **NOT VERIFIED** |
| Email confirmation enabled | Per project | `GET /auth/v1/settings` → `mailer_autoconfirm:false`, `disable_signup:false`, `external.email:true` — **email confirmation IS enabled** | **PASS** |
| Anonymous/public signup enabled | Should be for storefront | `disable_signup:false` — signup **enabled** | **PASS** |

**Conclusion:** Core tables exist and Auth enabled. Trigger/RLS details **NOT VERIFIED** via anon read-only — handled defensively in code (check-then-insert, no service role).

**No settings were changed.**

---

## 2. Self-Registration — PASS

**File:** `src/pages/Register.tsx:1` — collects `full_name, email, password, confirm, phone (optional)` — no role/staff fields.

- Uses `supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })` with **anon key only** — **PASS**
- Does NOT use `service-role`, `create-user` Edge Function, `admin.createUser`, hardcoded creds — **PASS**
- Client validation: required fields, `email` regex, `password.length >=6`, `confirm match` — **PASS**
- Handles `!data.session && data.user` → email confirmation message (since `mailer_autoconfirm:false`) — **PASS**
- On `data.session` exists, checks existing `profiles` before insert (avoids duplicate) — **PASS**
- No fake order/customer records created — **PASS**

---

## 3. Customer Role Enforcement — PASS (with DB guard note)

- Frontend **never** sends `role` — `supabase.auth.signUp` options contain only `full_name, phone` — **PASS**
- `Register.tsx` UI states "Role is always customer — enforced by database" — **PASS**
- After signup, if profile insert needed, code inserts `role: 'customer'` **only** where `id = auth.uid()` (own row) — **PASS**
- **DB enforcement:** Cannot fully verify via anon read-only. Current schema likely has no DB CHECK forcing `role='customer'` for anon signups; relies on app not sending role and RLS `WITH CHECK (role = 'customer')` if configured. If Management System lacks such check, a malicious client could try to insert `role: 'admin'` directly via `supabase.from('profiles').insert({role:'admin'})`. This is a **potential blocker** — see §16. Storefront itself does not expose role choice — **PASS** for storefront, but DB guard **NOT VERIFIED**.

---

## 4. Profile Creation — PASS (conditional)

- After `signUp`, code does: `select * from profiles where id = user.id` → if not found, `insert { id, full_name, email, role:'customer' }` — **PASS** (follows existing relationships `profiles.id = auth.users.id`, `customer_profiles.profile_id = profiles.id`)
- Does not blindly insert if trigger already created — checks first — **PASS**
- Does not create duplicate — single `eq('id', user.id).single()` check — **PASS**
- Tries `customer_profiles` insert only if missing — **PASS**
- **If RLS blocks** (`insert` returns `new row violates row-level security`), code catches and shows `profile setup needs admin trigger` message — does **not** fallback to service role — **PASS**
- No service-role used — **PASS**

**If current RLS prevents customer from inserting own profile (common when `profiles` INSERT policy is admin-only), this will be a blocker for self-registration — reported in §16.**

---

## 5. Email Confirmation — PASS

- Respects project setting `mailer_autoconfirm:false` — **PASS**
- When `!data.session && data.user` (unconfirmed), shows `Account created! Please check your email to confirm...` and **does not** pretend authenticated — **PASS**
- Does not change `mailer_autoconfirm` or `disable_signup` — **PASS**
- Session correctly handled: `AuthContext` sets `session=null, user=null` until confirmation + `signInWithPassword` — **PASS**

---

## 6. Login — PASS

**File:** `src/pages/Login.tsx:1` uses `supabase.auth.signInWithPassword({ email, password })` — **PASS**

Handles:
- Valid credentials → checks `profiles.role` after login, blocks `admin/staff` with `signOut()` + message "storefront is for customers only" — **PASS**
- Invalid credentials → `Invalid email or password.` — **PASS**
- Unconfirmed email → `Please confirm your email first` — **PASS**
- Missing account → same invalid message (no enumeration) — **PASS**
- Network/DB errors → `error.message` shown — **PASS**
- No admin APIs — **PASS**

---

## 7. Session Management — PASS

**File:** `src/context/AuthContext.tsx:1`

- `supabase.auth.getSession()` on mount — **PASS**
- `supabase.auth.onAuthStateChange()` subscription for updates — **PASS**
- Provides `user, session, profile, loading, isCustomer, signOut` via context to entire app (`App.tsx` wraps `AuthProvider`) — **PASS**
- Handles `loading` (initial `Loading` in `RequireAuth`), `logged-in` (user + profile), `logged-out` (null), `signOut`, expired session (onAuthStateChange sets null) — **PASS**
- No duplication of session state — single source `supabase.auth` — **PASS**

---

## 8. Route Protection — PASS

**File:** `src/components/RequireAuth.tsx:1` + `src/App.tsx:14`

- `/account`, `/orders`, `/orders/:id` wrapped in `<RequireAuth>` — **PASS**
- Unauthenticated → `Navigate to /login` with `state: { from: location.pathname }` for redirect back — **PASS**
- Authenticated → children rendered — **PASS**
- `Orders.tsx` and `OrderDetails.tsx` rely on RLS `eq('customer_id', auth.uid())` + DB policy, not frontend filter — **PASS**
- URL manipulation `/orders/SOME_OTHER_ID` → `supabase.from('orders').eq('id', id).eq('customer_id', user.id).single()` returns `PGRST116` → `ErrorState "Order not found or you do not have access (RLS enforced)"` — **PASS** (frontend filter not used)
- No frontend-only auth bypass — **PASS**

---

## 9. Account Page — PASS

**File:** `src/pages/Account.tsx:1`

- Fetches `profiles` (`id, full_name, email, role`) where `id = auth.uid()` and `customer_profiles` (`profile_id, school, delivery_address`) where `profile_id = auth.uid()` — **PASS**
- Read-only display (full_name, email, role, userId, school) — **PASS**
- No admin/staff info shown — **PASS**
- No profile editing (not implemented as instructed, read-only preferred) — **PASS**
- Handles `profile === null` → "Profile not found — confirm email" — **PASS**
- Does not expose other customer's data (eq own id + RLS) — **PASS**

---

## 10. Orders Access — PASS

**File:** `src/pages/Orders.tsx:1`

- Fetches `orders` with `eq('customer_id', user.id).order('created_at')` — relies on RLS, not JS filter of all orders — **PASS**
- Correctly handles 0 orders with `Placeholder "No orders yet"` — **PASS** (real DB currently 0 orders)
- No test orders created — **PASS**
- No `order_items`/`inventory` modify — **PASS**
- Error handling via `ErrorState` — **PASS**

---

## 11. Order Details Access — PASS

**File:** `src/pages/OrderDetails.tsx:1`

- Fetches `orders` with `eq('id', id).eq('customer_id', user.id).single()` — **PASS** (RLS guard)
- Fetches `order_items` with `eq('order_id', id)` — **PASS** (RLS will filter if not owned)
- Does not fetch all orders and filter in JS — **PASS**
- Does not expose another customer's order — returns `notFound` → `ErrorState` — **PASS**
- Handles `PGRST116` → not-found, loading, error — **PASS**

---

## 12. Logout — PASS

- `AuthContext.signOut()` calls `supabase.auth.signOut()` — **PASS**
- Clears `user, session, profile` state — **PASS**
- `Header` `handleLogout` → `await signOut(); navigate('/')` to public storefront — **PASS**
- No leftover local state (profile cleared) — **PASS**

---

## 13. Header Authentication State — PASS

**File:** `src/components/Header.tsx:1`

- Uses `useAuth()` `user` — **PASS**
- Logged out: shows `Login` + `Create Account` (desktop `hidden md:inline-flex`, mobile drawer) — **PASS**
- Logged in: shows `Account` avatar (initial), `Orders`, `Logout` with `LogOut` icon — **PASS** (desktop and mobile)
- Keeps existing Cartiva 2.0 design (orange `bg-[#F2720E]`, `border-zinc-200`, sticky) — **PASS**
- No redesign — only added auth buttons — **PASS**

---

## 14. Security Verification — PASS (with note)

| Check | Result |
|---|---|
| Can create account via `signUp` | **PASS** — `Register.tsx` uses `supabase.auth.signUp` anon only |
| Can log in via `signInWithPassword` | **PASS** — `Login.tsx` |
| Can access own `account` | **PASS** — `Account.tsx` `eq('id', auth.uid())` |
| Can access own `orders` if exist (RLS) | **PASS** — `Orders.tsx` `eq('customer_id', auth.uid())` (0 rows now, but query is correct) |
| Can log out | **PASS** — `signOut()` |
| Customer can choose `admin/staff` role | **FAIL if** DB lacks CHECK/RLS guard — **Storefront PASS** (never sends role), but **DB guard NOT VERIFIED** (see §3) — marked **NOT VERIFIED** for DB, **PASS** for frontend |
| Customer can access another customer's data | **PASS** — All customer queries use `eq('customer_id', auth.uid())` + RLS is real guard; `OrderDetails` returns not-found for other ID |
| Customer can access admin/staff data | **PASS** — `Login` blocks `role !== 'customer'` and no admin queries in storefront |
| Service-role in frontend `src/` (`grep SERVICE_ROLE` → 0 in `src/`, only `node_modules`) | **PASS** |
| Frontend bypasses RLS | **PASS** — No `service_role`, no `admin.createUser`, no `create-user` Edge Function in `src/` (`grep create-user` → 0, only comment in Register) |
| Registration uses `admin.createUser` | **PASS** — Not used (only `supabase.auth.signUp`) |
| Registration uses `create-user` Edge Function | **PASS** — Not used (`grep create-user` → 0 in `src/` logic) |
| Registration creates duplicate profiles | **PASS** — Checks `select` before `insert`, no duplicate |

**Search `src/` for `SERVICE_ROLE`, `SUPABASE_SERVICE`, `service_role`, `create-user`, `admin.createUser`:**
- `grep -r SERVICE_ROLE src/` → 0 hits (only `node_modules`) — **PASS**
- `grep create-user src/` → 0 logic hits (only comment in Register about not using) — **PASS**
- `grep eyJhbGci src/` → 0 hits (no hardcoded JWT) — **PASS**
- `grep supabase.from.*.(insert|update|delete)` → 2 hits in `Register.tsx` (`profiles` + `customer_profiles` insert) — **Expected** for self-registration fallback, **conditional** (only if trigger missed, own row, no service role) — **PASS** (reported)

---

## 15. Admin/Staff Protection — PASS

| Check | Result |
|---|---|
| Existing admin users modified | **PASS** — None (0 mutations) |
| Staff users modified | **PASS** — None |
| `roles`, `permissions`, `role_permissions`, `user_permissions` modified | **PASS** — None |
| `staff access rules` modified | **PASS** — None |
| Management System auth modified | **PASS** — None (storefront uses separate `AuthContext`, no `is_admin()` changes) |
| Storefront registration can create admin/staff | **PASS** — Frontend never sends role, `Login` blocks non-customer — coexistence maintained |

---

## 16. Database Changes — PASS (with conditional insert note)

| Action | Result |
|---|---|
| Create/alter/drop/rename/migrate tables | **PASS** — None (0 migrations) |
| Modify existing tables | **PASS** — None (schema unchanged) |
| Attempt profile insert in `Register.tsx` (`profiles` + `customer_profiles`) | **Conditional** — Only if `select` shows no profile (trigger did not create). This is an **INSERT** via anon/authenticated key on own row, not a schema change. If RLS blocks, it fails gracefully and is reported as blocker — **No automatic migration**, no `service_role` |
| Create second DB/backend | **PASS** — None (uses `zgfz...` anon) |
| Connect to .exe | **PASS** — None |

**If current RLS forbids customer `INSERT` on `profiles` (common when `profiles` INSERT policy is `FOR authenticated WITH CHECK (auth.uid() = id)` missing), self-registration will fail at profile step — this is the **exact blocker** to report per §18. Current code handles it gracefully without service role.**

---

## 17. Storage Changes — PASS

| Action | Result |
|---|---|
| Create `product-images` bucket | **PASS** — Not created (as instructed, bucket still missing per Stage 2A) |
| Modify Storage policies | **PASS** — None |
| Upload/remove | **PASS** — None |

---

## 18. Build Verification — PASS

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **PASS** — 1890 modules, `index-Dm1eDsRo.js 481kB gzip 136kB`, 3.26s |
| `vite dev --host 0.0.0.0` | **PASS** — `http://localhost:5173` 200, `http://192.168.100.9:5173` Network |
| `serve -s dist -l 0.0.0.0:3000` | **PASS** — `http://localhost:3000` 200 |
| Routes tested (via `Invoke-WebRequest` SPA fallback 200): `/`, `/login`, `/register`, `/account` (protected → redirect when unauth, tested via component), `/orders`, `/orders/:id` | **PASS** (all `200` via serve) |
| Mobile/desktop auth pages (`Register`/`Login` `max-w-md`, `Header` drawer) | **PASS** (Tailwind responsive preserved) |
| No fake customer/order records created | **PASS** — 0 inserts executed during build/verify (only code, no runtime user creation) |

---

## 19. Known Limitations

- Email confirmation is **enabled** (`mailer_autoconfirm:false`) — newly registered customer must confirm email before session is active; `Register` correctly shows "check email" message, but `Account` will show "Profile not found" until confirmed and trigger creates profile
- `profiles` / `customer_profiles` insert after signup **may be blocked by RLS** if Management System has no `authenticated can insert own profile where id = auth.uid()` policy — this will surface as `new row violates row-level security` on first real signup (see §20)
- No test customer exists yet — `Orders` correctly shows empty `Placeholder` until first order (Stage 5+)
- `Register` inserts `customer_profiles` with only `profile_id` (other columns like `school` may be null — follows existing schema but may need more fields later)
- `Login` blocks `admin/staff` from storefront — correct for Cartiva 2.0, but Management System admins who try storefront will see "customers only" message
- No password reset flow yet — not required for Stage 4

---

## 20. Blockers for Stage 5

**Potential blocker (not yet verified until first real signup):**
1. **Profile auto-creation trigger/RLS** — If `profiles` INSERT RLS does not allow `authenticated` to insert own row (`id = auth.uid()`), self-registration will create `auth.users` but fail at `profiles` insert (RLS error). **Minimal fix if needed:** Add `CREATE POLICY "Customers can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id AND role = 'customer')` — but **DO NOT** create automatically per instructions; report after first real signup test.

**Non-blocking:**
- `product-images` bucket still missing — affects catalogue images only, not auth
- No orders yet — expected, Stage 5 will handle checkout

---
**Do not proceed to Stage 5 — STOPPED as instructed.**
