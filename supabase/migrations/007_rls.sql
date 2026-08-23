-- 007_rls.sql
-- Enable Row Level Security (RLS) and define granular security policies

-- 1. Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.rides enable row level security;
alter table public.ride_status_history enable row level security;
alter table public.driver_locations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.ratings enable row level security;
alter table public.complaints enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Profiles Policies
create policy "users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 3. Customers Policies
create policy "customers can view own record"
  on public.customers for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "customers can update own record"
  on public.customers for update
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- 4. Drivers Policies
create policy "anyone can view verified online drivers"
  on public.drivers for select
  to authenticated
  using (is_online = true and is_verified = true or id = auth.uid() or public.is_admin());

create policy "drivers can update own status and location"
  on public.drivers for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 5. Vehicles Policies
create policy "drivers can view own vehicles"
  on public.vehicles for select
  to authenticated
  using (driver_id = auth.uid() or public.is_admin() or is_active = true);

create policy "drivers can manage own vehicles"
  on public.vehicles for all
  to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

-- 6. Rides Policies
create policy "customers can view own rides"
  on public.rides for select
  to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

create policy "customers can create ride requests"
  on public.rides for insert
  to authenticated
  with check (customer_id = auth.uid() or public.is_admin());

create policy "participants can update active ride"
  on public.rides for update
  to authenticated
  using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

-- 7. Ride Status History Policies
create policy "participants can view ride status history"
  on public.ride_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.rides
      where public.rides.id = ride_status_history.ride_id
      and (public.rides.customer_id = auth.uid() or public.rides.driver_id = auth.uid() or public.is_admin())
    )
  );

-- 8. Driver Locations Policies
create policy "drivers can record own location"
  on public.driver_locations for insert
  to authenticated
  with check (driver_id = auth.uid() or public.is_admin());

create policy "riders can view assigned driver location"
  on public.driver_locations for select
  to authenticated
  using (
    driver_id = auth.uid() or public.is_admin() or
    exists (
      select 1 from public.rides
      where public.rides.driver_id = driver_locations.driver_id
      and public.rides.customer_id = auth.uid()
      and public.rides.status in ('assigned', 'accepted', 'arriving', 'in_progress')
    )
  );

-- 9. Payments Policies
create policy "users can view own payments"
  on public.payments for select
  to authenticated
  using (
    customer_id = auth.uid() or public.is_admin() or
    exists (
      select 1 from public.rides
      where public.rides.id = payments.ride_id
      and public.rides.driver_id = auth.uid()
    )
  );

-- 10. Notifications Policies
create policy "users can view and mark own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "users can update read status on own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 11. Realtime Publication Setup
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.ride_status_history;
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.notifications;
