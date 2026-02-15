import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

type DevUserIdentity = {
  id?: number;
  role?: string;
};

type ConnectTripSocketOptions = {
  tripId: string;
  onEvent: (event: any) => void;
  onConnected?: () => void;
  onError?: (message: string) => void;
};

async function getPersistedUserIdentity(): Promise<DevUserIdentity> {
  try {
    if (Platform.OS === "web") {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("currentUser") : null;
      if (!raw) return {};
      const user = JSON.parse(raw) as { id?: number; role?: string };
      return { id: user.id, role: user.role };
    }

    const raw = await AsyncStorage.getItem("currentUser");
    if (!raw) return {};
    const user = JSON.parse(raw) as { id?: number; role?: string };
    return { id: user.id, role: user.role };
  } catch {
    return {};
  }
}

function getSocketBaseUrl(): string {
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export async function connectTripSocket(options: ConnectTripSocketOptions): Promise<() => void> {
  const { tripId, onEvent, onConnected, onError } = options;
  const identity = await getPersistedUserIdentity();
  const sessionToken = await Auth.getSessionToken();

  const authPayload: Record<string, string> = {};
  if (sessionToken) {
    authPayload.bearerToken = sessionToken;
  }
  if (identity.id) {
    authPayload.devUserId = String(identity.id);
  }
  if (identity.role) {
    authPayload.devUserRole = identity.role;
  }

  const socket: Socket = io(getSocketBaseUrl(), {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: authPayload,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    socket.emit("trip:subscribe", { tripId }, (ack?: { ok?: boolean; error?: string }) => {
      if (!ack?.ok) {
        onError?.(ack?.error || "Trip subscribe failed");
        return;
      }
      onConnected?.();
    });
  });

  socket.on("trip:event", (event) => {
    onEvent(event);
  });

  socket.on("connect_error", (error: Error) => {
    onError?.(error.message || "Realtime socket connection failed");
  });

  socket.connect();

  return () => {
    socket.emit("trip:unsubscribe", { tripId });
    socket.disconnect();
  };
}
