-- 002_customers_drivers.sql
-- Create customer and driver sub-profile tables

create table if not exists public.customers (
  id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key references public.profiles(id) on delete cascade,
  license_number text,
  is_verified boolean not null default false,
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  location_updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Driver documents for RATSA / RTSA and licence verification
create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  document_type text not null, -- 'driving_license', 'ratsa_badge', 'nrc_id', 'police_clearance'
  document_url text not null,
  verification_status text not null default 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason text,
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_drivers_online_verified on public.drivers(is_online, is_verified);
create index if not exists idx_driver_documents_driver on public.driver_documents(driver_id);
