-- 004_rides.sql
-- Create rides, ride_status_history, and driver_locations tables

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ride_status') then
    create type public.ride_status as enum (
      'searching',
      'assigned',
      'accepted',
      'arriving',
      'in_progress',
      'completed',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null references public.customers(id),
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),

  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,

  destination_address text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,

  estimated_distance_km numeric(10,2),
  estimated_duration_minutes integer,

  estimated_fare numeric(12,2),
  final_fare numeric(12,2),

  status public.ride_status not null default 'searching',

  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_status_history (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  status public.ride_status not null,
  changed_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id bigint generated always as identity primary key,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now()
);

-- Trigger to record status history automatically whenever ride status changes
create or replace function public.log_ride_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into public.ride_status_history (
      ride_id,
      status,
      changed_by,
      notes
    )
    values (
      new.id,
      new.status,
      auth.uid(),
      'Status transitioned to ' || new.status::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_ride_status_changed on public.rides;
create trigger on_ride_status_changed
  after insert or update on public.rides
  for each row execute function public.log_ride_status_change();

create index if not exists idx_rides_customer on public.rides(customer_id);
create index if not exists idx_rides_driver on public.rides(driver_id);
create index if not exists idx_rides_status on public.rides(status);
create index if not exists idx_ride_history_ride on public.ride_status_history(ride_id);
create index if not exists idx_driver_locations_driver_time on public.driver_locations(driver_id, recorded_at desc);
