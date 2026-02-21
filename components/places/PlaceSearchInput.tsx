import React, { useState, useEffect } from "react";
import { View, TextInput, FlatList, TouchableOpacity, Text } from "react-native";
import { useDebounce } from "../../hooks/use-debounce";
import { trpc } from "../../lib/trpc";
import { PlaceAutocompletePrediction, PlaceDetails, LatLng } from "../../lib/maps/map-types";

interface PlaceSearchInputProps {
  placeholder: string;
  onPlaceSelect: (place: PlaceDetails) => void;
  userLocation?: LatLng;
  style?: any;
  value?: string;
  onChangeText?: (text: string) => void;
}

export function PlaceSearchInput({
  placeholder,
  onPlaceSelect,
  userLocation,
  style,
  value,
  onChangeText,
}: PlaceSearchInputProps) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlaceAutocompletePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const { data: autocompleteData, isLoading, error } = trpc.maps.placesAutocomplete.useQuery(
    {
      query: debouncedQuery,
      location: userLocation,
    },
    {
      enabled: debouncedQuery.length > 2,
    }
  );

  useEffect(() => {
    if (autocompleteData) {
      setPredictions(autocompleteData);
      setShowResults(true);
    }
  }, [autocompleteData]);

  useEffect(() => {
    if (typeof value === "string" && value !== query) {
      setQuery(value);
    }
  }, [value, query]);

  const handleSelect = async (prediction: PlaceAutocompletePrediction) => {
    const details: PlaceDetails = {
      place_id: prediction.place_id,
      formatted_address: prediction.formatted_address || prediction.description,
      geometry: { location: prediction.geometry.location },
    };
    onPlaceSelect(details);
    setQuery(details.formatted_address);
    setShowResults(false);
  };

  return (
    <View style={style}>
      <TextInput
        placeholder={placeholder}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          onChangeText?.(text);
          if (text.length <= 2) {
            setPredictions([]);
            setShowResults(false);
          }
        }}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
        }}
        onFocus={() => setShowResults(predictions.length > 0)}
        onBlur={() => setTimeout(() => setShowResults(false), 200)} // Delay to allow selection
      />
      {showResults && predictions.length > 0 && (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.place_id}
          style={{
            maxHeight: 200,
            borderWidth: 1,
            borderColor: "#ccc",
            borderTopWidth: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            backgroundColor: "white",
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#eee",
              }}
            >
              <Text style={{ fontWeight: "bold" }}>{item.structured_formatting.main_text}</Text>
              <Text style={{ color: "#666" }}>{item.structured_formatting.secondary_text}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {isLoading && <Text style={{ padding: 8, color: "#666" }}>Searching...</Text>}
      {!isLoading && !error && debouncedQuery.length > 2 && predictions.length === 0 && (
        <Text style={{ padding: 8, color: "#666" }}>No matches found</Text>
      )}
      {!isLoading && !!error && debouncedQuery.length > 2 && (
        <Text style={{ padding: 8, color: "#B45309" }}>Search unavailable. Please try again.</Text>
      )}
    </View>
  );
}
