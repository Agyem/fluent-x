-- ============================================================
-- STAGE 11: Account dashboard tables
-- Reviews, wishlist, notifications, coupons, phone column
-- Run AFTER all previous stages (1-10)
-- ============================================================

-- ==================== PHONE COLUMN ====================
-- Add phone column to profiles if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'phone') then
    alter table public.profiles add column phone text;
  end if;
end $$;

-- ==================== CUSTOMER ADDRESSES ====================
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text default 'Home',
  full_name text,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.customer_addresses enable row level security;

-- Customers can read their own addresses
create policy "Customers read own addresses"
  on public.customer_addresses for select
  using (auth.uid() = customer_id);

-- Customers can insert their own addresses
create policy "Customers insert own addresses"
  on public.customer_addresses for insert
  with check (auth.uid() = customer_id);

-- Customers can update their own addresses
create policy "Customers update own addresses"
  on public.customer_addresses for update
  using (auth.uid() = customer_id);

-- Customers can delete their own addresses
create policy "Customers delete own addresses"
  on public.customer_addresses for delete
  using (auth.uid() = customer_id);

create index if not exists idx_customer_addresses_customer on public.customer_addresses(customer_id);

-- ==================== DELETE OWN ACCOUNT ====================
create or replace function public.delete_own_account()
returns void as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  -- Delete customer data
  delete from public.reviews where customer_id = uid;
  delete from public.wishlist_items where customer_id = uid;
  delete from public.notifications where customer_id = uid;
  delete from public.customer_addresses where customer_id = uid;
  delete from public.orders WHERE customer_id = uid;
  delete from public.customer_profiles where profile_id = uid;
  delete from public.profiles where id = uid;
  -- Delete auth user (requires service role, so this is a best-effort)
  -- The actual auth user deletion must be done via admin or Edge Function
end;
$$ language plpgsql security definer;

-- ==================== REVIEWS ====================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level level;

-- Customers can read their own reviews
create policy "Customers read own reviews"
  on public.reviews for select
  using (auth.uid() = customer_id);

-- Customers can insert reviews for their own orders
create policy "Customers insert own reviews"
  on public.reviews for insert
  with check (auth.uid() = customer_id);

-- Customers can update their own reviews
create policy "Customers update own reviews"
  on public.reviews for update
  using (auth.uid() = customer_id);

-- Customers can delete their own reviews
create policy "Customers delete own reviews"
  on public.reviews for delete
  using (auth.uid() = customer_id);

-- Published reviews are publicly readable
create policy "Public read published reviews"
  on public.reviews for select
  using (status = 'published');

-- ==================== WISHLIST ====================
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

alter table public.wishlist_items enable row level security;

-- Customers can read their own wishlist
create policy "Customers read own wishlist"
  on public.wishlist_items for select
  using (auth.uid() = customer_id);

-- Customers can add to their own wishlist
create policy "Customers insert own wishlist"
  on public.wishlist_items for insert
  with check (auth.uid() = customer_id);

-- Customers can remove from their own wishlist
create policy "Customers delete own wishlist"
  on public.wishlist_items for delete
  using (auth.uid() = customer_id);

-- ==================== NOTIFICATIONS ====================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  type text default 'info' check (type in ('info', 'order', 'promotion', 'system')),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Customers can read their own notifications
create policy "Customers read own notifications"
  on public.notifications for select
  using (auth.uid() = customer_id);

-- Customers can mark their own notifications as read
create policy "Customers update own notifications"
  on public.notifications for update
  using (auth.uid() = customer_id);

-- System/admin can insert notifications (service role)
create policy "Service role insert notifications"
  on public.notifications for insert
  with check (true);

-- ==================== COUPONS ====================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  code text not null unique,
  description text,
  discount_percent smallint not null check (discount_percent > 0 and discount_percent <= 100),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- Customers can read their own coupons
create policy "Customers read own coupons"
  on public.coupons for select
  using (auth.uid() = customer_id);

-- Customers can mark their own coupons as used
create policy "Customers update own coupons"
  on public.coupons for update
  using (auth.uid() = customer_id);

-- ==================== INDEXES ====================
create index if not exists idx_reviews_customer on public.reviews(customer_id);
create index if not exists idx_reviews_product on public.reviews(product_id);
create index if not exists idx_reviews_status on public.reviews(status);
create index if not exists idx_wishlist_customer on public.wishlist_items(customer_id);
create index if not exists idx_wishlist_product on public.wishlist_items(product_id);
create index if not exists idx_notifications_customer on public.notifications(customer_id);
create index if not exists idx_notifications_read on public.notifications(customer_id, read);
create index if not exists idx_coupons_customer on public.coupons(customer_id);
create index if not exists idx_coupons_code on public.coupons(code);

-- ==================== UPDATED_AT TRIGGER ====================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.handle_updated_at();
