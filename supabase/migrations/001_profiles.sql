-- 001_profiles.sql
-- Create user role enum and profiles table linked to auth.users

create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'driver', 'admin');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  first_name text not null,
  last_name text not null,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookup by role
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_phone on public.profiles(phone);

-- Function and trigger to auto-create profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_meta jsonb;
  user_role_val public.user_role;
begin
  raw_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  
  if (raw_meta->>'role') in ('customer', 'driver', 'admin') then
    user_role_val := (raw_meta->>'role')::public.user_role;
  else
    user_role_val := 'customer'::public.user_role;
  end if;

  insert into public.profiles (
    id,
    role,
    first_name,
    last_name,
    phone,
    avatar_url
  )
  values (
    new.id,
    user_role_val,
    coalesce(raw_meta->>'first_name', raw_meta->>'name', 'Freeohn'),
    coalesce(raw_meta->>'last_name', 'User'),
    coalesce(new.phone, raw_meta->>'phone'),
    raw_meta->>'avatar_url'
  )
  on conflict (id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
