-- AgriSathi shared schema (Postgres / Supabase)
-- Local hackathon runtime uses SQLite with the same logical model.

create extension if not exists "pgcrypto";

create table if not exists farmers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  phone text,
  lang text not null default 'bn',
  created_at timestamptz not null default now()
);

create table if not exists fields (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers(id) on delete cascade,
  crop text not null default 'rice',
  variety text not null default 'BRRI dhan28',
  sowing_date date not null,
  lat double precision not null default 25.7439,
  lon double precision not null default 89.2752,
  area_ha double precision not null default 0.8,
  location_label text
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  type text not null check (type in (
    'diagnosis', 'advice', 'weather_alert', 'treatment_logged', 'sale'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_field_created_idx on events (field_id, created_at desc);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  crop text not null,
  quantity_ton double precision not null,
  price_hint_bdt double precision,
  district text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Storage bucket: leaf-photos (create in Supabase dashboard)
