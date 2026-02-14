import { describe, it, expect } from "vitest";
import { calculateFare } from "../shared/constants/fare";

describe("Fare Calculation", () => {
  it("calculates standard fare correctly", () => {
    const distance = 10; // 10 km
    const duration = 20; // 20 minutes
    const fare = calculateFare(distance, duration, "standard");

    // Base: 2.50 + (10 * 1.20) + (20 * 0.25) = 2.50 + 12 + 5 = 19.50
    expect(fare).toBe(19.50);
  });

  it("calculates premium fare correctly", () => {
    const distance = 10; // 10 km
    const duration = 20; // 20 minutes
    const fare = calculateFare(distance, duration, "premium");

    // Standard fare * 1.5 = 19.50 * 1.5 = 29.25
    expect(fare).toBe(29.25);
  });

  it("applies minimum fare", () => {
    const distance = 1; // 1 km
    const duration = 1; // 1 minute
    const fare = calculateFare(distance, duration, "standard");

    // Base: 2.50 + (1 * 1.20) + (1 * 0.25) = 3.95, but min is 5.00
    expect(fare).toBe(5.00);
  });

  it("handles zero distance and duration", () => {
    const fare = calculateFare(0, 0, "standard");
    expect(fare).toBe(5.00); // Minimum fare
  });
});

describe("Driver Matching", () => {
  // Mock haversineDistance for testing
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  it("calculates distance correctly", () => {
    // Same point
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);

    // Approximate distance between two points
    const distance = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437); // SF to LA
    expect(distance).toBeGreaterThan(500); // Roughly 559 km
    expect(distance).toBeLessThan(600);
  });
});