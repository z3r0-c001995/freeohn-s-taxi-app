import React, { useRef, useState, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDebounce } from "../../hooks/use-debounce";
import { useBrandTheme } from "../../hooks/use-brand-theme";
import { trpc } from "../../lib/trpc";
import { PlaceAutocompletePrediction, PlaceDetails, LatLng } from "../../lib/maps/map-types";

interface PlaceSearchInputProps {
  placeholder: string;
  onPlaceSelect: (place: PlaceDetails) => void;
  userLocation?: LatLng;
  style?: any;
  value?: string;
  onChangeText?: (text: string) => void;
  /** dot color shown to the left of the input */
  dotColor?: string;
  /** icon shown inside the input field */
  icon?: keyof typeof Ionicons.glyphMap;
}

export function PlaceSearchInput({
  placeholder,
  onPlaceSelect,
  userLocation,
  style,
  value,
  onChangeText,
  dotColor,
  icon = "location-outline",
}: PlaceSearchInputProps) {
  const brand = useBrandTheme();
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlaceAutocompletePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const debouncedQuery = useDebounce(query, 280);

  const { data: autocompleteData, isLoading, error } = trpc.maps.placesAutocomplete.useQuery(
    { query: debouncedQuery, location: userLocation },
    { enabled: debouncedQuery.length > 2 },
  );

  useEffect(() => {
    if (autocompleteData) {
      setPredictions(autocompleteData);
      const shouldShow = autocompleteData.length > 0;
      setShowResults(shouldShow);
      Animated.timing(fadeAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  }, [autocompleteData, fadeAnim]);

  // Sync controlled value
  useEffect(() => {
    if (typeof value === "string" && value !== query) {
      setQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelect = (prediction: PlaceAutocompletePrediction) => {
    const details: PlaceDetails = {
      place_id: prediction.place_id,
      formatted_address: prediction.formatted_address || prediction.description,
      geometry: { location: prediction.geometry.location },
    };
    onPlaceSelect(details);
    setQuery(details.formatted_address);
    setPredictions([]);
    setShowResults(false);
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay to allow the tap event on a result to fire first
    setTimeout(() => {
      setShowResults(false);
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    }, 180);
  };

  const inputBorderColor = isFocused ? brand.primary : "transparent";

  return (
    <View style={[{ position: "relative", zIndex: 100 }, style]}>
      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: brand.surfaceMuted || (isFocused ? brand.background : brand.surface),
            borderColor: inputBorderColor,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={isFocused ? brand.primary : brand.textMuted}
          style={{ marginRight: 12 }}
        />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={brand.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            onChangeText?.(text);
            if (text.length <= 2) {
              setPredictions([]);
              setShowResults(false);
            }
          }}
          onFocus={() => {
            setIsFocused(true);
            if (predictions.length > 0) setShowResults(true);
          }}
          onBlur={handleBlur}
          style={[styles.textInput, { color: brand.text }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
          selectionColor={brand.primary}
        />
        {isLoading ? (
          <ActivityIndicator size="small" color={brand.primary} style={{ marginLeft: 6 }} />
        ) : query.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              onChangeText?.("");
              setPredictions([]);
              setShowResults(false);
            }}
            style={styles.clearButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={18} color={brand.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dropdown results */}
      {showResults && predictions.length > 0 && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              backgroundColor: brand.surface,
              borderColor: brand.border,
              shadowColor: brand.text,
              opacity: fadeAnim,
              zIndex: 9999,
              elevation: 20,
            },
          ]}
        >
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="always"
            scrollEnabled={predictions.length > 4}
            style={{ maxHeight: 260 }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: brand.border }]} />
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.6}
                style={[styles.resultRow, { backgroundColor: brand.surface }]}
              >
                <View style={[styles.resultIconWrap, { backgroundColor: brand.surfaceMuted }]}>
                  <Ionicons name="location" size={16} color={brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.resultMain, { color: brand.text }]}
                    numberOfLines={1}
                  >
                    {item.structured_formatting?.main_text ?? item.description}
                  </Text>
                  {item.structured_formatting?.secondary_text ? (
                    <Text
                      style={[styles.resultSub, { color: brand.textMuted }]}
                      numberOfLines={1}
                    >
                      {item.structured_formatting.secondary_text}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="arrow-forward" size={16} color={brand.border} />
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      {/* States */}
      {!isLoading && !error && debouncedQuery.length > 2 && predictions.length === 0 && !showResults && (
        <View style={[styles.stateRow, { backgroundColor: brand.surface, borderColor: brand.border }]}>
          <Ionicons name="search" size={16} color={brand.textMuted} style={{ marginRight: 8 }} />
          <Text style={[styles.stateText, { color: brand.textMuted }]}>No places found</Text>
        </View>
      )}
      {!isLoading && !!error && debouncedQuery.length > 2 && (
        <View style={[styles.stateRow, { backgroundColor: brand.surface, borderColor: brand.danger }]}>
          <Ionicons name="alert-circle" size={16} color={brand.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.stateText, { color: brand.danger }]}>Search currently unavailable</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    padding: 0,
    margin: 0,
    minHeight: 24,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
    borderRadius: 12,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 16,
    // Shadow
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  resultMain: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
    lineHeight: 20,
  },
  resultSub: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  stateText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
