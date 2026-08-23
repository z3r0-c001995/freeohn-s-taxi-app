import React, { useRef, useState, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDebounce } from "../../hooks/use-debounce";
import { useBrandTheme } from "../../hooks/use-brand-theme";
import { trpc } from "../../lib/trpc";
import { PlaceAutocompletePrediction, PlaceDetails, LatLng } from "../../lib/maps/map-types";

const POPULAR_ZAMBIA_LANDMARKS: PlaceAutocompletePrediction[] = [
  {
    place_id: "zm_east_park",
    description: "East Park Mall, Great East Road, Lusaka",
    formatted_address: "East Park Mall, Great East Road, Lusaka",
    structured_formatting: {
      main_text: "East Park Mall",
      secondary_text: "Great East Road, Lusaka",
    },
    geometry: { location: { lat: -15.3897, lng: 28.3237 } },
  },
  {
    place_id: "zm_manda_hill",
    description: "Manda Hill Shopping Centre, Great East Road, Lusaka",
    formatted_address: "Manda Hill Shopping Centre, Great East Road, Lusaka",
    structured_formatting: {
      main_text: "Manda Hill Shopping Centre",
      secondary_text: "Great East Road, Lusaka",
    },
    geometry: { location: { lat: -15.4064, lng: 28.3036 } },
  },
  {
    place_id: "zm_cairo_road",
    description: "Cairo Road, Central Business District, Lusaka",
    formatted_address: "Cairo Road, Central Business District, Lusaka",
    structured_formatting: {
      main_text: "Cairo Road (Lusaka CBD)",
      secondary_text: "Lusaka City Centre",
    },
    geometry: { location: { lat: -15.4164, lng: 28.2847 } },
  },
  {
    place_id: "zm_airport",
    description: "Kenneth Kaunda International Airport, Lusaka",
    formatted_address: "Kenneth Kaunda International Airport, Lusaka",
    structured_formatting: {
      main_text: "Kenneth Kaunda Int'l Airport",
      secondary_text: "Airport Road, Lusaka",
    },
    geometry: { location: { lat: -15.3305, lng: 28.4529 } },
  },
  {
    place_id: "zm_mansa",
    description: "Mansa Town Centre, Luapula Province",
    formatted_address: "Mansa Central, Luapula Province, Zambia",
    structured_formatting: {
      main_text: "Mansa Town Centre",
      secondary_text: "Luapula Province, Zambia",
    },
    geometry: { location: { lat: -11.197, lng: 28.891 } },
  },
  {
    place_id: "zm_kitwe",
    description: "Mukuba Mall / City Centre, Kitwe, Copperbelt",
    formatted_address: "Mukuba Mall, Kitwe, Copperbelt Province, Zambia",
    structured_formatting: {
      main_text: "Mukuba Mall (Kitwe CBD)",
      secondary_text: "Copperbelt Province, Zambia",
    },
    geometry: { location: { lat: -12.8024, lng: 28.2132 } },
  },
  {
    place_id: "zm_ndola",
    description: "Jacaranda Mall / City Centre, Ndola, Copperbelt",
    formatted_address: "Jacaranda Mall, Ndola, Copperbelt Province, Zambia",
    structured_formatting: {
      main_text: "Jacaranda Mall (Ndola)",
      secondary_text: "Copperbelt Province, Zambia",
    },
    geometry: { location: { lat: -12.9691, lng: 28.6366 } },
  },
  {
    place_id: "zm_solwezi",
    description: "Solwezi Town Centre, North-Western Province",
    formatted_address: "Solwezi Town Centre, North-Western Province, Zambia",
    structured_formatting: {
      main_text: "Solwezi Town Centre",
      secondary_text: "North-Western Province, Zambia",
    },
    geometry: { location: { lat: -12.1738, lng: 26.3908 } },
  },
  {
    place_id: "zm_unza",
    description: "University of Zambia (UNZA), Great East Road, Lusaka",
    formatted_address: "University of Zambia (UNZA), Great East Road, Lusaka",
    structured_formatting: {
      main_text: "University of Zambia (UNZA)",
      secondary_text: "Great East Road, Lusaka",
    },
    geometry: { location: { lat: -15.3874, lng: 28.3235 } },
  },
];

