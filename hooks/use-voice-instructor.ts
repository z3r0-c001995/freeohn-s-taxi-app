import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { IS_DRIVER_APP } from "@/constants/app-variant";

const PREFIX = "[VoiceInstructor]";

/**
 * Attempt to load expo-speech dynamically so the hook gracefully degrades
 * if the module is not yet installed. Once `expo-speech` is added to
 * node_modules it will be picked up automatically without any code changes.
 */
function getNativeSpeech(): { speak: (text: string, opts: object) => void; stop: () => void } | null {
  if (Platform.OS === "web") return null;
  try {
    // Dynamic require — avoids build-time type error when expo-speech is absent.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require("expo-speech");
    if (mod && typeof mod.speak === "function") {
      return mod as { speak: (text: string, opts: object) => void; stop: () => void };
    }
    return null;
  } catch {
    return null;
  }
}

function speakNative(text: string) {
  const Speech = getNativeSpeech();
  if (!Speech) {
    // expo-speech not available yet — log so the developer can see the cue.
    console.log(`${PREFIX} [native-silent] ${text}`);
    return;
  }
  try {
    Speech.stop();
  } catch {
    // ignore
  }
  Speech.speak(text, { language: "en-US", pitch: 1.0, rate: 0.92 });
}

function speakWeb(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel(); // stop any ongoing utterance
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  synth.speak(utterance);
}

function speak(text: string): void {
  console.log(`${PREFIX} "${text}"`);
  if (Platform.OS === "web") {
    speakWeb(text);
  } else {
    speakNative(text);
  }
}

// ─── Phrase sets ─────────────────────────────────────────────────────────────

const RIDER_PHRASES: Record<string, string> = {
  SEARCHING: "Looking for a driver near you.",
  MATCHING: "Looking for a driver near you.",
  DRIVER_ASSIGNED: "Great news! A driver has been assigned to your trip.",
  DRIVER_ARRIVING: "Your driver is arriving. Please be ready at the pickup point.",
  PIN_VERIFICATION: "Your driver is here. Share your pickup PIN to start the trip.",
  IN_PROGRESS: "Trip started. Sit back and enjoy the ride!",
  COMPLETED: "You have arrived at your destination. Thank you for riding with us!",
  CANCELLED_BY_DRIVER: "Your trip was cancelled by the driver. Please request a new ride.",
  CANCELLED_BY_PASSENGER: "Your trip has been cancelled.",
};

const DRIVER_PHRASES: Record<string, string> = {
  NEW_REQUEST: "New ride request incoming. Accept quickly!",
  DRIVER_ASSIGNED: "Ride accepted. Navigate to the passenger pickup location.",
  DRIVER_ARRIVING: "You have arrived at the pickup point. Waiting for the passenger.",
  PIN_VERIFICATION: "Ask the passenger for their PIN to start the trip.",
  IN_PROGRESS: "Trip started. Navigate to the destination.",
  COMPLETED: "Trip complete. Great job! Ready for your next ride.",
  DECLINED: "Ride request declined.",
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useVoiceInstructor
 *
 * Automatically speaks Uber-style navigation phrases when a trip state
 * changes, like Uber's voice coach. Works on:
 *   - Web: via the browser's built-in Web Speech API
 *   - iOS/Android: via expo-speech (gracefully silent if not yet installed)
 *
 * @param tripState   Current trip state string from the backend
 * @param hasNewRequest  Whether the driver has a new incoming request
 */
export function useVoiceInstructor({
  tripState,
  hasNewRequest = false,
}: {
  tripState?: string | null;
  hasNewRequest?: boolean;
}) {
  const prevTripStateRef = useRef<string | null | undefined>(null);
  const prevHasNewRequestRef = useRef(false);
  const phrases = IS_DRIVER_APP ? DRIVER_PHRASES : RIDER_PHRASES;

  // ── Driver: announce new ride request ──────────────────────────────────────
  useEffect(() => {
    if (!IS_DRIVER_APP) return;
    if (hasNewRequest && !prevHasNewRequestRef.current) {
      const phrase = DRIVER_PHRASES["NEW_REQUEST"];
      if (phrase) speak(phrase);
    }
    prevHasNewRequestRef.current = hasNewRequest;
  }, [hasNewRequest]);

  // ── Trip state change announcements ────────────────────────────────────────
  useEffect(() => {
    if (!tripState) return;
    if (tripState === prevTripStateRef.current) return;

    const phrase = phrases[tripState];
    if (phrase) speak(phrase);

    prevTripStateRef.current = tripState;
  }, [tripState, phrases]);

  // Manual announcement helper for consumers
  const announce = useCallback((message: string) => {
    speak(message);
  }, []);

  return { announce };
}
