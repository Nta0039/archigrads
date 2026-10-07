-- ArchiGrads: database + storage setup
-- =====================================
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement skips or updates what already exists.

-- ---------------------------------------------------------------------------
-- 1. Categories: price and download allowance per product type (AUD cents).
--    One place for pricing, so cards, banner and Stripe checkout always agree.
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  name        text primary key,
  folder      text not null unique,                 -- storage folder, e.g. bim-families
  price_cents integer check (price_cents is null or price_cents > 0),  -- null = free
  allowance   text,                                 -- e.g. '20 downloads'
  sort_order  integer not null default 0
);

insert into public.categories (name, folder, price_cents, allowance, sort_order) values
  ('2D Singles', '2d-singles', null, null, 1),
  ('2D Collections', '2d-collections', 1000, '50 downloads', 2),
  ('Code & Standards', 'code-and-standards', 2000, '20 downloads', 3),
  ('BIM Families', 'bim-families', 1000, '20 downloads', 4),
  ('Detailed Models', 'detailed-models', 2000, '10 downloads', 5),
  ('Project Proposals', 'project-proposals', 1000, 'Per project', 6),
  ('AI Generated', 'ai-generated', null, null, 7)  -- community uploads from AI Studio (free)
on conflict (name) do update set
  folder = excluded.folder,
  price_cents = excluded.price_cents,
  allowance = excluded.allowance,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Assets: one row per library item.
--    Files are referenced by their path inside the storage buckets:
--      thumbnail_path -> bucket "thumbnails"   (public)
--      source_paths   -> bucket "source-files" (private; several paths = a file
--                        split into parts that the site joins on download)
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null,
  category        text not null references public.categories (name) on update cascade,
  subject         text,
  formats         text[] not null default '{}',
  thumbnail_path  text,
  source_paths    text[] not null default '{}',
  source_filename text,
  is_published    boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists assets_category_idx on public.assets (category);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: visitors can READ the catalogue, never write to it.
--    (Uploads and edits happen with the service-role key or in the dashboard.)
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.assets     enable row level security;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
  on public.categories for select to anon, authenticated using (true);

drop policy if exists "Anyone can read published assets" on public.assets;
create policy "Anyone can read published assets"
  on public.assets for select to anon, authenticated using (is_published);

