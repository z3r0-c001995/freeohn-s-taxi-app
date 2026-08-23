-- 003_vehicles.sql
-- Create vehicles and vehicle inspection/insurance documents tables

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  registration_number text not null unique,
  make text,
  model text,
  year integer,
  color text,
  vehicle_type text not null default 'standard', -- 'standard', 'comfort', 'premium', 'haul_truck', 'delivery'
  capacity integer default 4,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null, -- 'whitebook', 'roadworthiness', 'insurance', 'fitness_certificate'
  document_url text not null,
  expiry_date date,
  verification_status text not null default 'pending',
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_vehicles_driver on public.vehicles(driver_id);
create index if not exists idx_vehicles_type on public.vehicles(vehicle_type);
