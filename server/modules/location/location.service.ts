import EventEmitter from "node:events";
import type { DriverDispatchOffer } from "../platform/types";
import type { TripRecord } from "../../../shared/ride-hailing";

export type TripStreamEvent =
  | { type: "trip.updated"; trip: TripRecord }
  | { type: "driver.offer"; offer: DriverDispatchOffer }
  | {
      type: "driver.location";
      tripId: string;
      driverId: string;
      lat: number;
      lng: number;
      heading: number | null;
      speed: number | null;
      timestamp: string;
    };

class LocationStreamingService {
  private readonly emitter = new EventEmitter();

  publishTripUpdated(trip: TripRecord): void {
    this.emitter.emit(`trip:${trip.id}`, {
      type: "trip.updated",
      trip,
    } satisfies TripStreamEvent);
  }

  publishDriverOffer(offer: DriverDispatchOffer): void {
    this.emitter.emit(`driver:${offer.driverId}`, {
      type: "driver.offer",
      offer,
    } satisfies TripStreamEvent);
    this.emitter.emit(`trip:${offer.tripId}`, {
      type: "driver.offer",
      offer,
    } satisfies TripStreamEvent);
  }

  publishDriverLocation(event: {
    tripId: string;
    driverId: string;
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    timestamp: string;
  }): void {
    this.emitter.emit(`trip:${event.tripId}`, {
      type: "driver.location",
      ...event,
    } satisfies TripStreamEvent);
  }

  subscribeTrip(tripId: string, listener: (event: TripStreamEvent) => void): () => void {
    const channel = `trip:${tripId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }

  subscribeDriver(driverId: string, listener: (event: TripStreamEvent) => void): () => void {
    const channel = `driver:${driverId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }
}

export const locationStreamingService = new LocationStreamingService();