interface PlaceSearchInputProps {
  placeholder: string;
  onPlaceSelect: (place: PlaceDetails) => void;
  userLocation?: LatLng;
  style?: any;
  value?: string;
  onChangeText?: (text: string) => void;
  dotColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showSuggestionsOnFocus?: boolean;
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
  showSuggestionsOnFocus = true,
}: PlaceSearchInputProps) {
  const brand = useBrandTheme();
  const [query, setQuery] = useState(value || "");
  const [predictions, setPredictions] = useState<PlaceAutocompletePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const debouncedQuery = useDebounce(query, 250);

  const { data: autocompleteData, isLoading, error } = trpc.maps.placesAutocomplete.useQuery(
    { query: debouncedQuery, location: userLocation },
    { enabled: debouncedQuery.length > 1 },
  );

  useEffect(() => {
    if (debouncedQuery.length > 1 && autocompleteData) {
      setPredictions(autocompleteData);
      const shouldShow = autocompleteData.length > 0;
      setShowResults(shouldShow);
      Animated.timing(fadeAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else if (isFocused && showSuggestionsOnFocus && debouncedQuery.length <= 1) {
      setPredictions(POPULAR_ZAMBIA_LANDMARKS);
      setShowResults(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [autocompleteData, debouncedQuery, fadeAnim, isFocused, showSuggestionsOnFocus]);

  // Sync controlled value
  useEffect(() => {
    if (typeof value === "string") {
      setQuery(value);
    }
  }, [value]);

  const handleSelect = (prediction: PlaceAutocompletePrediction) => {
    const details: PlaceDetails = {
      place_id: prediction.place_id,
      formatted_address: prediction.formatted_address || prediction.description,
      geometry: { location: prediction.geometry.location },
    };
    setQuery(details.formatted_address);
    setPredictions([]);
    setShowResults(false);
    Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    onPlaceSelect(details);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTimeout(() => {
      setShowResults(false);
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    }, 250);
  };

  const inputBorderColor = isFocused ? brand.primary : brand.border;

  return (
    <View style={[{ position: "relative", zIndex: 100 }, style]}>
      {/* Input Row */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: brand.surface,
            borderColor: inputBorderColor,
            shadowColor: isFocused ? brand.primary : "#000",
            shadowOpacity: isFocused ? 0.15 : 0.04,
            shadowRadius: isFocused ? 8 : 3,
            shadowOffset: { width: 0, height: 2 },
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={isFocused ? (dotColor || brand.primary) : (dotColor || brand.textMuted)}
          style={{ marginRight: 10 }}
        />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={brand.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            onChangeText?.(text);
            if (text.length <= 1 && showSuggestionsOnFocus) {
              setPredictions(POPULAR_ZAMBIA_LANDMARKS);
              setShowResults(true);
            }
          }}
          onFocus={() => {
            setIsFocused(true);
            if (query.length <= 1 && showSuggestionsOnFocus) {
              setPredictions(POPULAR_ZAMBIA_LANDMARKS);
              setShowResults(true);
            } else if (predictions.length > 0) {
              setShowResults(true);
            }
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
              if (showSuggestionsOnFocus) {
                setPredictions(POPULAR_ZAMBIA_LANDMARKS);
                setShowResults(true);
              } else {
                setPredictions([]);
                setShowResults(false);
              }
            }}
            style={styles.clearButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={18} color={brand.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dropdown Results */}
      {showResults && predictions.length > 0 && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              backgroundColor: brand.surface,
              borderColor: brand.border,
              opacity: fadeAnim,
            },
          ]}
        >
          {query.length <= 1 && (
            <View style={styles.suggestionsHeader}>
              <Ionicons name="flash-outline" size={14} color="#EA580C" />
              <Text style={styles.suggestionsHeaderText}>Popular Cities & Landmarks</Text>
            </View>
          )}

          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="always"
            scrollEnabled={predictions.length > 4}
            style={{ maxHeight: 280 }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: brand.border }]} />
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.6}
                style={[styles.resultRow, { backgroundColor: brand.surface }]}
              >
                <View style={[styles.resultIconWrap, { backgroundColor: brand.surfaceMuted || "#F1F5F9" }]}>
                  <Ionicons
                    name={item.place_id.startsWith("zm_") ? "star" : "location"}
                    size={16}
                    color={item.place_id.startsWith("zm_") ? "#EA580C" : brand.primary}
                  />
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
                <Ionicons name="chevron-forward" size={16} color={brand.textMuted} />
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      {/* States */}
      {!isLoading && !error && debouncedQuery.length > 2 && predictions.length === 0 && !showResults && (
        <View style={[styles.stateRow, { backgroundColor: brand.surface, borderColor: brand.border }]}>
          <Ionicons name="search" size={16} color={brand.textMuted} style={{ marginRight: 8 }} />
          <Text style={[styles.stateText, { color: brand.textMuted }]}>No places found in Zambia. Try another landmark name.</Text>
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    padding: 0,
    margin: 0,
    minHeight: 22,
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
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 30,
    zIndex: 9999,
    overflow: "hidden",
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: "#FFF7ED",
  },
  suggestionsHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#EA580C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  resultIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  resultMain: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  resultSub: {
    fontSize: 12,
    fontWeight: "400",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  stateText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
