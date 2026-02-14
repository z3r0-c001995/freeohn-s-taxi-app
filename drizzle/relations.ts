import { relations } from "drizzle-orm";
import { users, driverProfiles, rides, messages, locationHistory } from "./schema";

export const usersRelations = relations(users, ({ one, many }) => ({
  driverProfile: one(driverProfiles, {
    fields: [users.id],
    references: [driverProfiles.userId],
  }),
  ridesAsRider: many(rides, {
    relationName: "rider",
  }),
  ridesAsDriver: many(rides, {
    relationName: "driver",
  }),
  sentMessages: many(messages, {
    relationName: "sender",
  }),
  receivedMessages: many(messages, {
    relationName: "receiver",
  }),
  locationHistory: many(locationHistory),
}));

export const driverProfilesRelations = relations(driverProfiles, ({ one }) => ({
  user: one(users, {
    fields: [driverProfiles.userId],
    references: [users.id],
  }),
}));

export const ridesRelations = relations(rides, ({ one, many }) => ({
  rider: one(users, {
    fields: [rides.riderId],
    references: [users.id],
    relationName: "rider",
  }),
  driver: one(users, {
    fields: [rides.driverId],
    references: [users.id],
    relationName: "driver",
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  ride: one(rides, {
    fields: [messages.rideId],
    references: [rides.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const locationHistoryRelations = relations(locationHistory, ({ one }) => ({
  user: one(users, {
    fields: [locationHistory.userId],
    references: [users.id],
  }),
}));
