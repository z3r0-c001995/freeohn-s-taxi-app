-- ==============================================================================
-- FREEOHN TAXI & HAUL - CORE SUPABASE SCHEMA & RLS POLICIES
-- Target: PostgreSQL 15+ (Supabase)
-- Version: 1.0.0
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. CUSTOM ENUMS
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('customer', 'driver', 'admin', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.driver_kyc_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.driver_duty_status AS ENUM ('offline', 'online', 'busy', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ride_type AS ENUM ('standard', 'comfort', 'premium', 'haul_truck', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ride_status AS ENUM (
    'requested',
    'matching',
    'driver_assigned',
    'driver_arriving',
    'pin_verification',
    'in_progress',
    'completed',
    'cancelled',
    'no_driver_found'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_type AS ENUM ('cash', 'momo_mtn', 'momo_airtel', 'card', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status_type AS ENUM ('pending', 'authorized', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM (
    'nrc_passport',
    'drivers_license',
    'ratsa_white_book',
    'road_tax',
    'insurance_certificate',
    'fitness_certificate'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. CORE PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'customer',
  full_name TEXT,
  phone_number VARCHAR(32) UNIQUE,
  email VARCHAR(255),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  total_rides INT NOT NULL DEFAULT 0,
  default_payment_method public.payment_method_type NOT NULL DEFAULT 'cash',
  momo_phone VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  license_number VARCHAR(64) UNIQUE,
  license_expiry DATE,
  kyc_status public.driver_kyc_status NOT NULL DEFAULT 'pending',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  total_trips INT NOT NULL DEFAULT 0,
  wallet_balance_zmw NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payout_provider VARCHAR(32) DEFAULT 'MTN_MOMO',
  payout_account_number VARCHAR(64),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  make VARCHAR(64) NOT NULL,
  model VARCHAR(64) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(32) NOT NULL,
  plate_number VARCHAR(32) NOT NULL UNIQUE,
  ride_type public.ride_type NOT NULL DEFAULT 'standard',
  seating_capacity INT NOT NULL DEFAULT 4,
  road_tax_expiry DATE,
  insurance_expiry DATE,
  fitness_expiry DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DRIVER DOCUMENTS (KYC & RATSA Verification)
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  file_url TEXT NOT NULL,
  document_number VARCHAR(64),
  expiry_date DATE,
  status public.driver_kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driver_id, document_type)
);

-- 8. DRIVER AVAILABILITY & LIVE LOCATION (Optimized for Realtime)
CREATE TABLE IF NOT EXISTS public.driver_availability (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  duty_status public.driver_duty_status NOT NULL DEFAULT 'offline',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  heading DOUBLE PRECISION DEFAULT 0.0,
  speed_kmh DOUBLE PRECISION DEFAULT 0.0,
  dispatch_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  current_trip_id UUID,
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. RIDES / HAULS TABLE
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  driver_id UUID REFERENCES public.drivers(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  ride_type public.ride_type NOT NULL DEFAULT 'standard',
  status public.ride_status NOT NULL DEFAULT 'requested',
  
  -- Route Info
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  route_polyline TEXT,
  estimated_distance_meters INT NOT NULL DEFAULT 0,
  estimated_duration_seconds INT NOT NULL DEFAULT 0,
  
  -- Fare Breakdown (ZMW)
  currency VARCHAR(8) NOT NULL DEFAULT 'ZMW',
  base_fare_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  distance_fare_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  time_fare_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  surge_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  total_fare_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  
  -- Payment & Security
  payment_method public.payment_method_type NOT NULL DEFAULT 'cash',
  start_pin VARCHAR(6),
  pin_required BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id),
  cancellation_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RIDE STATUS HISTORY (Audit Trail)
CREATE TABLE IF NOT EXISTS public.ride_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  from_status public.ride_status,
  to_status public.ride_status NOT NULL,
  actor_id UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  driver_id UUID REFERENCES public.drivers(id),
  amount_zmw NUMERIC(10, 2) NOT NULL,
  platform_fee_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  driver_earnings_zmw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_method public.payment_method_type NOT NULL DEFAULT 'cash',
  status public.payment_status_type NOT NULL DEFAULT 'pending',
  gateway_reference VARCHAR(128),
  gateway_response JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. MESSAGES TABLE (Realtime Chat between Rider and Driver)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id),
  message_text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. RATINGS & REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id),
  ratee_id UUID NOT NULL REFERENCES public.profiles(id),
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ride_id, rater_id)
);

-- 14. SOS & SAFETY ALERTS
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  emergency_contacts_notified BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. SYSTEM SETTINGS TABLE (Platform Config)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Seed Initial Default Settings for Zambia (Mansa & National)
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('pricing_config', '{"base_fare": 20.0, "per_km": 1.5, "per_minute": 0.5, "min_fare": 25.0, "premium_multiplier": 1.35, "currency": "ZMW"}'::jsonb, 'Default Zambian Kwacha Pricing Configuration'),
  ('dispatch_config', '{"dispatch_radius_km": 10.0, "offer_timeout_sec": 30, "max_retry_candidates": 5}'::jsonb, 'Dispatch Engine Radius and Timers')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 16. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Helper Function: Get Role of Authenticated User
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

-- ------------------------------------------------------------------------------
-- B. CUSTOMERS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Customers can manage own record" ON public.customers
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Admins can view customers" ON public.customers
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

-- ------------------------------------------------------------------------------
-- C. DRIVERS & VEHICLES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Drivers can view and update own driver profile" ON public.drivers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Public/Seekers can view basic driver profile for active rides" ON public.drivers
  FOR SELECT USING (
    is_verified = true OR auth.uid() = id OR public.get_user_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "Drivers can manage own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can manage own documents" ON public.driver_documents
  FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "Admins have full access to drivers and vehicles" ON public.drivers
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins have full access to vehicles" ON public.vehicles
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins have full access to driver documents" ON public.driver_documents
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

-- ------------------------------------------------------------------------------
-- D. DRIVER AVAILABILITY POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Drivers can update own availability" ON public.driver_availability
  FOR ALL USING (auth.uid() = driver_id);

CREATE POLICY "Authenticated users can see online drivers" ON public.driver_availability
  FOR SELECT USING (duty_status = 'online' OR auth.uid() = driver_id OR public.get_user_role() IN ('admin', 'superadmin'));

-- ------------------------------------------------------------------------------
-- E. RIDES & STATUS HISTORY POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Customers can read own rides" ON public.rides
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create new rides" ON public.rides
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Drivers can view assigned rides or matching requests" ON public.rides
  FOR SELECT USING (
    auth.uid() = driver_id OR 
    (status = 'matching' AND EXISTS (SELECT 1 FROM public.drivers WHERE id = auth.uid() AND is_verified = true))
  );

CREATE POLICY "Drivers can update assigned rides" ON public.rides
  FOR UPDATE USING (auth.uid() = driver_id OR auth.uid() = customer_id);

CREATE POLICY "Admins have full access to rides" ON public.rides
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Ride participants can view ride history" ON public.ride_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rides 
      WHERE rides.id = ride_status_history.ride_id 
        AND (rides.customer_id = auth.uid() OR rides.driver_id = auth.uid())
    ) OR public.get_user_role() IN ('admin', 'superadmin')
  );

-- ------------------------------------------------------------------------------
-- F. PAYMENTS & MESSAGES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = driver_id OR public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Participants can view and send ride messages" ON public.messages
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Ride participants can view ratings" ON public.ratings
  FOR SELECT USING (auth.uid() = rater_id OR auth.uid() = ratee_id OR public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Users can insert ratings for completed trips" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- ------------------------------------------------------------------------------
-- G. SOS & ADMIN AUDIT POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Participants can trigger SOS" ON public.sos_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view and manage SOS alerts" ON public.sos_alerts
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Everyone can read system settings" ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can edit system settings" ON public.system_settings
  FOR ALL USING (public.get_user_role() IN ('admin', 'superadmin'));

-- ==============================================================================
-- 17. AUTOMATIC PROFILE CREATION TRIGGER (auth.users -> public.profiles)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role public.user_role;
BEGIN
  assigned_role := COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'customer');
  
  INSERT INTO public.profiles (id, role, full_name, phone_number, email, avatar_url)
  VALUES (
    new.id,
    assigned_role,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.phone, new.raw_user_meta_data->>'phone_number'),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Automatically initialize role table
  IF assigned_role = 'driver' THEN
    INSERT INTO public.drivers (id, kyc_status, is_verified) VALUES (new.id, 'pending', false);
    INSERT INTO public.driver_availability (driver_id, duty_status) VALUES (new.id, 'offline');
  ELSIF assigned_role = 'customer' THEN
    INSERT INTO public.customers (id) VALUES (new.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 18. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_availability;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
