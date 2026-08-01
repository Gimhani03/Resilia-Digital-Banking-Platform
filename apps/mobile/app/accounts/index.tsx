import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Screen,
  ScreenHeader,
} from "../../src/components/ui";
import { api, formatLkr, type AccountSummary } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { colors, fonts } from "../../src/theme";

export default function AccountsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setAccounts(await api<AccountSummary[]>("/accounts", { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader title="Accounts" onBack={() => router.back()} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.crimson}
          />
        }
      >
        <Screen>
          <ErrorBanner message={error} />
          {loading && <LoadingBlock />}
          {!loading && accounts.length === 0 && (
            <EmptyState title="No accounts" body="Your linked accounts will appear here." />
          )}
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} asChild>
              <Pressable>
                <Card>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>
                        {a.nickname || a.label} · {a.mask}
                      </Text>
                      <Text style={styles.type}>{a.type}</Text>
                    </View>
                    {a.frozen ? <Badge tone="danger">Frozen</Badge> : <Badge>Active</Badge>}
                  </View>
                  <Text style={styles.balance}>{formatLkr(a.available ?? a.balance)}</Text>
                  <Text style={styles.meta}>
                    Ledger {formatLkr(a.balance)}
                    {(a.heldAmount || 0) > 0 ? ` · Held ${formatLkr(a.heldAmount)}` : ""}
                  </Text>
                </Card>
              </Pressable>
            </Link>
          ))}
        </Screen>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 14 },
  type: { fontFamily: fonts.sans, color: colors.muted, fontSize: 12, marginTop: 2 },
  balance: { fontFamily: fonts.display, fontSize: 28, color: colors.navy },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 4 },
});
