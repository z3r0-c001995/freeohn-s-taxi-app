-- 006_notifications.sql
-- Create notifications, audit_logs, and system_settings tables

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text, -- 'ride_update', 'payment_success', 'system_alert', 'promo'
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null, -- 'driver_verified', 'fare_adjusted', 'role_assigned', 'refund_issued'
  entity_type text not null, -- 'driver', 'ride', 'payment', 'profile'
  entity_id text not null,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Seed default pricing settings for Zambia (Lusaka & Solwezi)
insert into public.system_settings (key, value, description)
values
  ('base_fare_zmw', '25.00'::jsonb, 'Base flag-fall fare in Zambian Kwacha'),
  ('rate_per_km_zmw', '12.50'::jsonb, 'Standard distance rate per kilometre'),
  ('rate_per_minute_zmw', '1.80'::jsonb, 'Standard duration rate per minute'),
  ('surge_multiplier_max', '2.50'::jsonb, 'Maximum dynamic surge pricing cap')
on conflict (key) do nothing;

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