-- ---------------------------------------------------------------------------
-- 4. Storage buckets.
--    thumbnails   : public, images only, 5 MB per file.
--    source-files : PRIVATE, 50 MB per file (the Free plan's upload cap).
--                   Only the server (service-role key) can read it and hands
--                   out short-lived download links.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('thumbnails',   'thumbnails',   true,  5242880,  array['image/png', 'image/jpeg', 'image/webp']),
  ('source-files', 'source-files', false, 52428800, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Thumbnails are publicly viewable (needed for listing; public URLs work regardless).
drop policy if exists "Public can view thumbnails" on storage.objects;
create policy "Public can view thumbnails"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'thumbnails');

-- No policies are created for "source-files" on purpose: without one, browsers
-- cannot read or list it at all.

-- ---------------------------------------------------------------------------
-- 5. Seed: today's 23 library items (7 real files + mock premium items).
--    The files themselves are uploaded by migrate_files.js.
-- ---------------------------------------------------------------------------
insert into public.assets (slug, title, category, subject, formats, thumbnail_path, source_paths, source_filename, sort_order) values
  ('walking-figure', 'Walking Figure', '2D Singles', 'People', '{".psd"}', '2d-singles/walking-figure.jpg', '{"2d-singles/walking-figure.psd"}', 'Walking Figure.psd', 1),
  ('sitting-figure', 'Sitting Figure', '2D Singles', 'People', '{".psd"}', '2d-singles/sitting-figure.jpg', '{"2d-singles/sitting-figure.psd"}', 'Sitting Figure.psd', 2),
  ('shrub-cluster', 'Shrub Cluster', '2D Singles', 'Vegetation', '{".psd"}', '2d-singles/shrub-cluster.jpg', '{"2d-singles/shrub-cluster.psd.part1","2d-singles/shrub-cluster.psd.part2","2d-singles/shrub-cluster.psd.part3"}', 'Shrub Cluster.psd', 3),
  ('tree-section', 'Tree Section', '2D Singles', 'Vegetation', '{".psd"}', '2d-singles/tree-section.png', '{"2d-singles/tree-section.psd"}', 'tree section.psd', 4),
  ('bike', 'Bike', '2D Singles', 'Vehicles', '{".psd"}', '2d-singles/bike.jpg', '{"2d-singles/bike.psd"}', 'bike.psd', 5),
  ('car', 'Car', '2D Singles', 'Vehicles', '{".dwg"}', '2d-singles/car.png', '{"2d-singles/car.dwg"}', 'car.dwg', 6),
  ('furniture-set', 'Furniture Set', '2D Singles', 'Furniture', '{".ai"}', '2d-singles/furniture-set.png', '{"2d-singles/furniture-set.ai"}', 'furniture set.ai', 7),
  ('brick-stretcher-bond', 'Brick Stretcher Bond', '2D Singles', 'Textures', '{".png"}', null, '{}', null, 8),
  ('people-cutout-collection', 'People Cutout Collection', '2D Collections', 'People', '{".psd",".png"}', 'placeholders/dummy-2d-collection.png', '{"placeholders/dummy-2d-collection.png"}', 'archigrads-preview-2d-collection.png', 9),
  ('vegetation-elevation-collection', 'Vegetation Elevation Collection', '2D Collections', 'Vegetation', '{".dwg",".png"}', 'placeholders/dummy-2d-collection.png', '{"placeholders/dummy-2d-collection.png"}', 'archigrads-preview-2d-collection.png', 10),
  ('street-furniture-collection', 'Street Furniture Collection', '2D Collections', 'Furniture', '{".ai",".dwg"}', 'placeholders/dummy-2d-collection.png', '{"placeholders/dummy-2d-collection.png"}', 'archigrads-preview-2d-collection.png', 11),
  ('ncc-volume-one-compliance-pack', 'NCC Volume One Compliance Pack', 'Code & Standards', 'NCC', '{".pdf"}', 'placeholders/dummy-ncc.png', '{"placeholders/dummy-ncc.png"}', 'archigrads-preview-ncc.png', 12),
  ('accessibility-as-1428-1-pack', 'Accessibility (AS 1428.1) Pack', 'Code & Standards', 'NCC', '{".pdf",".dwg"}', 'placeholders/dummy-ncc.png', '{"placeholders/dummy-ncc.png"}', 'archigrads-preview-ncc.png', 13),
  ('fire-safety-checklist-pack', 'Fire Safety Checklist Pack', 'Code & Standards', 'NCC', '{".pdf"}', 'placeholders/dummy-ncc.png', '{"placeholders/dummy-ncc.png"}', 'archigrads-preview-ncc.png', 14),
  ('door-families', 'Door Families', 'BIM Families', 'Revit', '{".rfa"}', 'placeholders/dummy-revit-family.png', '{"placeholders/dummy-revit-family.png"}', 'archigrads-preview-revit-family.png', 15),
  ('window-families', 'Window Families', 'BIM Families', 'Revit', '{".rfa"}', 'placeholders/dummy-revit-family.png', '{"placeholders/dummy-revit-family.png"}', 'archigrads-preview-revit-family.png', 16),
  ('furniture-families', 'Furniture Families', 'BIM Families', 'Revit', '{".rfa"}', 'placeholders/dummy-revit-family.png', '{"placeholders/dummy-revit-family.png"}', 'archigrads-preview-revit-family.png', 17),
  ('clt-stair-assembly', 'CLT Stair Assembly', 'Detailed Models', 'Revit', '{".rvt"}', 'placeholders/dummy-revit-model.png', '{"placeholders/dummy-revit-model.png"}', 'archigrads-preview-revit-model.png', 18),
  ('facade-fin-system', 'Facade Fin System', 'Detailed Models', 'Rhino', '{".3dm"}', 'placeholders/dummy-rhino-model.png', '{"placeholders/dummy-rhino-model.png"}', 'archigrads-preview-rhino-model.png', 19),
  ('timber-pavilion', 'Timber Pavilion', 'Detailed Models', 'Revit / Rhino', '{".rvt",".3dm"}', 'placeholders/dummy-revit-model.png', '{"placeholders/dummy-revit-model.png"}', 'archigrads-preview-revit-model.png', 20),
  ('community-library-proposal', 'Community Library Proposal', 'Project Proposals', 'Civic', '{".pdf",".rvt"}', 'placeholders/dummy-project-proposal.png', '{"placeholders/dummy-project-proposal.png"}', 'archigrads-preview-project-proposal.png', 21),
  ('mixed-use-tower-proposal', 'Mixed-Use Tower Proposal', 'Project Proposals', 'Mixed use', '{".pdf",".3dm"}', 'placeholders/dummy-project-proposal.png', '{"placeholders/dummy-project-proposal.png"}', 'archigrads-preview-project-proposal.png', 22),
  ('pocket-park-proposal', 'Pocket Park Proposal', 'Project Proposals', 'Landscape', '{".pdf",".dwg"}', 'placeholders/dummy-project-proposal.png', '{"placeholders/dummy-project-proposal.png"}', 'archigrads-preview-project-proposal.png', 23)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  subject = excluded.subject,
  formats = excluded.formats,
  thumbnail_path = excluded.thumbnail_path,
  source_paths = excluded.source_paths,
  source_filename = excluded.source_filename,
  sort_order = excluded.sort_order;
