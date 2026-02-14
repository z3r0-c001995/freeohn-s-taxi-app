import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { getMessagesForRide, sendMessage } from "@/lib/db-service";
import { generateId } from "@/lib/ride-utils";

export default function ChatScreen() {
  const colors = useColors();
  const { currentUser, activeRide, messages, setMessages, addMessage } = useAppStore();
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeRide) {
      loadMessages();
    }
  }, [activeRide]);

  const loadMessages = async () => {
    if (!activeRide) return;

    try {
      const rideMessages = await getMessagesForRide(activeRide.id.toString());
      setMessages(rideMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeRide || !currentUser) return;

    setIsLoading(true);
    try {
      const receiverId = currentUser.role === "rider" ? activeRide.driverId! : activeRide.riderId;

      const message = await sendMessage(activeRide.id.toString(), currentUser.id.toString(), receiverId.toString(), newMessage.trim());
      addMessage(message);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;

    return (
      <View
        className={`mb-3 max-w-[80%] ${isOwnMessage ? "self-end" : "self-start"}`}
      >
        <View
          className={`rounded-2xl px-4 py-2 ${
            isOwnMessage ? "bg-primary" : "bg-surface"
          }`}
        >
          <Text
            className={`text-sm ${
              isOwnMessage ? "text-primary-foreground" : "text-foreground"
            }`}
          >
            {item.message}
          </Text>
        </View>
        <Text
          className={`text-xs text-muted mt-1 ${
            isOwnMessage ? "text-right" : "text-left"
          }`}
        >
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (!activeRide) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <View className="items-center gap-4">
          <Ionicons name="chatbubble-outline" size={64} color={colors.muted} />
          <Text className="text-lg text-muted text-center">
            No active ride
          </Text>
          <Text className="text-sm text-muted text-center">
            Start a ride to chat with your driver or rider
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">
              {currentUser?.role === "rider" ? "Driver" : "Rider"} Chat
            </Text>
            <Text className="text-sm text-muted">
              Ride #{activeRide.id.toString().slice(-6)}
            </Text>
          </View>
          <View
            className={`px-3 py-1 rounded-full ${
              activeRide.status === "in_progress" ? "bg-success" : "bg-warning"
            }`}
          >
            <Text className="text-xs text-white font-medium capitalize">
              {activeRide.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          inverted={false}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        />

        {/* Message Input */}
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
              color={
                newMessage.trim() && !isLoading
                  ? colors.text
                  : colors.muted
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}