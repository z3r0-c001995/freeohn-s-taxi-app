import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { getActiveTrip, getTripMessages, sendTripMessage } from "@/lib/ride-hailing-api";

type LocalMessage = {
  id: number;
  senderId?: number;
  sender_id?: number;
  message: string;
  sentAt?: Date;
  created_at?: string;
};

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const { currentUser, activeRide, messages, setMessages, addMessage } = useAppStore();
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remoteActiveTrip, setRemoteActiveTrip] = useState<any | null>(null);

  const activeTripId = useMemo(() => {
    if (remoteActiveTrip?.id) return String(remoteActiveTrip.id);
    if (activeRide?.id != null) return String(activeRide.id);
    return null;
  }, [activeRide?.id, remoteActiveTrip?.id]);

  const activeTripState = useMemo(() => {
    if (remoteActiveTrip?.state) return String(remoteActiveTrip.state);
    if (activeRide?.status) return String(activeRide.status).toUpperCase();
    return null;
  }, [activeRide?.status, remoteActiveTrip?.state]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    const refreshActiveTrip = async () => {
      try {
        const response = await getActiveTrip();
        if (!cancelled) {
          setRemoteActiveTrip(response.trip ?? null);
        }
      } catch {
        // Keep store activeRide fallback.
      }
    };

    void refreshActiveTrip();
    const timer = setInterval(() => {
      void refreshActiveTrip();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUser]);

  const loadMessages = useCallback(async (rideId: string) => {
    try {
      const rideMessages = await getTripMessages(rideId);
      setMessages(rideMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [setMessages]);

  useEffect(() => {
    if (!activeTripId) return;
    void loadMessages(activeTripId);
  }, [activeTripId, loadMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeTripId || !currentUser) return;

    const rawReceiverId =
      currentUser.role === "rider"
        ? remoteActiveTrip?.driver?.id ??
          remoteActiveTrip?.driver?.userId ??
          remoteActiveTrip?.driver?.driverId ??
          remoteActiveTrip?.driverId ??
          activeRide?.driverId
        : remoteActiveTrip?.rider?.id ??
          remoteActiveTrip?.riderId ??
          activeRide?.riderId;

    if (rawReceiverId == null) {
      Alert.alert("Trip not assigned", "Wait for a counterpart to be assigned before sending messages.");
      return;
    }

    const receiverDigits = String(rawReceiverId).match(/\d+/);
    const receiverId = receiverDigits?.[0] ?? String(rawReceiverId);

    setIsLoading(true);
    try {
      const message = await sendTripMessage(activeTripId, {
        senderId: String(currentUser.id),
        receiverId,
        message: newMessage.trim(),
      });
      addMessage(message);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: LocalMessage }) => {
    const senderValue = item.senderId ?? item.sender_id;
    const isOwnMessage = String(senderValue ?? "") === String(currentUser?.id ?? "");
    const sentAt = item.sentAt
      ? new Date(item.sentAt)
      : item.created_at
        ? new Date(item.created_at)
        : new Date();

    return (
      <View className={`mb-3 max-w-[80%] ${isOwnMessage ? "self-end" : "self-start"}`}>
        <View className={`rounded-2xl px-4 py-2 ${isOwnMessage ? "bg-primary" : "bg-surface"}`}>
          <Text className={`text-sm ${isOwnMessage ? "text-primary-foreground" : "text-foreground"}`}>
            {item.message}
          </Text>
        </View>
        <Text className={`text-xs text-muted mt-1 ${isOwnMessage ? "text-right" : "text-left"}`}>
          {sentAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (!activeTripId) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <View className="items-center gap-4">
          <Ionicons name="chatbubble-outline" size={64} color={colors.muted} />
          <Text className="text-lg text-muted text-center">No active ride</Text>
          <Text className="text-sm text-muted text-center">
            Start a ride to chat with your driver or rider
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const inProgress = activeTripState === "IN_PROGRESS" || activeTripState === "in_progress";

  return (
    <ScreenContainer className="bg-background">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined} 
        style={Platform.OS === "web" ? { flex: 1, paddingBottom: 24 } : { flex: 1 }}
      >
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">
              {currentUser?.role === "rider" ? "Driver" : "Rider"} Chat
            </Text>
            <Text className="text-sm text-muted">Ride #{activeTripId.slice(-6)}</Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${inProgress ? "bg-success" : "bg-warning"}`}>
            <Text className="text-xs text-white font-medium capitalize">
              {(activeTripState ?? "active").replaceAll("_", " ").toLowerCase()}
            </Text>
          </View>
        </View>

        {remoteActiveTrip ? (
          <View className="px-4 py-3 border-b border-border bg-surface">
            <Text className="text-xs text-muted">
              Active trip synced. Pickup: {remoteActiveTrip.pickup?.address ?? "Pickup"}.
            </Text>
            <TouchableOpacity
              onPress={() => router.push(`/trip/${activeTripId}` as never)}
              className="mt-2 self-start"
            >
              <Text className="text-primary text-sm font-semibold">Open trip tracking</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        />

        <View className="flex-row items-center gap-3 p-4 border-t border-border">
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.muted}
            className="flex-1 bg-surface rounded-full px-4 py-3 text-foreground"
            style={{ color: colors.foreground }}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || isLoading}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              newMessage.trim() && !isLoading ? "bg-primary" : "bg-muted"
            }`}
          >
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() && !isLoading ? colors.text : colors.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
