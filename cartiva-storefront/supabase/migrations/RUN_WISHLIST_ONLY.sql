-- Run this in Supabase SQL Editor — wishlist only

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

alter table public.wishlist_items enable row level security;

do $$ begin create policy "wl_select" on public.wishlist_items for select using (auth.uid() = customer_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "wl_insert" on public.wishlist_items for insert with check (auth.uid() = customer_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "wl_delete" on public.wishlist_items for delete using (auth.uid() = customer_id); exception when duplicate_object then null; end $$;

create index if not exists idx_wishlist_customer on public.wishlist_items(customer_id);
create index if not exists idx_wishlist_product on public.wishlist_items(product_id);
