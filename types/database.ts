export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "customer" | "driver" | "admin";
export type RideStatus =
  | "searching"
  | "assigned"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          first_name: string;
          last_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          first_name: string;
          last_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          license_number: string | null;
          is_verified: boolean;
          is_online: boolean;
          current_lat: number | null;
          current_lng: number | null;
          location_updated_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          license_number?: string | null;
          is_verified?: boolean;
          is_online?: boolean;
          current_lat?: number | null;
          current_lng?: number | null;
          location_updated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          license_number?: string | null;
          is_verified?: boolean;
          is_online?: boolean;
          current_lat?: number | null;
          current_lng?: number | null;
          location_updated_at?: string | null;
          created_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          driver_id: string;
          registration_number: string;
          make: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          vehicle_type: string;
          capacity: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          registration_number: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          vehicle_type?: string;
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          registration_number?: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          color?: string | null;
          vehicle_type?: string;
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      rides: {
        Row: {
          id: string;
          customer_id: string;
          driver_id: string | null;
          vehicle_id: string | null;
          pickup_address: string;
          pickup_lat: number;
          pickup_lng: number;
          destination_address: string;
          destination_lat: number;
          destination_lng: number;
          estimated_distance_km: number | null;
          estimated_duration_minutes: number | null;
          estimated_fare: number | null;
          final_fare: number | null;
          status: RideStatus;
          requested_at: string;
          accepted_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          pickup_address: string;
          pickup_lat: number;
          pickup_lng: number;
          destination_address: string;
          destination_lat: number;
          destination_lng: number;
          estimated_distance_km?: number | null;
          estimated_duration_minutes?: number | null;
          estimated_fare?: number | null;
          final_fare?: number | null;
          status?: RideStatus;
          requested_at?: string;
          accepted_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          pickup_address?: string;
          pickup_lat?: number;
          pickup_lng?: number;
          destination_address?: string;
          destination_lat?: number;
          destination_lng?: number;
          estimated_distance_km?: number | null;
          estimated_duration_minutes?: number | null;
          estimated_fare?: number | null;
          final_fare?: number | null;
          status?: RideStatus;
          requested_at?: string;
          accepted_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ride_status_history: {
        Row: {
          id: string;
          ride_id: string;
          status: RideStatus;
          changed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          status: RideStatus;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          status?: RideStatus;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      driver_locations: {
        Row: {
          id: number;
          driver_id: string;
          latitude: number;
          longitude: number;
          accuracy: number | null;
          heading: number | null;
          speed: number | null;
          recorded_at: string;
        };
        Insert: {
          id?: never;
          driver_id: string;
          latitude: number;
          longitude: number;
          accuracy?: number | null;
          heading?: number | null;
          speed?: number | null;
          recorded_at?: string;
        };
        Update: {
          id?: never;
          driver_id?: string;
          latitude?: number;
          longitude?: number;
          accuracy?: number | null;
          heading?: number | null;
          speed?: number | null;
          recorded_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          ride_id: string;
          customer_id: string;
          amount: number;
          currency: string;
          provider: string | null;
          provider_reference: string | null;
          status: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ride_id: string;
          customer_id: string;
          amount: number;
          currency?: string;
          provider?: string | null;
          provider_reference?: string | null;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ride_id?: string;
          customer_id?: string;
          amount?: number;
          currency?: string;
          provider?: string | null;
          provider_reference?: string | null;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string | null;
          data: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: string | null;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string | null;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
