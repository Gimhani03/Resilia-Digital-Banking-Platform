import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TransactionDto } from "@resilia/shared";
import {
  AmountText,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingBlock,
  Screen,
  ScreenHeader,
  SegmentedControl,
  StatusBadge,
} from "../../src/components/ui";
import { api, relativeTime } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

type CategoryFilter =
  | "All"
  | "TRANSFER"
  | "MERCHANT"
  | "UTILITIES"
  | "SALARY"
  | "HELD";
type DirectionFilter = "All" | "IN" | "OUT";

type HistoryResponse =
  | TransactionDto[]
  | { items: TransactionDto[]; total?: number; page?: number };

export default function HistoryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [direction, setDirection] = useState<DirectionFilter>("All");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const params = new URLSearchParams();
      if (category !== "All" && category !== "HELD") {
        params.set("category", category);
      }
      if (category === "HELD") params.set("status", "HELD");
      params.set("page", "1");
      params.set("limit", "50");
      const res = await api<HistoryResponse>(
        `/payments/history?${params.toString()}`,
        { token },
      );
      const items = Array.isArray(res) ? res : res.items || [];
      setRows(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [token, category]);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.error);
    }, [load]),
  );

  const filtered = useMemo(() => {
    return rows.filter((t) => {
      if (direction !== "All" && t.direction !== direction) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        t.counterparty.toLowerCase().includes(q) ||
        (t.reference || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [rows, query, direction]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.crimson}
          />
        }
      >
        <Screen>
          <ScreenHeader title="Transactions" onBack={() => router.back()} />
          <Text style={styles.lead}>Search and filter your payment history</Text>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search payee or reference"
            accessibilityLabel="Search transactions"
            style={{ marginBottom: 12 }}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {(
                [
                  "All",
                  "TRANSFER",
                  "MERCHANT",
                  "UTILITIES",
                  "SALARY",
                  "HELD",
                ] as CategoryFilter[]
              ).map((c) => (
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
                    {c === "All"
                      ? "All"
                      : c.charAt(0) + c.slice(1).toLowerCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <SegmentedControl
            options={[
              { value: "All", label: "All" },
              { value: "OUT", label: "Out" },
              { value: "IN", label: "In" },
            ]}
            value={direction}
            onChange={setDirection}
          />

          <ErrorBanner message={error} />
          {loading ? (
            <LoadingBlock />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No transactions"
              body="Try clearing filters or make a payment to see activity here."
              actionLabel="Transfer"
              onAction={() => router.push("/transfer")}
            />
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {filtered.map((t, idx) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/history/${t.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t.counterparty}
                  style={[
                    styles.txn,
                    idx === filtered.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.icon}>
                    <Text style={styles.iconText}>
                      {t.counterparty.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {t.counterparty}
                    </Text>
                    <Text style={styles.meta}>
                      {relativeTime(t.createdAt)} · {t.category}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <AmountText
                      amount={t.amount}
                      direction={t.direction}
                      size="sm"
                    />
                    <StatusBadge status={t.status} />
                  </View>
                </Pressable>
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
  chips: { flexDirection: "row", gap: 8, marginBottom: 12, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.navy },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontFamily: fonts.sansExtra,
    fontSize: 12,
    color: colors.navy,
  },
  name: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.navy },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted },
});
