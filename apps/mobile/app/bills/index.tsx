import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BillerDto } from "@resilia/shared";
import {
  EmptyState,
  ErrorBanner,
  Input,
  ListRow,
  LoadingBlock,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Card,
} from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function BillersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [billers, setBillers] = useState<BillerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      setBillers(await api<BillerDto[]>("/payments/billers", { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billers");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  const categories = useMemo(() => {
    const set = new Set(billers.map((b) => b.category));
    return ["All", ...Array.from(set)];
  }, [billers]);

  const filtered = billers.filter((b) => {
    const catOk = category === "All" || b.category === category;
    const q = query.trim().toLowerCase();
    const qOk =
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q);
    return catOk && qOk;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Screen>
          <ScreenHeader title="Pay bill" onBack={() => router.back()} />
          <Text style={styles.lead}>Choose a biller from the catalogue</Text>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search billers"
            accessibilityLabel="Search billers"
            style={{ marginBottom: 12 }}
          />
          {categories.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
            >
              <View style={styles.chips}>
                {categories.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.chip, category === c && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === c }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        category === c && { color: colors.white },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : (
            <SegmentedControl
              options={[
                { value: "All", label: "All" },
                { value: "Utilities", label: "Utilities" },
              ]}
              value={category === "All" ? "All" : "Utilities"}
              onChange={(v) => setCategory(v)}
            />
          )}
          <ErrorBanner message={error} />
          {loading ? (
            <LoadingBlock />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No billers found"
              body="Try another category or search term."
            />
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {filtered.map((b, i) => (
                <ListRow
                  key={b.id || b.code}
                  title={b.name}
                  subtitle={`${b.category} · ${b.accountHint}`}
                  onPress={() => router.push(`/bills/${b.code}`)}
                  last={i === filtered.length - 1}
                  right={<Text style={styles.chevron}>→</Text>}
                />
              ))}
            </Card>
          )}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    marginBottom: 12,
  },
  chips: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  chevron: { color: colors.muted, fontFamily: fonts.sansBold },
});
