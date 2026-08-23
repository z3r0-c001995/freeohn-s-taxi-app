-- 005_payments.sql
-- Create payments, payment transactions, ratings, and complaints tables

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id),
  customer_id uuid not null references public.customers(id),
  amount numeric(12,2) not null,
  currency text not null default 'ZMW',
  provider text, -- 'CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'CARD'
  provider_reference text,
  status text not null default 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  transaction_type text not null, -- 'debit', 'payout', 'commission', 'refund'
  amount numeric(12,2) not null,
  currency text not null default 'ZMW',
  gateway_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade unique,
  customer_id uuid not null references public.customers(id),
  driver_id uuid not null references public.drivers(id),
  score integer not null check (score >= 1 and score <= 5),
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id),
  reporter_id uuid not null references public.profiles(id),
  category text not null, -- 'safety', 'fare_dispute', 'lost_item', 'driver_conduct', 'other'
  description text not null,
  status text not null default 'open', -- 'open', 'investigating', 'resolved', 'dismissed'
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_ride on public.payments(ride_id);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_ratings_driver on public.ratings(driver_id);
create index if not exists idx_complaints_status on public.complaints(status);
