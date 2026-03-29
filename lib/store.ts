import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User, DriverProfile, Message, LocationHistory } from "../drizzle/schema";

// Custom Ride type for the store (matches db-service return types)
export interface Ride {
  id: number;
  riderId: number;
  driverId: number | null;
  pickupLat: string;
  pickupLng: string;
  dropoffLat: string | null;
  dropoffLng: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  rideType: "standard" | "premium";
  status: "requested" | "accepted" | "in_progress" | "completed" | "cancelled";
  fareAmount: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline: string | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  queuedSync: boolean;
}

// Additional types
export interface LocationCoord {
  latitude: number;
  longitude: number;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps: Array<{
    instructions: string;
    maneuver: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
}

// Store State
interface AppStore {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setCurrentUser: (user: User | null) => void;
  updateCurrentUser: (fields: Partial<User>) => void;
  setIsAuthenticated: (authenticated: boolean) => void;

  // Driver Profile
  driverProfile: DriverProfile | null;
  setDriverProfile: (profile: DriverProfile | null) => void;

  // Location
  currentLocation: LocationCoord | null;
  setCurrentLocation: (location: LocationCoord | null) => void;
  isLocationTracking: boolean;
  setIsLocationTracking: (tracking: boolean) => void;

  // Rides
  activeRide: Ride | null;
  rideHistory: Ride[];
  setActiveRide: (ride: Ride | null) => void;
  setRideHistory: (rides: Ride[]) => void;
  addRideToHistory: (ride: Ride) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;

  // Available drivers (for matching)
  availableDrivers: (DriverProfile & { user: User })[];
  setAvailableDrivers: (drivers: (DriverProfile & { user: User })[]) => void;

  // Saved locations (home/work shortcuts)
  savedLocations: { home: { address: string; lat: number; lng: number } | null; work: { address: string; lat: number; lng: number } | null };
  setSavedLocation: (label: 'home' | 'work', loc: { address: string; lat: number; lng: number } | null) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Persistence
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  isHydrated: false,
  setCurrentUser: (user) => set({ currentUser: user }),
  updateCurrentUser: (fields) => set((state) => ({ 
    currentUser: state.currentUser ? { ...state.currentUser, ...fields } : null 
  })),
  setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

  // Driver Profile
  driverProfile: null,
  setDriverProfile: (profile) => set({ driverProfile: profile }),

  // Location
  currentLocation: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),
  isLocationTracking: false,
  setIsLocationTracking: (tracking) => set({ isLocationTracking: tracking }),

  // Rides
  activeRide: null,
  rideHistory: [],
  setActiveRide: (ride) => set({ activeRide: ride }),
  setRideHistory: (rides) => set({ rideHistory: rides }),
  addRideToHistory: (ride) =>
    set((state) => ({
      rideHistory: [ride, ...state.rideHistory],
    })),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages],
    })),

  // Available drivers
  availableDrivers: [],
  setAvailableDrivers: (drivers) => set({ availableDrivers: drivers }),

  // Saved locations
  savedLocations: { home: null, work: null },
  setSavedLocation: (label, loc) =>
    set((state) => ({
      savedLocations: { ...state.savedLocations, [label]: loc },
    })),

  // UI State
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Persistence
  hydrate: async () => {
    try {
      const userJson = await AsyncStorage.getItem("currentUser");
      const isAuthJson = await AsyncStorage.getItem("isAuthenticated");
      const activeRideJson = await AsyncStorage.getItem("activeRide");
      const savedLocJson = await AsyncStorage.getItem("savedLocations");

      if (userJson) {
        const user = JSON.parse(userJson);
        if (user.createdAt) user.createdAt = new Date(user.createdAt);
        if (user.updatedAt) user.updatedAt = new Date(user.updatedAt);
        if (user.lastSignedIn) user.lastSignedIn = new Date(user.lastSignedIn);
        set({ currentUser: user });
      }
      if (isAuthJson) {
        set({ isAuthenticated: JSON.parse(isAuthJson) });
      }
      if (activeRideJson) {
        const ride = JSON.parse(activeRideJson);
        if (ride.requestedAt) ride.requestedAt = new Date(ride.requestedAt);
        if (ride.acceptedAt) ride.acceptedAt = new Date(ride.acceptedAt);
        if (ride.startedAt) ride.startedAt = new Date(ride.startedAt);
        if (ride.completedAt) ride.completedAt = new Date(ride.completedAt);
        if (ride.cancelledAt) ride.cancelledAt = new Date(ride.cancelledAt);
        set({ activeRide: ride });
      }
      if (savedLocJson) {
        set({ savedLocations: JSON.parse(savedLocJson) });
      }
      set({ isHydrated: true });
    } catch (error) {
      console.error("Failed to hydrate store:", error);
      set({ isHydrated: true }); // Still mark as finished
    }
  },

  persist: async () => {
    try {
      const state = get();
      await AsyncStorage.setItem("currentUser", JSON.stringify(state.currentUser));
      await AsyncStorage.setItem("isAuthenticated", JSON.stringify(state.isAuthenticated));
      await AsyncStorage.setItem("activeRide", JSON.stringify(state.activeRide));
      await AsyncStorage.setItem("savedLocations", JSON.stringify(state.savedLocations));
    } catch (error) {
      console.error("Failed to persist store:", error);
    }
  },
}));
