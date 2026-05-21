-- Tecnocasa: tablas + RLS para que la app (clave anon) pueda leer y el admin escribir.
-- Ejecuta esto en Supabase → SQL Editor → Run (todo el archivo).

-- Tablas mínimas que usa la app
create table if not exists public.store_config (
  key text primary key,
  value text
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  badge text,
  description text,
  purchase_price numeric default 0,
  price numeric not null default 0,
  stock int default 0,
  category text,
  image_url text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.store_config enable row level security;
alter table public.products enable row level security;

-- Políticas: rol anon (navegador con tu anon key pública)
drop policy if exists "store_config_anon_all" on public.store_config;
create policy "store_config_anon_all"
  on public.store_config for all
  to anon
  using (true)
  with check (true);

drop policy if exists "products_anon_all" on public.products;
create policy "products_anon_all"
  on public.products for all
  to anon
  using (true)
  with check (true);

-- También suele usarse authenticated si más adelante añades login
drop policy if exists "store_config_authenticated_all" on public.store_config;
create policy "store_config_authenticated_all"
  on public.store_config for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "products_authenticated_all" on public.products;
create policy "products_authenticated_all"
  on public.products for all
  to authenticated
  using (true)
  with check (true);
