-- LUX DECOR - banco exclusivo
-- Execute no SQL Editor do Supabase novo.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  category_name text,
  name text not null,
  slug text unique,
  price numeric(12,2),
  price_label text not null default 'Sob consulta',
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  badge text,
  cover_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_path text,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  whatsapp text not null default '',
  instagram text not null default 'https://www.instagram.com/luxdecor.sl/',
  updated_at timestamptz not null default now()
);

create table if not exists public.site_images (
  key text primary key,
  url text not null,
  storage_path text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(id,whatsapp,instagram)
values (1,'','https://www.instagram.com/luxdecor.sl/')
on conflict (id) do nothing;

insert into public.categories(name,slug,sort_order) values
('Sofás','sofas',10),
('Mesas','mesas',20),
('Cadeiras','cadeiras',30),
('Sala de jantar','sala-de-jantar',40),
('Área externa','area-externa',50)
on conflict (name) do nothing;

-- catálogo inicial usa as imagens que já viajam com o projeto Vercel.
insert into public.products(id,category_id,category_name,name,price,price_label,description,features,badge,cover_url,sort_order) values
('11111111-1111-4111-8111-111111111111',(select id from public.categories where name='Sala de jantar'),'Sala de jantar','Mesa Off Laqueada',null,'Sob consulta','Tampo e vidro laqueados, madeira chanfrada e base em madeira maciça. Um encontro entre natural e off.','["Tampo laqueado","Vidro laqueado","Base em madeira maciça","Acabamento natural + off"]','Destaque','/assets/products/mesa-off.png',10),
('22222222-2222-4222-8222-222222222222',(select id from public.categories where name='Cadeiras'),'Cadeiras','Cadeira Natural',590,'R$ 590,00','Cadeira em madeira maciça natural, com desenho atemporal e estrutura que suporta até 120 kg.','["Madeira maciça","Suporta até 120 kg","Design atemporal","Uso residencial ou comercial"]','Novo','/assets/products/cadeira-madeira.png',20),
('33333333-3333-4333-8333-333333333333',(select id from public.categories where name='Área externa'),'Área externa','Cadeira Náutica',null,'Sob consulta','Corda náutica, braço em madeira maciça, estrutura preta e tecido resistente para área externa.','["Corda náutica","Braço em madeira maciça","Estrutura em alumínio","Tecido resistente"]','Área externa','/assets/products/cadeira-corda.jpg',30),
('44444444-4444-4444-8444-444444444444',(select id from public.categories where name='Mesas'),'Mesas','Mesa Demolição 2×1',null,'Sob medida','Madeira maciça modelo demolição com base em ferragem preta. Produzida também em medidas personalizadas.','["Madeira maciça","Ferragem preta","Modelo 2 × 1","Feita sob medida"]','Sob medida','/assets/products/mesa-demolicao.jpg',40),
('55555555-5555-4555-8555-555555555555',(select id from public.categories where name='Sofás'),'Sofás','Sofá Cama D33',2699,'A partir de R$ 2.699','Linho, espuma D33 e detalhes em couro ecológico com múltiplas opções de medidas.','["Espuma D33","Tecido em linho","Couro ecológico","Pés em madeira"]','Conforto','/assets/products/sofa-cama.png',50),
('66666666-6666-4666-8666-666666666666',(select id from public.categories where name='Sofás'),'Sofás','Sofá Retrátil 2,90 m',3990,'R$ 3.990','Retrátil, reclinável e espuma D33 com costura em viés para um acabamento mais marcante.','["Retrátil","Reclinável","Espuma D33","Costura em viés"]','Mais vendido','/assets/products/sofa-vies.png',60),
('77777777-7777-4777-8777-777777777777',(select id from public.categories where name='Sofás'),'Sofás','Sofá Premium Cinza',2999,'A partir de R$ 2.999','Estrutura reforçada, catraca blindada e acabamento pensado para uso diário.','["Espuma Sanka","Madeira maciça","Catraca blindada","Costura reforçada"]','Destaque','/assets/products/sofa-cinza.png',70),
('88888888-8888-4888-8888-888888888888',(select id from public.categories where name='Sala de jantar'),'Sala de jantar','Mesa + Cadeiras Telinha',998,'A partir de R$ 998','Conjunto visualmente leve, com tampo claro e cadeiras em polipropileno com trama telinha.','["Vidro laqueado","Madeira maciça","Polipropileno","Trama telinha"]','Composição','/assets/products/mesa-telinha.png',80)
on conflict (id) do nothing;

insert into public.product_images(product_id,url,sort_order,is_cover)
select p.id,p.cover_url,0,true from public.products p
where p.cover_url is not null and not exists(select 1 from public.product_images pi where pi.product_id=p.id and pi.url=p.cover_url);

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_images enable row level security;

create or replace function public.is_lux_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

-- público: somente leitura
create policy "categories_public_read" on public.categories for select using (is_active = true);
create policy "products_public_read" on public.products for select using (is_active = true);
create policy "product_images_public_read" on public.product_images for select using (
  exists(select 1 from public.products p where p.id = product_id and p.is_active = true)
);
create policy "site_settings_public_read" on public.site_settings for select using (true);
create policy "site_images_public_read" on public.site_images for select using (true);

-- admin: CRUD completo
create policy "admin_users_self_read" on public.admin_users for select using (user_id = auth.uid());
create policy "categories_admin_all" on public.categories for all using (public.is_lux_admin()) with check (public.is_lux_admin());
create policy "products_admin_all" on public.products for all using (public.is_lux_admin()) with check (public.is_lux_admin());
create policy "product_images_admin_all" on public.product_images for all using (public.is_lux_admin()) with check (public.is_lux_admin());
create policy "site_settings_admin_all" on public.site_settings for all using (public.is_lux_admin()) with check (public.is_lux_admin());
create policy "site_images_admin_all" on public.site_images for all using (public.is_lux_admin()) with check (public.is_lux_admin());

-- buckets públicos para catálogo; escrita é protegida por RLS de storage.objects
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('products','products',true,10485760,array['image/jpeg','image/png','image/webp']),
('site-assets','site-assets',true,12582912,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "lux_public_storage_read" on storage.objects for select using (bucket_id in ('products','site-assets'));
create policy "lux_admin_storage_insert" on storage.objects for insert to authenticated with check (bucket_id in ('products','site-assets') and public.is_lux_admin());
create policy "lux_admin_storage_update" on storage.objects for update to authenticated using (bucket_id in ('products','site-assets') and public.is_lux_admin()) with check (bucket_id in ('products','site-assets') and public.is_lux_admin());
create policy "lux_admin_storage_delete" on storage.objects for delete to authenticated using (bucket_id in ('products','site-assets') and public.is_lux_admin());

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active_sort on public.products(is_active,sort_order);
create index if not exists idx_product_images_product on public.product_images(product_id,sort_order);
