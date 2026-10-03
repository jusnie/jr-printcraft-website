-- ============================================================================
-- JR PrintCraft Express -- Admin Dashboard setup
-- ----------------------------------------------------------------------------
-- Run this ONCE in your Supabase project: Dashboard > SQL Editor > New query
-- > paste this whole file > Run.
--
-- What this does:
--   1) Creates a "products" table that stores each item's live price/photo
--   2) Seeds it with the 8 products already on the site (same prices/photos
--      it currently shows, so nothing changes until you edit something)
--   3) Turns on Row Level Security so:
--        - ANYONE (including the public storefront, not logged in) can READ
--        - ONLY a logged-in admin account can UPDATE
--   4) Creates a public "product-images" Storage bucket for photos the
--      admin uploads, with the same read-everyone / write-admin-only rule
--   5) Creates a "site_assets" table + public "site-assets" Storage bucket
--      for the logo, hero photo, the 4 showcase gallery photos, AND the 4
--      swappable Ceramic Ornament "Look" design photos, with the exact
--      same read-everyone / write-admin-only rule
--
-- IMPORTANT: this seeds image_url with the CURRENT local filenames (e.g.
-- "client1.jpg"). If you haven't uploaded those actual photo files to your
-- hosting yet, the storefront will show broken images until you either (a)
-- add those files to the project, or (b) just upload a real photo for each
-- one from admin.html's "Branding & Gallery" section -- either way works,
-- you don't have to do both.
--
-- After running this, go to Authentication > Users > Add User and create
-- the one owner login (email + password) used to sign in to admin.html.
-- ============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.products (
  key text primary key,
  name text not null,
  price numeric(10, 2) not null default 0,
  image_url text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) Seed with the current storefront data ------------------------------------
insert into public.products (key, name, price, image_url, sort_order)
values
  ('frostedBeer',     'Frosted Beer 16oz',                       20, 'frosted-beer-16oz.jpg',              1),
  ('ornament',        'Ceramic Ornaments',                        6, 'ornament-1.jpg',                     2),
  ('tshirtFront',     'Tshirt - Front Only',                     20, 'tshirt-front.jpg',                   3),
  ('tshirtFrontBack', 'Tshirt - Front and Back',                 24, 'tshirt-front-back.jpg',               4),
  ('tumbler40',       '40oz Sublimation White Travel Tumbler',   40, '40oz-sublimation-white-tumbler.jpg',  5),
  ('pickleballCover', 'Neoprene Cover for Pickleball Paddle',    15, 'pickleball-paddle-cover.jpg',         6),
  ('fabricNotebook',  'Fabric Notebook',                          20, 'fabric-notebook.jpg',                 7),
  ('steelTumbler',    'Stainless Steel White Tumbler',           25, 'stainless-steel-white-tumbler.jpg',  8)
on conflict (key) do nothing;

-- 3) Row Level Security --------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);

-- 4) Storage bucket for admin-uploaded product photos --------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images');

-- 5) Table for the logo, hero photo, and the 4 showcase gallery photos --------
create table if not exists public.site_assets (
  key text primary key,
  image_url text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.site_assets (key, image_url, sort_order)
values
  ('logo',          'logo.png',     1),
  ('heroImage',     'client1.jpg',  2),
  ('gallery1',      'client1.jpg',  3),
  ('gallery2',      'client2.jpg',  4),
  ('gallery3',      'client3.jpg',  5),
  ('gallery4',      'client4.jpg',  6),
  ('ornamentLook1', 'ornament-1.jpg', 7),
  ('ornamentLook2', 'ornament-2.jpg', 8),
  ('ornamentLook3', 'ornament-3.jpg', 9),
  ('ornamentLook4', 'ornament-4.jpg', 10)
on conflict (key) do nothing;

alter table public.site_assets enable row level security;

drop policy if exists "Public can read site assets" on public.site_assets;
create policy "Public can read site assets"
  on public.site_assets
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update site assets" on public.site_assets;
create policy "Admins can update site assets"
  on public.site_assets
  for update
  to authenticated
  using (true)
  with check (true);

-- 6) Storage bucket for admin-uploaded logo/hero/gallery photos ----------------
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

drop policy if exists "Public can view site assets" on storage.objects;
create policy "Public can view site assets"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-assets');

drop policy if exists "Admins can upload site assets" on storage.objects;
create policy "Admins can upload site assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'site-assets');

drop policy if exists "Admins can update site asset uploads" on storage.objects;
create policy "Admins can update site asset uploads"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'site-assets');

-- 7) Table for customer feedback submitted from the website ------------------
create table if not exists public.feedback (
  id bigint generated by default as identity primary key,
  name text,
  email text,
  rating smallint,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone (including an anonymous visitor submitting the form) can SUBMIT
-- feedback, but nobody except a logged-in admin can ever READ, UPDATE, or
-- DELETE it -- customer feedback is private, not public like products.
drop policy if exists "Public can submit feedback" on public.feedback;
create policy "Public can submit feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read feedback" on public.feedback;
create policy "Admins can read feedback"
  on public.feedback
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can update feedback" on public.feedback;
create policy "Admins can update feedback"
  on public.feedback
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admins can delete feedback" on public.feedback;
create policy "Admins can delete feedback"
  on public.feedback
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- Done. Next steps:
--   1) Fill SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js
--   2) Authentication > Users > Add User -> create your admin email/password
--   3) Open admin.html and log in with that email/password
--   4) (Optional but recommended) Set up EmailJS and fill its keys into
--      supabase-config.js so orders AND feedback get emailed to you
--      automatically -- see the comment block at the top of that file
-- ============================================================================
