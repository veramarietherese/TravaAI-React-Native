import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GLOBE_COUNTRIES, type GlobeCountry } from "../data/globe-country-data";

interface CountryPickerModalProps {
  visible: boolean;
  title: string;
  selectedCode?: string | null;
  disabledCode?: string | null;
  onClose(): void;
  onSelect(country: GlobeCountry): void;
}

export function CountryPickerModal({
  visible,
  title,
  selectedCode,
  disabledCode,
  onClose,
  onSelect,
}: CountryPickerModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return GLOBE_COUNTRIES;
    return GLOBE_COUNTRIES.filter((country) =>
      [country.name, country.code, country.alpha3]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query]);

  function close() {
    setQuery("");
    onClose();
  }

  function choose(country: GlobeCountry) {
    if (country.code === disabledCode) return;
    setQuery("");
    onSelect(country);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TRAVA AI WORLD DIRECTORY</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close country picker"
            onPress={close}
            style={styles.closeButton}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            placeholder="Search country or code"
            placeholderTextColor="#8A94A8"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear country search"
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? "country" : "countries"}
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(country) => country.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const disabled = item.code === disabledCode;
            const selected = item.code === selectedCode;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                onPress={() => choose(item)}
                style={({ pressed }) => [
                  styles.countryRow,
                  selected && styles.countryRowSelected,
                  disabled && styles.countryRowDisabled,
                  pressed && !disabled && styles.countryRowPressed,
                ]}
              >
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCode}>{item.code}</Text>
                </View>
                <View style={styles.countryCopy}>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryMeta}>
                    {item.alpha3 || item.code} • {item.lat.toFixed(1)}°, {item.lng.toFixed(1)}°
                  </Text>
                </View>
                <Text style={styles.rowAction}>
                  {disabled ? "Selected" : selected ? "✓" : "›"}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No country found</Text>
              <Text style={styles.emptyCopy}>Try the full country name or its two-letter code.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8F9FF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  eyebrow: { color: "#7357EF", fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  title: { marginTop: 4, color: "#111D3A", fontSize: 23, lineHeight: 29, fontWeight: "900" },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EF",
  },
  closeGlyph: { color: "#26324B", fontSize: 25, lineHeight: 27, fontWeight: "600" },
  searchBox: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE2EE",
    backgroundColor: "#FFFFFF",
  },
  searchGlyph: { marginRight: 9, color: "#7357EF", fontSize: 21, fontWeight: "800" },
  searchInput: { flex: 1, minHeight: 50, color: "#17233E", fontSize: 15, fontWeight: "600" },
  clearButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  clearText: { color: "#77839A", fontSize: 21, fontWeight: "700" },
  resultCount: { marginHorizontal: 22, marginTop: 12, marginBottom: 6, color: "#7A8599", fontSize: 11, fontWeight: "700" },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  countryRow: {
    minHeight: 68,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EF",
    backgroundColor: "#FFFFFF",
  },
  countryRowPressed: { opacity: 0.72 },
  countryRowSelected: { borderColor: "#8B72F7", backgroundColor: "#F2EFFF" },
  countryRowDisabled: { opacity: 0.48 },
  countryCodeBadge: {
    width: 46,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#EEEAFE",
  },
  countryCode: { color: "#6549DA", fontSize: 12, letterSpacing: 0.6, fontWeight: "900" },
  countryCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  countryName: { color: "#17233E", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  countryMeta: { marginTop: 2, color: "#7A8599", fontSize: 10, lineHeight: 14, fontWeight: "600" },
  rowAction: { marginLeft: 8, color: "#7357EF", fontSize: 17, fontWeight: "900" },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 52 },
  emptyTitle: { color: "#17233E", fontSize: 17, fontWeight: "900" },
  emptyCopy: { marginTop: 6, color: "#7A8599", fontSize: 12, lineHeight: 18, textAlign: "center" },
});
